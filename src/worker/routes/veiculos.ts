import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { ESTADOS_VEICULO, TIPOS_VEICULO } from "../../shared/dominio";
import { soGestao } from "../auth";
import { associacaoConjunto, veiculo } from "../db/schema";
import type { AppEnv, Utilizador } from "../env";
import { registarAuditoria } from "../lib/auditoria";
import { veiculoParaPerfil } from "../lib/dto";
import { eUnico } from "../lib/erros";

export const veiculos = new Hono<AppEnv>();

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data no formato AAAA-MM-DD");

const corpo = z.object({
  matricula: z.string().trim().min(4).max(12).transform((s) => s.toUpperCase()),
  tipo: z.enum(TIPOS_VEICULO),
  categoria: z.string().trim().max(8).nullish(),
  marca: z.string().trim().max(60).nullish(),
  modelo: z.string().trim().max(60).nullish(),
  proprietario: z.string().trim().max(80).nullish(),
  vin: z.string().trim().max(30).nullish(),
  combustivel: z.string().trim().max(30).nullish(),
  dataMatricula: data.nullish(),
  dataAquisicao: data.nullish(),
  estado: z.enum(ESTADOS_VEICULO).optional(),
  ensino: z.boolean().optional(),
  comandoDuplo: z.boolean().optional(),
  pesoBruto: z.number().int().positive().nullish(),
  lugares: z.number().int().positive().nullish(),
  cilindrada: z.number().int().positive().nullish(),
  usaHoras: z.boolean().optional(),
  kmAtuais: z.number().int().nonnegative().nullish(),
  horasAtuais: z.number().nonnegative().nullish(),
  iucAplicavel: z.boolean().optional(),
  ipoPeriodicidadeMeses: z.number().int().positive().nullish(),
  seguroCobertoPeloTrator: z.boolean().optional(),
  instrutorId: z.number().int().positive().nullish(),
  notas: z.string().max(2000).nullish(),
  cor: z.string().trim().max(40).nullish(),
  potenciaKw: z.number().int().positive().nullish(),
  tara: z.number().int().positive().nullish(),
  pneus: z.string().trim().max(60).nullish(),
  tacografo: z.boolean().optional(),
  valorAquisicao: z.number().nonnegative().nullish(),
  fornecedor: z.string().trim().max(100).nullish(),
  cartaoCombustivel: z.string().trim().max(40).nullish(),
  localizacao: z.string().trim().max(100).nullish(),
  dataAbate: data.nullish(),
});

/** IDs de veiculos que um instrutor pode ver: os seus e os reboques dos seus tratores. */
export async function idsVisiveis(d1: D1Database, u: Utilizador): Promise<number[] | "todos"> {
  if (u.perfil !== "instrutor") return "todos";
  const db = drizzle(d1);
  const meus = await db.select({ id: veiculo.id }).from(veiculo).where(eq(veiculo.instrutorId, u.id));
  const ids = meus.map((m) => m.id);
  if (ids.length === 0) return [];
  const reboques = await db
    .select({ id: associacaoConjunto.reboqueId })
    .from(associacaoConjunto)
    .where(and(inArray(associacaoConjunto.tratorId, ids), sql`${associacaoConjunto.dataFim} IS NULL`));
  return [...ids, ...reboques.map((r) => r.id)];
}

veiculos.get("/", async (c) => {
  const db = drizzle(c.env.DB);
  const { tipo, estado, categoria, proprietario, q } = c.req.query();
  const visiveis = await idsVisiveis(c.env.DB, c.get("user"));
  if (visiveis !== "todos" && visiveis.length === 0) return c.json([]);

  const filtros = [
    visiveis === "todos" ? undefined : inArray(veiculo.id, visiveis),
    tipo ? eq(veiculo.tipo, tipo as (typeof TIPOS_VEICULO)[number]) : undefined,
    estado ? eq(veiculo.estado, estado as (typeof ESTADOS_VEICULO)[number]) : undefined,
    categoria ? eq(veiculo.categoria, categoria) : undefined,
    proprietario ? eq(veiculo.proprietario, proprietario) : undefined,
    q ? or(like(veiculo.matricula, `%${q}%`), like(veiculo.marca, `%${q}%`), like(veiculo.modelo, `%${q}%`)) : undefined,
  ].filter(Boolean);
  const linhas = await db.select().from(veiculo).where(and(...filtros)).orderBy(veiculo.matricula);
  return c.json(linhas.map((l) => veiculoParaPerfil(l, c.get("user").perfil)));
});

veiculos.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const visiveis = await idsVisiveis(c.env.DB, c.get("user"));
  if (visiveis !== "todos" && !visiveis.includes(id)) return c.json({ erro: "Nao encontrado" }, 404);
  const [v] = await db.select().from(veiculo).where(eq(veiculo.id, id)).limit(1);
  if (!v) return c.json({ erro: "Nao encontrado" }, 404);
  const [conjunto] = await db
    .select()
    .from(associacaoConjunto)
    .where(
      and(
        sql`${associacaoConjunto.dataFim} IS NULL`,
        or(eq(associacaoConjunto.tratorId, id), eq(associacaoConjunto.reboqueId, id)),
      ),
    )
    .limit(1);
  return c.json({ ...veiculoParaPerfil(v, c.get("user").perfil), conjuntoAtivo: conjunto ?? null });
});

veiculos.post("/", soGestao, zValidator("json", corpo), async (c) => {
  const db = drizzle(c.env.DB);
  try {
    const [novo] = await db.insert(veiculo).values(c.req.valid("json")).returning();
    await registarAuditoria(c.env.DB, c.get("user").id, "criar", "veiculo", novo.id, { matricula: novo.matricula });
    return c.json(novo, 201);
  } catch (e) {
    if (eUnico(e)) return c.json({ erro: "Ja existe um veiculo com essa matricula" }, 409);
    throw e;
  }
});

veiculos.patch("/:id", soGestao, zValidator("json", corpo.partial().extend({ versao: z.number().int().positive().optional() })), async (c) => {
  const id = Number(c.req.param("id"));
  const { versao, ...alteracoes } = c.req.valid("json");
  if (Object.keys(alteracoes).length === 0) return c.json({ erro: "Nada para alterar" }, 400);
  const db = drizzle(c.env.DB);
  // Edicao simultanea: se indicar a versao e ela ja mudou, recusa em vez de apagar o trabalho de outra pessoa.
  const filtro = versao ? and(eq(veiculo.id, id), eq(veiculo.versao, versao)) : eq(veiculo.id, id);
  const [atualizado] = await db.update(veiculo).set({ ...alteracoes, versao: sql`${veiculo.versao} + 1` }).where(filtro).returning();
  if (!atualizado) {
    const [existe] = await db.select({ id: veiculo.id }).from(veiculo).where(eq(veiculo.id, id)).limit(1);
    return existe ? c.json({ erro: "Este veiculo foi alterado por outra pessoa. Recarregue e volte a tentar." }, 409) : c.json({ erro: "Nao encontrado" }, 404);
  }
  await registarAuditoria(c.env.DB, c.get("user").id, "editar", "veiculo", id, alteracoes);
  return c.json(atualizado);
});
