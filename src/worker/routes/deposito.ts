import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { exigirPerfil } from "../auth";
import { deposito, depositoMovimento } from "../db/schema";
import type { AppEnv } from "../env";
import { registarAuditoria } from "../lib/auditoria";
import { consumo, custoMedio, nivelAtual, obterDeposito } from "../lib/deposito";
import { hojeLisboa } from "../lib/seguranca";

export const depositoRota = new Hono<AppEnv>();
depositoRota.use("*", exigirPerfil("admin", "gestor", "consulta"));
const escreve = exigirPerfil("admin", "gestor");
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const r2 = (n: number) => Math.round(n * 100) / 100;

depositoRota.get("/", async (c) => {
  const d = await obterDeposito(c.env.DB);
  const nivel = await nivelAtual(c.env.DB, d.id);
  const [ult] = await drizzle(c.env.DB).select().from(depositoMovimento).where(and(eq(depositoMovimento.depositoId, d.id), eq(depositoMovimento.tipo, "ajuste"))).orderBy(desc(depositoMovimento.id)).limit(1);
  const cons = await consumo(c.env.DB, d.id, nivel);
  return c.json({
    deposito: d, nivelL: nivel, percentagem: Math.round((nivel / d.capacidadeL) * 100), abaixoDoMinimo: nivel < d.nivelMinimoL, custoMedioLitro: await custoMedio(c.env.DB, d.id), ...cons,
    ultimaContagem: ult ? { data: ult.data, diferencaL: ult.deltaLitros, medidoL: ult.medidoLitros, percentagem: ult.medidoLitros ? r2((ult.deltaLitros / (ult.medidoLitros - ult.deltaLitros)) * 100) : null } : null,
  });
});

depositoRota.get("/movimentos", async (c) => {
  const d = await obterDeposito(c.env.DB);
  const tipo = c.req.query("tipo"); const antes = Number(c.req.query("antes") ?? 0);
  const filtros = [eq(depositoMovimento.depositoId, d.id), tipo ? eq(depositoMovimento.tipo, tipo as "entrada") : undefined, antes ? lt(depositoMovimento.id, antes) : undefined].filter(Boolean);
  return c.json(await drizzle(c.env.DB).select().from(depositoMovimento).where(and(...filtros)).orderBy(desc(depositoMovimento.id)).limit(50));
});

depositoRota.patch("/", escreve, zValidator("json", z.object({ nome: z.string().trim().min(2).max(60).optional(), capacidadeL: z.number().positive().optional(), nivelMinimoL: z.number().min(0).optional(), toleranciaPct: z.number().min(0).max(20).optional() })), async (c) => {
  const d = await obterDeposito(c.env.DB); const alt = c.req.valid("json");
  if (Object.keys(alt).length === 0) return c.json({ erro: "Nada para alterar" }, 400);
  const [n] = await drizzle(c.env.DB).update(deposito).set(alt).where(eq(deposito.id, d.id)).returning();
  await registarAuditoria(c.env.DB, c.get("user").id, "editar", "deposito", d.id, alt);
  return c.json(n);
});

depositoRota.post("/entradas", escreve, zValidator("json", z.object({ data: data.optional(), litros: z.number().positive().max(100000), precoLitro: z.number().positive().max(20), fornecedor: z.string().trim().max(100).nullish(), guia: z.string().trim().max(60).nullish(), motivo: z.string().trim().max(300).nullish() })), async (c) => {
  const d = await obterDeposito(c.env.DB); const b = c.req.valid("json"); const eu = c.get("user");
  const nivel = await nivelAtual(c.env.DB, d.id);
  if (nivel + b.litros > d.capacidadeL) return c.json({ erro: `A entrega excede a capacidade (${d.capacidadeL} l). Cabem mais ${r2(d.capacidadeL - nivel)} l.` }, 422);
  const [m] = await drizzle(c.env.DB).insert(depositoMovimento).values({ depositoId: d.id, tipo: "entrada", data: b.data ?? hojeLisboa(), deltaLitros: b.litros, precoLitro: b.precoLitro, fornecedor: b.fornecedor ?? null, guia: b.guia ?? null, motivo: b.motivo ?? null, utilizadorId: eu.id }).returning();
  await registarAuditoria(c.env.DB, eu.id, "entrada", "deposito", m.id, { litros: b.litros });
  return c.json({ movimento: m, nivelL: await nivelAtual(c.env.DB, d.id), custoMedioLitro: await custoMedio(c.env.DB, d.id) }, 201);
});

