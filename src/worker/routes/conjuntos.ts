import { hojeLisboa } from "../lib/seguranca";
import { zValidator } from "@hono/zod-validator";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { soGestao } from "../auth";
import { associacaoConjunto, veiculo } from "../db/schema";
import type { AppEnv } from "../env";
import { registarAuditoria } from "../lib/auditoria";
import { eUnico } from "../lib/erros";
import { validarAssociacao } from "../lib/conjuntos";

export const conjuntos = new Hono<AppEnv>();

const hoje = () => hojeLisboa();
const ativa = sql`${associacaoConjunto.dataFim} IS NULL`;

// Conjuntos ativos (gestao).
conjuntos.get("/", soGestao, async (c) => {
  const db = drizzle(c.env.DB);
  return c.json(await db.select().from(associacaoConjunto).where(ativa));
});

// Historico de associacoes de um veiculo (como trator ou reboque).
conjuntos.get("/veiculo/:id", soGestao, async (c) => {
  const id = Number(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const linhas = await db
    .select()
    .from(associacaoConjunto)
    .where(sql`${associacaoConjunto.tratorId} = ${id} OR ${associacaoConjunto.reboqueId} = ${id}`)
    .orderBy(sql`${associacaoConjunto.dataInicio} DESC`);
  return c.json(linhas);
});

const associar = z.object({
  tratorId: z.number().int().positive(),
  reboqueId: z.number().int().positive(),
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  motivo: z.string().max(300).nullish(),
});

conjuntos.post("/", soGestao, zValidator("json", associar), async (c) => {
  const { tratorId, reboqueId, dataInicio, motivo } = c.req.valid("json");
  const db = drizzle(c.env.DB);
  const sel = { id: veiculo.id, matricula: veiculo.matricula, tipo: veiculo.tipo, categoria: veiculo.categoria, estado: veiculo.estado };
  const [trator] = await db.select(sel).from(veiculo).where(eq(veiculo.id, tratorId)).limit(1);
  const [reboque] = await db.select(sel).from(veiculo).where(eq(veiculo.id, reboqueId)).limit(1);
  if (!trator || !reboque) return c.json({ erro: "Veiculo nao encontrado" }, 404);

  const ativas = await db
    .select({ tratorId: associacaoConjunto.tratorId, reboqueId: associacaoConjunto.reboqueId })
    .from(associacaoConjunto)
    .where(ativa);
  const r = validarAssociacao(trator, reboque, ativas);
  if (!r.ok) return c.json({ erro: r.erro }, 422);

  try {
    const [nova] = await db
      .insert(associacaoConjunto)
      .values({ tratorId, reboqueId, dataInicio: dataInicio ?? hoje(), motivo: motivo ?? null, criadoPor: c.get("user").id })
      .returning();
    await registarAuditoria(c.env.DB, c.get("user").id, "associar", "conjunto", nova.id, { tratorId, reboqueId, motivo });
    return c.json(nova, 201);
  } catch (e) {
    // Os indices unicos parciais garantem a regra mesmo com pedidos em simultaneo.
    if (eUnico(e)) return c.json({ erro: "Veiculo ja tem uma associacao ativa" }, 409);
    throw e;
  }
});

conjuntos.post("/:id/terminar", soGestao, zValidator("json", z.object({ motivo: z.string().max(300).nullish() })), async (c) => {
  const id = Number(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const [fechada] = await db
    .update(associacaoConjunto)
    .set({ dataFim: hoje(), motivo: c.req.valid("json").motivo ?? sql`${associacaoConjunto.motivo}` })
    .where(and(eq(associacaoConjunto.id, id), ativa))
    .returning();
  if (!fechada) return c.json({ erro: "Associacao ativa nao encontrada" }, 404);
  await registarAuditoria(c.env.DB, c.get("user").id, "terminar", "conjunto", id);
  return c.json(fechada);
});
