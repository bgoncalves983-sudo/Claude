import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { ESTADOS_VEICULO, TIPOS_VEICULO } from "../../shared/dominio";
import { soGestao } from "../auth";
import { associacaoConjunto, atribuicao, veiculo } from "../db/schema";
import type { AppEnv, Utilizador } from "../env";
import { registarAuditoria } from "../lib/auditoria";
import { veiculoParaPerfil } from "../lib/dto";
import { eUnico } from "../lib/erros";
import { hojeLisboa } from "../lib/seguranca";

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
  if (alteracoes.instrutorId !== undefined) {
    const [atual] = await db.select({ i: veiculo.instrutorId }).from(veiculo).where(eq(veiculo.id, id)).limit(1);
    if (atual && atual.i !== alteracoes.instrutorId) await registarAtribuicao(db, id, alteracoes.instrutorId ?? null);
  }
  const filtro = versao ? and(eq(veiculo.id, id), eq(veiculo.versao, versao)) : eq(veiculo.id, id);
  const [atualizado] = await db.update(veiculo).set({ ...alteracoes, versao: sql`${veiculo.versao} + 1` }).where(filtro).returning();
  if (!atualizado) {
    const [existe] = await db.select({ id: veiculo.id }).from(veiculo).where(eq(veiculo.id, id)).limit(1);
    return existe ? c.json({ erro: "Este veiculo foi alterado por outra pessoa. Recarregue e volte a tentar." }, 409) : c.json({ erro: "Nao encontrado" }, 404);
  }
  await registarAuditoria(c.env.DB, c.get("user").id, "editar", "veiculo", id, alteracoes);
  return c.json(atualizado);
});

/** Fecha a atribuicao em curso e abre a nova (historico de quem teve o veiculo, util para multas e responsabilidades). */
async function registarAtribuicao(db: ReturnType<typeof drizzle>, veiculoId: number, novo: number | null) {
  const hoje = hojeLisboa();
  await db.update(atribuicao).set({ fim: hoje }).where(and(eq(atribuicao.veiculoId, veiculoId), sql`${atribuicao.fim} IS NULL`));
  if (novo) await db.insert(atribuicao).values({ veiculoId, utilizadorId: novo, inicio: hoje });
}

veiculos.get("/:id/atribuicoes", soGestao, async (c) => {
  const lista = await drizzle(c.env.DB).select().from(atribuicao).where(eq(atribuicao.veiculoId, Number(c.req.param("id")))).orderBy(sql`${atribuicao.inicio} DESC`);
  return c.json(lista);
});

// ---------- Edicao em lote ----------
veiculos.post("/lote", soGestao, zValidator("json", z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
  alteracoes: corpo.pick({ tipo: true, categoria: true, proprietario: true, instrutorId: true, estado: true, ipoPeriodicidadeMeses: true, iucAplicavel: true, localizacao: true }).partial(),
})), async (c) => {
  const { ids, alteracoes } = c.req.valid("json");
  if (Object.keys(alteracoes).length === 0) return c.json({ erro: "Escolha pelo menos um campo a alterar." }, 400);
  if (alteracoes.instrutorId && ids.length > 1) return c.json({ erro: "Um instrutor so pode ficar com um veiculo de cada vez nesta operacao. Atribua um a um." }, 422);
  const db = drizzle(c.env.DB);
  let n = 0;
  for (const id of ids) {
    if (alteracoes.instrutorId !== undefined) await registarAtribuicao(db, id, alteracoes.instrutorId ?? null);
    const r = await db.update(veiculo).set({ ...alteracoes, versao: sql`${veiculo.versao} + 1` }).where(eq(veiculo.id, id)).returning({ id: veiculo.id });
    n += r.length;
  }
  await registarAuditoria(c.env.DB, c.get("user").id, "editar-lote", "veiculo", null, { ids, alteracoes });
  return c.json({ alterados: n });
});

// ---------- Abater / arquivar (nunca apaga: o historico mantem-se) ----------
veiculos.post("/:id/abater", soGestao, zValidator("json", z.object({
  motivo: z.enum(["vendido", "sucata", "roubado", "outro"]), data: data.optional(), valorVenda: z.number().nonnegative().nullish(), comprador: z.string().trim().max(100).nullish(), notas: z.string().trim().max(500).nullish(),
})), async (c) => {
  const id = Number(c.req.param("id")); const b = c.req.valid("json"); const db = drizzle(c.env.DB);
  const [v] = await db.select({ notas: veiculo.notas }).from(veiculo).where(eq(veiculo.id, id)).limit(1);
  if (!v) return c.json({ erro: "Nao encontrado" }, 404);
  const hoje = b.data ?? hojeLisboa();
  const nota = `Abatido (${b.motivo}) em ${hoje}${b.valorVenda != null ? `, venda ${b.valorVenda} EUR` : ""}${b.comprador ? ` a ${b.comprador}` : ""}${b.notas ? `. ${b.notas}` : ""}`;
  await db.update(veiculo).set({ estado: "abatido", dataAbate: hoje, instrutorId: null, notas: [v.notas, nota].filter(Boolean).join("\n"), versao: sql`${veiculo.versao} + 1` }).where(eq(veiculo.id, id));
  await registarAtribuicao(db, id, null);
  await db.update(associacaoConjunto).set({ dataFim: hoje, motivo: "Veiculo abatido" }).where(and(sql`${associacaoConjunto.dataFim} IS NULL`, or(eq(associacaoConjunto.tratorId, id), eq(associacaoConjunto.reboqueId, id))));
  await registarAuditoria(c.env.DB, c.get("user").id, "abater", "veiculo", id, b);
  return c.json({ ok: true });
});
veiculos.post("/:id/reativar", soGestao, async (c) => {
  const id = Number(c.req.param("id"));
  const [n] = await drizzle(c.env.DB).update(veiculo).set({ estado: "ativo", dataAbate: null, versao: sql`${veiculo.versao} + 1` }).where(eq(veiculo.id, id)).returning({ id: veiculo.id });
  if (!n) return c.json({ erro: "Nao encontrado" }, 404);
  await registarAuditoria(c.env.DB, c.get("user").id, "reativar", "veiculo", id);
  return c.json({ ok: true });
});