// Saidas que nao sao abastecimentos de veiculos (geradores, maquinas...).
depositoRota.post("/saidas", escreve, zValidator("json", z.object({ data: data.optional(), litros: z.number().positive().max(100000), motivo: z.string().trim().min(3).max(300), veiculoId: z.number().int().nullish() })), async (c) => {
  const d = await obterDeposito(c.env.DB); const b = c.req.valid("json"); const eu = c.get("user");
  const [m] = await drizzle(c.env.DB).insert(depositoMovimento).values({ depositoId: d.id, tipo: "saida", data: b.data ?? hojeLisboa(), deltaLitros: -b.litros, motivo: b.motivo, veiculoId: b.veiculoId ?? null, utilizadorId: eu.id }).returning();
  await registarAuditoria(c.env.DB, eu.id, "saida", "deposito", m.id, { litros: b.litros });
  const nivel = await nivelAtual(c.env.DB, d.id);
  return c.json({ movimento: m, nivelL: nivel, aviso: nivel < 0 ? "O nível calculado ficou negativo. Confirme as entradas em falta." : undefined }, 201);
});

// Contagem fisica: o ajuste e a diferenca entre o medido e o calculado.
depositoRota.post("/contagens", escreve, zValidator("json", z.object({ data: data.optional(), medidoLitros: z.number().min(0).max(100000), notas: z.string().trim().max(300).nullish() })), async (c) => {
  const d = await obterDeposito(c.env.DB); const b = c.req.valid("json"); const eu = c.get("user");
  const calculado = await nivelAtual(c.env.DB, d.id);
  const diferenca = r2(b.medidoLitros - calculado);
  const pct = calculado > 0 ? r2((diferenca / calculado) * 100) : null;
  const [m] = await drizzle(c.env.DB).insert(depositoMovimento).values({ depositoId: d.id, tipo: "ajuste", data: b.data ?? hojeLisboa(), deltaLitros: diferenca, medidoLitros: b.medidoLitros, motivo: b.notas ?? "Contagem física", utilizadorId: eu.id }).returning();
  await registarAuditoria(c.env.DB, eu.id, "contagem", "deposito", m.id, { calculado, medido: b.medidoLitros, diferenca });
  return c.json({ movimento: m, calculadoL: calculado, diferencaL: diferenca, percentagem: pct, dentroDaTolerancia: pct === null ? true : Math.abs(pct) <= d.toleranciaPct }, 201);
});

// Anular = novo movimento inverso (nunca se apaga nem edita um movimento).
depositoRota.post("/movimentos/:id/anular", escreve, zValidator("json", z.object({ motivo: z.string().trim().min(3).max(300) })), async (c) => {
  const id = Number(c.req.param("id")); const eu = c.get("user"); const db = drizzle(c.env.DB);
  const [m] = await db.select().from(depositoMovimento).where(eq(depositoMovimento.id, id)).limit(1);
  if (!m) return c.json({ erro: "Nao encontrado" }, 404);
  if (m.anulaMovimentoId) return c.json({ erro: "Este movimento já é uma anulação." }, 422);
  const [ja] = await db.select({ id: depositoMovimento.id }).from(depositoMovimento).where(eq(depositoMovimento.anulaMovimentoId, id)).limit(1);
  if (ja) return c.json({ erro: "Este movimento já foi anulado." }, 422);
  const [n] = await db.insert(depositoMovimento).values({ depositoId: m.depositoId, tipo: "ajuste", data: hojeLisboa(), deltaLitros: -m.deltaLitros, anulaMovimentoId: id, motivo: `Anulação: ${c.req.valid("json").motivo}`, utilizadorId: eu.id }).returning();
  await registarAuditoria(c.env.DB, eu.id, "anular", "deposito", id, { motivo: c.req.valid("json").motivo });
  return c.json({ movimento: n, nivelL: await nivelAtual(c.env.DB, m.depositoId) }, 201);
});
