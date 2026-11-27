import { and, eq, inArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { avaria, avariaFoto } from "../db/schema";
import type { AppEnv, Utilizador } from "../env";
import { registarAuditoria } from "../lib/auditoria";
import { ler, tipoReal } from "../lib/ficheiros";
import { idsVisiveis, podeRegistarNoutro } from "./veiculos";

const MAX_GRANDE = 2.5 * 1024 * 1024, MAX_MINI = 300 * 1024, MAX_POR_AVARIA = 6, JANELA_MS = 48 * 3_600_000;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const gestao = (u: Utilizador) => u.perfil === "admin" || u.perfil === "gestor";

/** Fotografias anexadas a uma avaria: /api/veiculos/:veiculoId/avaria-fotos */
export const avariaFotos = new Hono<AppEnv>();

avariaFotos.post("/", async (c) => {
  const eu = c.get("user"); const vid = Number(c.req.param("veiculoId"));
  if (eu.perfil === "consulta") return c.json({ erro: "Sem permissão" }, 403);
  if (!gestao(eu)) {
    const vis = await idsVisiveis(c.env.DB, eu);
    if (vis !== "todos" && !vis.includes(vid) && !(await podeRegistarNoutro(c.env.DB, eu, vid))) return c.json({ erro: "Não encontrado" }, 404);
  }
  const form = await c.req.formData();
  const grande = form.get("grande"), mini = form.get("mini");
  const clienteId = String(form.get("clienteId") ?? "");
  const idTxt = form.get("avariaId"), cliTxt = form.get("avariaClienteId");
  if (!(grande instanceof File) || !(mini instanceof File) || clienteId.length < 8) return c.json({ erro: "Envie a imagem, a miniatura e o identificador." }, 400);

  const db = drizzle(c.env.DB);
  // A avaria pode ser indicada pelo id ou pelo identificador do telemovel (registo feito sem rede).
  const cond = idTxt ? eq(avaria.id, Number(idTxt)) : cliTxt ? or(eq(avaria.clienteId, String(cliTxt)), eq(avaria.clienteId, `v:${cliTxt}`)) : undefined;
  if (!cond) return c.json({ erro: "Indique a avaria." }, 400);
  const [a] = await db.select().from(avaria).where(and(eq(avaria.veiculoId, vid), cond)).limit(1);
  if (!a) return c.json({ erro: "Avaria não encontrada" }, 404);
  // O instrutor so anexa a avarias que ele reportou, nas 48 horas seguintes.
  if (!gestao(eu) && (a.reportadoPor !== eu.id || Date.now() - Date.parse(a.dataReporte) > JANELA_MS)) return c.json({ erro: "Sem permissão" }, 403);

  const [ja] = await db.select({ id: avariaFoto.id }).from(avariaFoto).where(eq(avariaFoto.clienteId, clienteId)).limit(1);
  if (ja) return c.json({ id: ja.id, repetido: true }, 200);
  if ((await db.select({ id: avariaFoto.id }).from(avariaFoto).where(eq(avariaFoto.avariaId, a.id))).length >= MAX_POR_AVARIA) return c.json({ erro: `No máximo ${MAX_POR_AVARIA} fotografias por avaria.` }, 422);

  if (grande.size === 0 || mini.size === 0 || grande.size > MAX_GRANDE || mini.size > MAX_MINI) return c.json({ erro: "Imagem demasiado grande." }, 413);
  const tg = tipoReal(await ler(grande)), tm = tipoReal(await ler(mini));
  if (!tg || !tm || tg === "application/pdf" || tm === "application/pdf") return c.json({ erro: "Apenas imagens JPG, PNG ou WEBP." }, 415);

  const base = `avarias/${vid}/${a.id}/${crypto.randomUUID()}`;
  const grandeKey = `${base}-grande.${EXT[tg]}`, miniKey = `${base}-mini.${EXT[tm]}`;
  await c.env.DOCS.put(grandeKey, grande.stream(), { httpMetadata: { contentType: tg } });
  await c.env.DOCS.put(miniKey, mini.stream(), { httpMetadata: { contentType: tm } });
  try {
    const [f] = await db.insert(avariaFoto).values({ avariaId: a.id, veiculoId: vid, grandeKey, miniKey, utilizadorId: eu.id, clienteId }).returning();
    await registarAuditoria(c.env.DB, eu.id, "foto-avaria", "avaria", a.id);
    return c.json({ id: f.id }, 201);
  } catch (e) { await c.env.DOCS.delete([grandeKey, miniKey]); throw e; }
});

/** Ids das fotografias das avarias indicadas, respeitando quem as pode ver. */
export async function fotosDasAvarias(d1: D1Database, eu: Utilizador, avarias: { id: number; reportadoPor: number | null }[]): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>();
  const visiveis = avarias.filter((a) => gestao(eu) || eu.perfil === "consulta" || a.reportadoPor === eu.id);
  if (visiveis.length === 0) return out;
  const fotos = await drizzle(d1).select({ id: avariaFoto.id, avariaId: avariaFoto.avariaId }).from(avariaFoto).where(inArray(avariaFoto.avariaId, visiveis.map((a) => a.id))).orderBy(avariaFoto.id);
  for (const f of fotos) out.set(f.avariaId, [...(out.get(f.avariaId) ?? []), f.id]);
  return out;
}

/** Descarregar uma fotografia: /api/avaria-fotos/:id?tam=mini */
export const avariaFotoFicheiro = new Hono<AppEnv>();
avariaFotoFicheiro.get("/:id", async (c) => {
  const eu = c.get("user"); const db = drizzle(c.env.DB);
  const [f] = await db.select().from(avariaFoto).where(eq(avariaFoto.id, Number(c.req.param("id")))).limit(1);
  if (!f) return c.json({ erro: "Não encontrado" }, 404);
  if (!gestao(eu) && eu.perfil !== "consulta") {
    const [a] = await db.select({ r: avaria.reportadoPor }).from(avaria).where(eq(avaria.id, f.avariaId)).limit(1);
    if (a?.r !== eu.id) return c.json({ erro: "Não encontrado" }, 404);
  }
  const obj = await c.env.DOCS.get(c.req.query("tam") === "mini" ? f.miniKey : f.grandeKey);
  if (!obj) return c.json({ erro: "Ficheiro em falta" }, 404);
  // O identificador nunca muda de conteudo: a cache pode ser longa.
  return new Response(obj.body, { headers: { "content-type": obj.httpMetadata?.contentType ?? "image/jpeg", "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
});
