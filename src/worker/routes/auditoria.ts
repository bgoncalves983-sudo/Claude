import { and, desc, eq, like, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { exigirPerfil } from "../auth";
import { auditoria, utilizador } from "../db/schema";
import type { AppEnv } from "../env";

/** Registo de quem fez o que e quando. So administradores. */
export const auditoriaRota = new Hono<AppEnv>();
auditoriaRota.use("*", exigirPerfil("admin"));

auditoriaRota.get("/", async (c) => {
  const { entidade, acao, utilizadorId, antes, naoAssociado } = c.req.query();
  const limite = Math.min(Number(c.req.query("limite") ?? 50) || 50, 200);
  const filtros = [
    entidade ? eq(auditoria.entidade, entidade) : undefined,
    acao ? eq(auditoria.acao, acao) : undefined,
    utilizadorId ? eq(auditoria.utilizadorId, Number(utilizadorId)) : undefined,
    antes ? lt(auditoria.id, Number(antes)) : undefined,
    naoAssociado === "1" ? like(auditoria.detalhe, '%"naoAssociado":true%') : undefined,
  ].filter(Boolean);
  const linhas = await drizzle(c.env.DB)
    .select({ id: auditoria.id, criadoEm: auditoria.criadoEm, acao: auditoria.acao, entidade: auditoria.entidade, entidadeId: auditoria.entidadeId, detalhe: auditoria.detalhe, quem: utilizador.nome, quemId: auditoria.utilizadorId })
    .from(auditoria).leftJoin(utilizador, eq(utilizador.id, auditoria.utilizadorId))
    .where(and(...filtros)).orderBy(desc(auditoria.id)).limit(limite + 1);
  const temMais = linhas.length > limite;
  return c.json({ linhas: linhas.slice(0, limite), temMais });
});

/** Valores usados nos filtros do ecra. */
auditoriaRota.get("/filtros", async (c) => {
  const e = await c.env.DB.prepare("SELECT DISTINCT entidade FROM auditoria ORDER BY entidade").all<{ entidade: string }>();
  const a = await c.env.DB.prepare("SELECT DISTINCT acao FROM auditoria ORDER BY acao").all<{ acao: string }>();
  return c.json({ entidades: e.results.map((x) => x.entidade), acoes: a.results.map((x) => x.acao) });
});
