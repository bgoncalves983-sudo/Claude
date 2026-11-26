import { and, eq, gt, lt, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { sessao, tentativaLogin, utilizador } from "../db/schema";

export const DURACAO_SESSAO_DIAS = 14;
const MS_DIA = 86_400_000;

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
export async function resumoToken(token: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}
const novoToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function criarSessao(d1: D1Database, utilizadorId: number, dispositivo: string | null) {
  const token = novoToken();
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_DIAS * MS_DIA).toISOString();
  await drizzle(d1).insert(sessao).values({ tokenHash: await resumoToken(token), utilizadorId, expiraEm, dispositivo: dispositivo?.slice(0, 200) ?? null });
  return { token, expiraEm };
}

/** Devolve o utilizador da sessao (e renova-a ao usar), ou null. */
export async function validarSessao(d1: D1Database, token: string) {
  const db = drizzle(d1);
  const agora = new Date().toISOString();
  const [linha] = await db
    .select({ s: sessao, u: utilizador })
    .from(sessao)
    .innerJoin(utilizador, eq(utilizador.id, sessao.utilizadorId))
    .where(and(eq(sessao.tokenHash, await resumoToken(token)), gt(sessao.expiraEm, agora)))
    .limit(1);
  if (!linha || !linha.u.ativo) return null;
  // Renovacao deslizante: so escreve se passou mais de 1 hora desde a ultima utilizacao.
  if (Date.parse(agora) - Date.parse(linha.s.ultimaUtilizacao) > 3_600_000) {
    await db.update(sessao).set({ ultimaUtilizacao: agora, expiraEm: new Date(Date.now() + DURACAO_SESSAO_DIAS * MS_DIA).toISOString() }).where(eq(sessao.id, linha.s.id));
  }
  return linha.u;
}

export async function terminarSessao(d1: D1Database, token: string) {
  await drizzle(d1).delete(sessao).where(eq(sessao.tokenHash, await resumoToken(token)));
}
export async function terminarSessoes(d1: D1Database, utilizadorId: number, exceptoToken?: string) {
  const db = drizzle(d1);
  if (exceptoToken) await db.delete(sessao).where(and(eq(sessao.utilizadorId, utilizadorId), ne(sessao.tokenHash, await resumoToken(exceptoToken))));
  else await db.delete(sessao).where(eq(sessao.utilizadorId, utilizadorId));
}
export async function limparSessoesExpiradas(d1: D1Database) {
  await drizzle(d1).delete(sessao).where(lt(sessao.expiraEm, new Date().toISOString()));
}

// ---------- Bloqueio por tentativas ----------
export const MAX_FALHAS = 5;

/** 5 falhas seguidas bloqueiam 15 min; 10 ou mais bloqueiam 60 min (contadas desde o ultimo sucesso). */
export function calcularBloqueio(falhas: number, ultimaFalhaISO: string | null, agoraMs = Date.now()): { bloqueado: boolean; segundos: number } {
  if (falhas < MAX_FALHAS || !ultimaFalhaISO) return { bloqueado: false, segundos: 0 };
  const minutos = falhas >= 2 * MAX_FALHAS ? 60 : 15;
  const ate = Date.parse(ultimaFalhaISO) + minutos * 60_000;
  return ate > agoraMs ? { bloqueado: true, segundos: Math.ceil((ate - agoraMs) / 1000) } : { bloqueado: false, segundos: 0 };
}

export async function estadoLogin(d1: D1Database, username: string, ip: string | null) {
  const db = drizzle(d1);
  const desde24h = new Date(Date.now() - MS_DIA).toISOString();
  const rows = await db
    .select({ em: tentativaLogin.em, sucesso: tentativaLogin.sucesso })
    .from(tentativaLogin)
    .where(and(eq(tentativaLogin.username, username), gt(tentativaLogin.em, desde24h)))
    .orderBy(tentativaLogin.em);
  let falhas = 0, ultima: string | null = null;
  for (const r of rows) { if (r.sucesso) { falhas = 0; ultima = null; } else { falhas++; ultima = r.em; } }
  let porIp = 0;
  if (ip) {
    const desde15 = new Date(Date.now() - 15 * 60_000).toISOString();
    porIp = (await db.select({ id: tentativaLogin.id }).from(tentativaLogin).where(and(eq(tentativaLogin.ip, ip), eq(tentativaLogin.sucesso, false), gt(tentativaLogin.em, desde15)))).length;
  }
  const b = calcularBloqueio(falhas, ultima);
  if (!b.bloqueado && porIp >= 20) return { falhas, bloqueado: true, segundos: 900 };
  return { falhas, ...b };
}
export async function registarTentativa(d1: D1Database, username: string, ip: string | null, sucesso: boolean) {
  await drizzle(d1).insert(tentativaLogin).values({ username: username.slice(0, 64), ip, sucesso });
}
