import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { avaria, utilizador, veiculo } from "../db/schema";
import type { Env } from "../env";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const enderecoGestao = (env: Env) => `https://${env.GESTAO_HOST || "gestao.frotaradical.pt"}`;

/** Emails dos gestores e administradores ativos (a gestao entra por email). */
export async function emailsDaGestao(env: Env): Promise<string[]> {
  const l = await drizzle(env.DB).select({ e: utilizador.email, p: utilizador.perfil, a: utilizador.ativo, m: utilizador.metodo }).from(utilizador);
  return l.filter((u) => u.a && u.m === "access" && (u.p === "gestor" || u.p === "admin")).map((u) => u.e);
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
