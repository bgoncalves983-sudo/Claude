import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { avaria, utilizador, veiculo } from "../db/schema";
import type { Env } from "../env";
import { notificarGestaoPush } from "./push";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const enderecoGestao = (env: Env) => `https://${env.GESTAO_HOST || "gestao.frotaradical.pt"}`;

/** Emails dos gestores e administradores ativos (a gestao entra por email). */
export async function emailsDaGestao(env: Env): Promise<string[]> {
  const l = await drizzle(env.DB).select({ e: utilizador.email, p: utilizador.perfil, a: utilizador.ativo, m: utilizador.metodo }).from(utilizador);
  return l.filter((u) => u.a && u.m === "access" && (u.p === "gestor" || u.p === "admin")).map((u) => u.e);
}

export const emailConfigurado = (env: Env): boolean => !!env.RESEND_API_KEY;

/** Envia um email de teste e devolve o motivo se falhar (domínio por verificar, chave errada, etc.). */
export async function enviarTeste(env: Env, para: string): Promise<{ ok: boolean; detalhe: string }> {
  if (!env.RESEND_API_KEY) return { ok: false, detalhe: "A chave do Resend (RESEND_API_KEY) ainda não está registada." };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.ALERT_FROM, to: [para], subject: "Frota Radical: email de teste", html: "<p>Se está a ler isto, o envio de emails da aplicação está a funcionar.</p><p>Receberá aqui os avisos de avarias e de prazos a caducar.</p>" }),
    });
    if (r.ok) return { ok: true, detalhe: `Email enviado para ${para}.` };
    const corpo = (await r.json().catch(() => ({}))) as { message?: string };
    return { ok: false, detalhe: `O Resend recusou o envio (${r.status}): ${corpo.message ?? "sem detalhe"}` };
  } catch (e) { return { ok: false, detalhe: `Não foi possível contactar o Resend: ${(e as Error).message}` }; }
}

async function enviar(env: Env, para: string[], assunto: string, html: string): Promise<boolean> {
  if (!env.RESEND_API_KEY || para.length === 0) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.ALERT_FROM, to: para, subject: assunto, html }),
    });
    return r.ok;
  } catch { return false; }
}

/** Avisa a gestao assim que uma avaria e reportada (nunca falha o registo do instrutor). */
export async function notificarAvaria(env: Env, avariaId: number): Promise<void> {
  try {
    const db = drizzle(env.DB);
    const [x] = await db
      .select({ a: avaria, matricula: veiculo.matricula, marca: veiculo.marca, modelo: veiculo.modelo, quem: utilizador.nome })
      .from(avaria).innerJoin(veiculo, eq(veiculo.id, avaria.veiculoId)).leftJoin(utilizador, eq(utilizador.id, avaria.reportadoPor)).where(eq(avaria.id, avariaId)).limit(1);
    if (!x) return;
    const veic = [x.marca, x.modelo].filter(Boolean).join(" ");
    // Notificacao no telemovel/PC (so chega a quem ativou); o email segue a seguir.
    await notificarGestaoPush(env, { titulo: `Avaria: ${x.matricula}`, corpo: `${x.a.descricao.slice(0, 120)}${x.quem ? ` — ${x.quem}` : ""}`, url: "/#/avarias", tag: `avaria-${x.a.id}` });
    await enviar(env, await emailsDaGestao(env), `Avaria reportada: ${x.matricula}`,
      `<p><b>${esc(x.matricula)}</b>${veic ? ` · ${esc(veic)}` : ""}</p><p>${esc(x.a.descricao)}</p><p>Reportada por ${esc(x.quem ?? "—")}. As fotografias, se houver, chegam em poucos segundos.</p><p><a href="${esc(enderecoGestao(env))}/#/avarias">Ver avarias</a></p>`);
  } catch (e) { console.error("notificarAvaria", e); }
}

/** Lembrete diario: avarias ainda "reportadas" ha mais de 24 horas. */
export async function lembrarAvariasPendentes(env: Env): Promise<number> {
  const limite = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.descricao, a.data_reporte AS dataReporte, v.matricula FROM avaria a JOIN veiculo v ON v.id = a.veiculo_id
     WHERE a.estado = 'reportada' AND a.data_reporte < ?1 AND NOT EXISTS (SELECT 1 FROM alerta_log l WHERE l.chave = 'avaria-atraso:' || a.id) ORDER BY a.data_reporte`).bind(limite).all<{ id: number; descricao: string; dataReporte: string; matricula: string }>();
  if (results.length === 0) return 0;
  const linhas = results.map((r) => `<li><b>${esc(r.matricula)}</b>: ${esc(r.descricao)} (desde ${esc(r.dataReporte.slice(0, 10))})</li>`).join("");
  const ok = await enviar(env, await emailsDaGestao(env), `Frota: ${results.length} avaria(s) por tratar há mais de 24 horas`, `<p>Avarias ainda sem resposta:</p><ul>${linhas}</ul><p><a href="${esc(enderecoGestao(env))}/#/avarias">Ver avarias</a></p>`);
  if (ok) for (const r of results) await env.DB.prepare("INSERT OR IGNORE INTO alerta_log (chave) VALUES (?1)").bind(`avaria-atraso:${r.id}`).run();
  return ok ? results.length : 0;
}

/** Avisa a gestao quando o gasoleo do deposito desce abaixo do minimo (no maximo uma vez por semana). */
export async function avisarDepositoBaixo(env: Env, hoje: string): Promise<boolean> {
  const d = await env.DB.prepare("SELECT d.id, d.nome, d.capacidade_l AS cap, d.nivel_minimo_l AS minimo, COALESCE((SELECT SUM(delta_litros) FROM deposito_movimento m WHERE m.deposito_id = d.id), 0) AS nivel FROM deposito d LIMIT 1").first<{ id: number; nome: string; cap: number; minimo: number; nivel: number }>();
  if (!d || d.nivel >= d.minimo) return false;
  const chave = `deposito-baixo:${d.id}:${Math.floor(Date.parse(hoje) / (7 * 86_400_000))}`;
  const ja = await env.DB.prepare("SELECT 1 FROM alerta_log WHERE chave = ?1").bind(chave).first();
  if (ja) return false;
  const ok = await enviar(env, await emailsDaGestao(env), "Frota: gasóleo do depósito abaixo do mínimo",
    `<p>O depósito <b>${esc(d.nome)}</b> tem <b>${Math.round(d.nivel)} l</b> (mínimo configurado: ${Math.round(d.minimo)} l).</p><p><a href="${esc(enderecoGestao(env))}/#/deposito">Ver depósito</a></p>`);
  if (ok) await env.DB.prepare("INSERT OR IGNORE INTO alerta_log (chave) VALUES (?1)").bind(chave).run();
  return ok;
}
