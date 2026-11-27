import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { deposito, depositoMovimento } from "../db/schema";

export async function obterDeposito(d1: D1Database) {
  const db = drizzle(d1);
  const [d] = await db.select().from(deposito).limit(1);
  if (d) return d;
  // Primeiro uso: cria o deposito com valores iniciais (a gestao ajusta em Definicoes).
  const [n] = await db.insert(deposito).values({ nome: "Depósito do parque", combustivel: "Gasóleo", capacidadeL: 10000, nivelMinimoL: 1500, toleranciaPct: 1 }).returning();
  return n;
}

/** Nivel = soma dos movimentos (nao e guardado: nao pode ficar desatualizado). */
export async function nivelAtual(d1: D1Database, depositoId: number): Promise<number> {
  const [r] = await drizzle(d1).select({ n: sql<number>`COALESCE(SUM(${depositoMovimento.deltaLitros}), 0)` }).from(depositoMovimento).where(eq(depositoMovimento.depositoId, depositoId));
  return Math.round((r?.n ?? 0) * 100) / 100;
}

/** Custo medio ponderado das entradas dos ultimos 180 dias (ou, se nao houver, da ultima entrada). */
export async function custoMedio(d1: D1Database, depositoId: number): Promise<number | null> {
  const desde = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
  const q = (filtro: string) => d1.prepare(`SELECT SUM(delta_litros * preco_litro) AS c, SUM(delta_litros) AS l FROM deposito_movimento WHERE deposito_id = ?1 AND tipo = 'entrada' AND preco_litro IS NOT NULL AND anula_movimento_id IS NULL AND id NOT IN (SELECT anula_movimento_id FROM deposito_movimento WHERE anula_movimento_id IS NOT NULL) ${filtro}`);
  let r = await q("AND data >= ?2").bind(depositoId, desde).first<{ c: number | null; l: number | null }>();
  if (!r?.l) r = await q("AND id = (SELECT MAX(id) FROM deposito_movimento WHERE deposito_id = ?1 AND tipo = 'entrada' AND preco_litro IS NOT NULL)").bind(depositoId).first<{ c: number | null; l: number | null }>();
  return r?.l ? Math.round((r.c! / r.l) * 10000) / 10000 : null;
}

/** Media diaria de saidas nos ultimos 30 dias e autonomia estimada. */
export async function consumo(d1: D1Database, depositoId: number, nivel: number) {
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const r = await d1.prepare("SELECT COALESCE(SUM(-delta_litros),0) AS l FROM deposito_movimento WHERE deposito_id = ?1 AND tipo = 'saida' AND data >= ?2").bind(depositoId, desde).first<{ l: number }>();
  const diaria = Math.round(((r?.l ?? 0) / 30) * 10) / 10;
  return { mediaDiariaL: diaria, autonomiaDias: diaria > 0 ? Math.floor(nivel / diaria) : null };
}
