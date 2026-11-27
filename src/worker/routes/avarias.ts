import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { exigirPerfil } from "../auth";
import { avaria, utilizador, veiculo } from "../db/schema";
import type { AppEnv } from "../env";
import { fotosDasAvarias } from "./avariaFotos";

/** Visao geral das avarias de toda a frota (painel da gestao). */
export const avariasGeral = new Hono<AppEnv>();
avariasGeral.use("*", exigirPerfil("admin", "gestor", "consulta"));

const ABERTAS = ["reportada", "em_analise", "em_reparacao"] as const;

avariasGeral.get("/", async (c) => {
  const eu = c.get("user"); const db = drizzle(c.env.DB);
  const so = c.req.query("estado"); // abertas (por omissao) | todas | <estado>
  const filtro = so === "todas" ? undefined : so && so !== "abertas" ? eq(avaria.estado, so as "reportada") : inArray(avaria.estado, [...ABERTAS]);
  const linhas = await db
    .select({ a: avaria, matricula: veiculo.matricula, marca: veiculo.marca, modelo: veiculo.modelo, escola: veiculo.proprietario, quem: utilizador.nome })
    .from(avaria).innerJoin(veiculo, eq(veiculo.id, avaria.veiculoId)).leftJoin(utilizador, eq(utilizador.id, avaria.reportadoPor))
    .where(filtro).orderBy(sql`${avaria.dataReporte} DESC`).limit(200);
  const fotos = await fotosDasAvarias(c.env.DB, eu, linhas.map((l) => l.a));
  const agora = Date.now();
  return c.json(linhas.map((l) => ({
    id: l.a.id, veiculoId: l.a.veiculoId, matricula: l.matricula, veiculo: [l.marca, l.modelo].filter(Boolean).join(" "), escola: l.escola,
    descricao: l.a.descricao, estado: l.a.estado, dataReporte: l.a.dataReporte, dataResolucao: l.a.dataResolucao, reportadoPor: l.quem,
    horasEmAberto: l.a.estado === "resolvida" ? null : Math.floor((agora - Date.parse(l.a.dataReporte)) / 3_600_000), fotos: fotos.get(l.a.id) ?? [],
  })));
});

/** Contagens para o painel e para o indicador do menu (consulta leve, feita de 30 em 30 segundos). */
avariasGeral.get("/resumo", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT estado, COUNT(*) AS n, MIN(data_reporte) AS maisAntiga FROM avaria WHERE estado != 'resolvida' GROUP BY estado").all<{ estado: string; n: number; maisAntiga: string }>();
  const por = Object.fromEntries(results.map((r) => [r.estado, r.n]));
  const antiga = results.map((r) => r.maisAntiga).sort()[0];
  return c.json({
    novas: por.reportada ?? 0, emAnalise: por.em_analise ?? 0, emReparacao: por.em_reparacao ?? 0, abertas: results.reduce((s, r) => s + r.n, 0),
    maisAntigaHoras: antiga ? Math.floor((Date.now() - Date.parse(antiga)) / 3_600_000) : null,
  });
});
