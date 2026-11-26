import { drizzle } from "drizzle-orm/d1";
import { auditoria } from "../db/schema";

export async function registarAuditoria(
  d1: D1Database,
  utilizadorId: number,
  acao: string,
  entidade: string,
  entidadeId: number | null,
  detalhe?: unknown,
) {
  await drizzle(d1).insert(auditoria).values({
    utilizadorId, acao, entidade, entidadeId,
    detalhe: detalhe === undefined ? null : JSON.stringify(detalhe),
  });
}
