import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { abastecimento, avaria, depositoMovimento, inspecao, iuc, manutencao, multa, seguro, sinistro, veiculo, verificacaoDiaria } from "../db/schema";
import type { AppEnv, Utilizador } from "../env";
import { registarAuditoria } from "../lib/auditoria";
import { custoMedio, obterDeposito } from "../lib/deposito";
import { eUnico } from "../lib/erros";
import { hojeLisboa } from "../lib/seguranca";
import { notificarAvaria } from "../lib/notificar";
import { fotosDasAvarias } from "./avariaFotos";
import { idsVisiveis, podeRegistarNoutro } from "./veiculos";

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data no formato AAAA-MM-DD");
const GESTAO = ["admin", "gestor"] as const;
const LEITURA_FINANCEIRA = ["admin", "gestor", "consulta"] as const;
const num = (min = 0) => z.number().min(min);

interface Recurso {
  nome: string; // caminho: /api/veiculos/:veiculoId/<nome>
  tabela: any; // tabela Drizzle (com veiculoId e id)
  criar: z.ZodObject<any>;
  ler: readonly string[];
  escrever: readonly string[];
  ordem: any;
  /** Antes de gravar: acrescenta campos do servidor. Pode devolver { erro } para recusar. */
  preparar?: (d: Record<string, any>, ctx: { c: any; eu: Utilizador; veiculoId: number }) => Promise<Record<string, any> | { erro: string; estado?: number }>;
  /** Depois de gravar. */
  depois?: (linha: any, ctx: { c: any; eu: Utilizador; veiculoId: number }) => Promise<Record<string, unknown> | void>;
  /** Acrescenta dados a cada linha da lista (ex.: fotografias de uma avaria). */
  enriquecer?: (linhas: any[], eu: Utilizador, d1: D1Database) => Promise<any[]>;
  /** Campos que o instrutor nunca recebe (ex.: valores em euros). */
  ocultarAoInstrutor?: string[];
}