// ---------- Importacao (CSV/Excel convertido no telemovel ou PC): pre-visualizacao e confirmacao ----------
const semAcentos = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const TIPO_ALIAS: Record<string, (typeof TIPOS_VEICULO)[number]> = { mota: "mota", motociclo: "mota", ligeiro: "ligeiro", automovel: "ligeiro", carro: "ligeiro", pesado: "pesado", camiao: "pesado", autocarro: "pesado", reboque: "reboque", semirreboque: "reboque", trator: "trator_maquina", maquina: "trator_maquina", "trator/maquina": "trator_maquina", trator_maquina: "trator_maquina" };
function normData(x: unknown): string | null | undefined {
  if (x === undefined || x === null || String(x).trim() === "") return undefined;
  const t = String(x).trim();
  const m = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}
const txt = (x: unknown) => (x === undefined || x === null || String(x).trim() === "" ? undefined : String(x).trim());

veiculos.post("/importar", soGestao, zValidator("json", z.object({ linhas: z.array(z.record(z.string(), z.unknown())).min(1).max(500), confirmar: z.boolean().optional() })), async (c) => {
  const db = drizzle(c.env.DB);
  const existentes = new Map((await db.select({ m: veiculo.matricula, id: veiculo.id }).from(veiculo)).map((x) => [x.m, x.id]));
  const vistos = new Set<string>();
  const resultado: { linha: number; matricula: string; acao: "novo" | "atualizar" | "erro"; erro?: string; dados?: Record<string, unknown> }[] = [];
  c.req.valid("json").linhas.forEach((l, i) => {
    const matricula = (txt(l.matricula) ?? "").toUpperCase().replace(/\s+/g, "");
    const erro = (e: string) => resultado.push({ linha: i + 2, matricula, acao: "erro", erro: e });
    if (matricula.length < 4) return erro("Matrícula em falta.");
    if (vistos.has(matricula)) return erro("Matrícula repetida no ficheiro.");
    vistos.add(matricula);
    const existe = existentes.has(matricula);
    const tipoTxt = txt(l.tipo);
    const tipo = tipoTxt ? TIPO_ALIAS[semAcentos(tipoTxt)] : undefined;
    if (tipoTxt && !tipo) return erro(`Tipo desconhecido: ${tipoTxt}.`);
    if (!existe && !tipo) return erro("Tipo em falta (mota, ligeiro, pesado, reboque, trator).");
    const dm = normData(l.dataMatricula);
    if (dm === null) return erro("Data de matrícula inválida (use dd/mm/aaaa).");
    const dados: Record<string, unknown> = { tipo, categoria: txt(l.categoria), marca: txt(l.marca), modelo: txt(l.modelo), proprietario: txt(l.proprietario), cor: txt(l.cor), combustivel: txt(l.combustivel), vin: txt(l.vin), dataMatricula: dm };
    for (const k of Object.keys(dados)) if (dados[k] === undefined) delete dados[k];
    resultado.push({ linha: i + 2, matricula, acao: existe ? "atualizar" : "novo", dados });
  });
  const resumo = { novos: resultado.filter((r) => r.acao === "novo").length, atualizar: resultado.filter((r) => r.acao === "atualizar").length, erros: resultado.filter((r) => r.acao === "erro").length };
  if (!c.req.valid("json").confirmar) return c.json({ ...resumo, linhas: resultado });
  // Confirmar: aplica as linhas validas; as com erro ficam de fora.
  for (const r of resultado) {
    if (r.acao === "novo") await db.insert(veiculo).values({ matricula: r.matricula, tipo: r.dados!.tipo as "ligeiro", ...(r.dados as object) });
    else if (r.acao === "atualizar" && Object.keys(r.dados!).length) await db.update(veiculo).set({ ...(r.dados as object), versao: sql`${veiculo.versao} + 1` }).where(eq(veiculo.matricula, r.matricula));
  }
  await registarAuditoria(c.env.DB, c.get("user").id, "importar", "veiculo", null, resumo);
  return c.json({ ...resumo, aplicado: true });
});