function criarRouter(r: Recurso) {
  const app = new Hono<AppEnv>();
  const limpar = (linha: any, eu: Utilizador) => {
    if (eu.perfil !== "instrutor" || !r.ocultarAoInstrutor || !linha) return linha;
    const c = { ...linha }; for (const k of r.ocultarAoInstrutor) delete c[k]; return c;
  };

  // Visibilidade: o instrutor so acede aos seus veiculos.
  app.use("*", async (c, next) => {
    const eu = c.get("user");
    const metodo = c.req.method;
    const permitidos = metodo === "GET" ? r.ler : r.escrever;
    if (!permitidos.includes(eu.perfil)) return c.json({ erro: "Sem permissão" }, 403);
    const vid = Number(c.req.param("veiculoId"));
    const vis = await idsVisiveis(c.env.DB, eu);
    if (vis !== "todos" && !vis.includes(vid)) {
      // Excecao: registar (nunca ler) noutro veiculo, se o instrutor tiver 0 ou 1 veiculo atribuido.
      const registo = metodo === "POST" && eu.perfil === "instrutor" && ["abastecimentos", "avarias", "verificacoes"].includes(r.nome);
      if (!registo || !(await podeRegistarNoutro(c.env.DB, eu, vid))) return c.json({ erro: "Não encontrado" }, 404);
      c.set("naoAssociado", true);
    }
    await next();
  });

  app.get("/", async (c) => {
    const vid = Number(c.req.param("veiculoId"));
    const eu = c.get("user");
    let linhas = (await drizzle(c.env.DB).select().from(r.tabela).where(eq(r.tabela.veiculoId, vid)).orderBy(r.ordem).limit(500)) as any[];
    if (r.enriquecer) linhas = await r.enriquecer(linhas, eu, c.env.DB);
    return c.json(linhas.map((l) => limpar(l, eu)));
  });

  app.post("/", zValidator("json", r.criar), async (c) => {
    const eu = c.get("user"); const veiculoId = Number(c.req.param("veiculoId"));
    const db = drizzle(c.env.DB);
    let dados: Record<string, any> = { ...c.req.valid("json"), veiculoId };
    if (r.preparar) {
      const p = await r.preparar(dados, { c, eu, veiculoId });
      if ("erro" in p) return c.json({ erro: p.erro }, (p.estado ?? 422) as 422);
      dados = p;
    }
    // Idempotencia: um registo reenviado (rede fraca) devolve o que ja existe.
    if (dados.clienteId && r.tabela.clienteId) {
      const [ja] = (await db.select().from(r.tabela).where(eq(r.tabela.clienteId, dados.clienteId)).limit(1)) as any[];
      if (ja) return c.json({ registo: limpar(ja, eu), repetido: true }, 200);
    }
    try {
      const [nova] = (await db.insert(r.tabela).values(dados).returning()) as any[];
      const extra = (await r.depois?.(nova, { c, eu, veiculoId })) ?? {};
      await registarAuditoria(c.env.DB, eu.id, "criar", r.nome, nova.id, { veiculoId, ...(c.get("naoAssociado") ? { naoAssociado: true } : {}) });
      return c.json({ registo: limpar(nova, eu), ...extra }, 201);
    } catch (e) {
      if (eUnico(e)) return c.json({ erro: "Já existe um registo igual." }, 409);
      throw e;
    }
  });

  app.patch("/:id", zValidator("json", r.criar.partial()), async (c) => {
    const eu = c.get("user");
    if (!GESTAO.includes(eu.perfil as any)) return c.json({ erro: "Sem permissão" }, 403);
    const id = Number(c.req.param("id")); const vid = Number(c.req.param("veiculoId"));
    const alt = c.req.valid("json");
    if (Object.keys(alt).length === 0) return c.json({ erro: "Nada para alterar" }, 400);
    const extra: Record<string, unknown> = {};
    if (r.nome === "avarias" && (alt as any).estado === "resolvida") extra.dataResolucao = hojeLisboa();
    try {
      const [n] = (await drizzle(c.env.DB).update(r.tabela).set({ ...alt, ...extra }).where(and(eq(r.tabela.id, id), eq(r.tabela.veiculoId, vid))).returning()) as any[];
      if (!n) return c.json({ erro: "Não encontrado" }, 404);
      await registarAuditoria(c.env.DB, eu.id, "editar", r.nome, id, alt);
      return c.json(n);
    } catch (e) { if (eUnico(e)) return c.json({ erro: "Já existe um registo igual." }, 409); throw e; }
  });

  app.delete("/:id", async (c) => {
    const eu = c.get("user");
    if (!GESTAO.includes(eu.perfil as any)) return c.json({ erro: "Sem permissão" }, 403);
    const id = Number(c.req.param("id")); const vid = Number(c.req.param("veiculoId"));
    if (r.nome === "abastecimentos") {
      // Um abastecimento do deposito tem movimento associado: anula-se em vez de apagar.
      const [a] = await drizzle(c.env.DB).select().from(abastecimento).where(eq(abastecimento.id, id)).limit(1);
      if (a?.origem === "deposito") return c.json({ erro: "Abastecimento do depósito: anule o movimento no depósito." }, 422);
    }
    const [x] = (await drizzle(c.env.DB).delete(r.tabela).where(and(eq(r.tabela.id, id), eq(r.tabela.veiculoId, vid))).returning()) as any[];
    if (!x) return c.json({ erro: "Não encontrado" }, 404);
    await registarAuditoria(c.env.DB, eu.id, "apagar", r.nome, id, { veiculoId: vid });
    return c.json({ ok: true });
  });
  return app;
}

/** Atualiza os contadores do veiculo se o novo valor for maior (e avisa se for menor). */
async function atualizarContador(d1: D1Database, veiculoId: number, km?: number | null, horas?: number | null): Promise<string | undefined> {
  const db = drizzle(d1);
  const [v] = await db.select({ km: veiculo.kmAtuais, h: veiculo.horasAtuais }).from(veiculo).where(eq(veiculo.id, veiculoId)).limit(1);
  if (!v) return;
  const sets: Record<string, number> = {};
  let aviso: string | undefined;
  if (km != null) { if (v.km != null && km < v.km) aviso = `Os quilómetros (${km}) são inferiores aos últimos registados (${v.km}). Confirme o valor.`; else if (v.km != null && km - v.km > 3000) aviso = `Mais ${km - v.km} km desde o último registo. Confirme o valor.`; if (v.km == null || km > v.km) sets.kmAtuais = km; }
  if (horas != null && (v.h == null || horas > v.h)) sets.horasAtuais = horas;
  if (Object.keys(sets).length) await db.update(veiculo).set(sets).where(eq(veiculo.id, veiculoId));
  return aviso;
}

export const seguros = criarRouter({
  nome: "seguros", tabela: seguro, ordem: desc(seguro.dataFim), ler: LEITURA_FINANCEIRA, escrever: GESTAO,
  criar: z.object({ seguradora: z.string().trim().min(1).max(80), apolice: z.string().trim().min(1).max(60), cobertura: z.string().trim().max(120).nullish(), premio: num().nullish(), periodicidade: z.string().max(20).nullish(), dataInicio: data, dataFim: data }),
  preparar: async (d) => (d.dataFim < d.dataInicio ? { erro: "A data de fim é anterior à de início." } : d),
});
export const iucs = criarRouter({
  nome: "iuc", tabela: iuc, ordem: desc(iuc.ano), ler: LEITURA_FINANCEIRA, escrever: GESTAO,
  criar: z.object({ ano: z.number().int().min(2000).max(2100), valor: num().nullish(), dataLimite: data, pago: z.boolean().optional(), dataPagamento: data.nullish() }),
});
export const inspecoes = criarRouter({
  nome: "inspecoes", tabela: inspecao, ordem: desc(inspecao.data), ler: LEITURA_FINANCEIRA, escrever: GESTAO,
  criar: z.object({ data, resultado: z.enum(["aprovado", "reprovado", "condicionado"]), km: z.number().int().min(0).nullish(), centro: z.string().trim().max(80).nullish(), custo: num().nullish(), proximaData: data.nullish() }),
  // Sem proxima data indicada, calcula-se pela periodicidade do veiculo.
  preparar: async (d, { c, veiculoId }) => {
    if (!d.proximaData && d.resultado === "aprovado") {
      const [v] = await drizzle(c.env.DB).select({ m: veiculo.ipoPeriodicidadeMeses }).from(veiculo).where(eq(veiculo.id, veiculoId)).limit(1);
      if (v?.m) { const x = new Date(d.data + "T12:00:00Z"); x.setUTCMonth(x.getUTCMonth() + v.m); d.proximaData = x.toISOString().slice(0, 10); }
    }
    return d;
  },
});
export const manutencoes = criarRouter({
  nome: "manutencoes", tabela: manutencao, ordem: desc(manutencao.data), ler: LEITURA_FINANCEIRA, escrever: GESTAO,
  criar: z.object({ tipo: z.enum(["preventiva", "corretiva"]), data, km: z.number().int().min(0).nullish(), horas: num().nullish(), oficina: z.string().trim().max(80).nullish(), descricao: z.string().trim().max(500).nullish(), custo: num().nullish(), avariaId: z.number().int().nullish(), proximaData: data.nullish(), proximoKm: z.number().int().nullish(), proximasHoras: num().nullish() }),
  depois: async (l, { c, veiculoId }) => { await atualizarContador(c.env.DB, veiculoId, l.km, l.horas); },
});
export const sinistros = criarRouter({
  nome: "sinistros", tabela: sinistro, ordem: desc(sinistro.data), ler: LEITURA_FINANCEIRA, escrever: GESTAO,
  criar: z.object({ data, descricao: z.string().trim().min(2).max(500), condutorId: z.number().int().nullish(), participacao: z.string().trim().max(60).nullish(), estado: z.enum(["aberto", "em_analise", "encerrado"]).optional(), valor: num().nullish() }),
});
export const multas = criarRouter({
  nome: "multas", tabela: multa, ordem: desc(multa.data), ler: LEITURA_FINANCEIRA, escrever: GESTAO,
  criar: z.object({ data, auto: z.string().trim().max(60).nullish(), local: z.string().trim().max(120).nullish(), valor: num().nullish(), condutorId: z.number().int().nullish(), limitePagamento: data.nullish(), estado: z.enum(["por_pagar", "paga", "contestada"]).optional() }),
});

export const abastecimentos = criarRouter({
  nome: "abastecimentos", ocultarAoInstrutor: ["valor", "depositoId"], tabela: abastecimento, ordem: desc(abastecimento.data), ler: ["admin", "gestor", "consulta", "instrutor"], escrever: ["admin", "gestor", "instrutor"],
  criar: z.object({
    data: data.optional(), litros: z.number().positive().max(2000), km: z.number().int().min(0).nullish(), horas: num().nullish(),
    origem: z.enum(["deposito", "posto"]), valor: num().nullish(), posto: z.string().trim().max(80).nullish(), clienteId: z.string().min(8).max(64).optional(),
  }),
  preparar: async (d, { c, eu }) => {
    const base = { ...d, data: d.data ?? hojeLisboa(), utilizadorId: eu.id, criadoEm: new Date().toISOString() };
    if (d.origem === "deposito") {
      // Custo calculado pelo custo medio do gasoleo: o instrutor nao precisa de saber valores.
      const dep = await obterDeposito(c.env.DB);
      const cm = await custoMedio(c.env.DB, dep.id);
      return { ...base, depositoId: dep.id, valor: cm ? Math.round(d.litros * cm * 100) / 100 : 0, posto: null };
    }
    if (d.valor == null) return { erro: "Indique o valor pago." };
    return base;
  },
  depois: async (l, { c, eu, veiculoId }) => {
    const aviso = await atualizarContador(c.env.DB, veiculoId, l.km, l.horas);
    if (l.origem === "deposito") {
      try {
        await drizzle(c.env.DB).insert(depositoMovimento).values({ depositoId: l.depositoId, tipo: "saida", data: l.data, deltaLitros: -l.litros, veiculoId, utilizadorId: eu.id, abastecimentoId: l.id });
      } catch (e) { await drizzle(c.env.DB).delete(abastecimento).where(eq(abastecimento.id, l.id)); throw e; } // nunca fica um abastecimento sem a sua saida
    }
    return aviso ? { aviso } : {};
  },
});

export const avarias = criarRouter({
  nome: "avarias", tabela: avaria, ordem: desc(avaria.dataReporte), ler: ["admin", "gestor", "consulta", "instrutor"], escrever: ["admin", "gestor", "instrutor"],
  criar: z.object({ descricao: z.string().trim().min(3).max(600), estado: z.enum(["reportada", "em_analise", "em_reparacao", "resolvida"]).optional(), clienteId: z.string().min(8).max(64).optional() }),
  // O instrutor so reporta: o estado e gerido pela gestao.
  preparar: async (d, { eu }) => ({ ...d, estado: eu.perfil === "instrutor" ? "reportada" : (d.estado ?? "reportada"), reportadoPor: eu.id }),
  depois: async (l, { c }) => { c.executionCtx.waitUntil(notificarAvaria(c.env, l.id)); },
  enriquecer: async (linhas, eu, d1) => {
    const f = await fotosDasAvarias(d1, eu, linhas);
    return linhas.map((l) => ({ ...l, fotos: f.get(l.id) ?? [] }));
  },
});

export const verificacoes = criarRouter({
  nome: "verificacoes", tabela: verificacaoDiaria, ordem: desc(verificacaoDiaria.data), ler: ["admin", "gestor", "consulta", "instrutor"], escrever: ["admin", "gestor", "instrutor"],
  criar: z.object({
    data: data.optional(), itens: z.array(z.object({ item: z.string().trim().min(1).max(60), ok: z.boolean() })).min(1).max(30),
    notas: z.string().trim().max(600).nullish(), clienteId: z.string().min(8).max(64).optional(),
  }),
  preparar: async (d, { eu }) => ({ ...d, data: d.data ?? hojeLisboa(), utilizadorId: eu.id, itens: JSON.stringify(d.itens), resultado: d.itens.every((i: { ok: boolean }) => i.ok) ? "ok" : "problema" }),
  // Um problema na verificacao cria logo uma avaria para a gestao tratar.
  depois: async (l, { c, eu, veiculoId }) => {
    if (l.resultado !== "problema") return {};
    const falhas = (JSON.parse(l.itens) as { item: string; ok: boolean }[]).filter((i) => !i.ok).map((i) => i.item).join(", ");
    const [nova] = await drizzle(c.env.DB).insert(avaria).values({ veiculoId, reportadoPor: eu.id, descricao: `Verificação diária: ${falhas}${l.notas ? `. ${l.notas}` : ""}`.slice(0, 600), estado: "reportada", clienteId: l.clienteId ? `v:${l.clienteId}` : null }).returning({ id: avaria.id });
    c.executionCtx.waitUntil(notificarAvaria(c.env, nova.id));
    return { avariaCriada: true };
  },
});
