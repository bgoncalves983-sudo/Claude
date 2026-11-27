import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { exigirPerfil } from "../auth";
import { veiculo } from "../db/schema";
import type { AppEnv } from "../env";
import { registarAuditoria } from "../lib/auditoria";
import { ler, tipoReal } from "../lib/ficheiros";
import { idsVisiveis } from "./veiculos";

// Fotografia do veiculo: o telemovel envia a imagem grande (1600 px) e a miniatura (~400 px).
export const fotos = new Hono<AppEnv>();
const MAX_GRANDE = 2.5 * 1024 * 1024, MAX_MINI = 300 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

fotos.post("/:id/foto", exigirPerfil("admin", "gestor"), async (c) => {
  const id = Number(c.req.param("id"));
  const [v] = await drizzle(c.env.DB).select({ id: veiculo.id, fotoKey: veiculo.fotoKey }).from(veiculo).where(eq(veiculo.id, id)).limit(1);
  if (!v) return c.json({ erro: "Nao encontrado" }, 404);
  const form = await c.req.formData();
  const grande = form.get("grande"), mini = form.get("mini");
  if (!(grande instanceof File) || !(mini instanceof File)) return c.json({ erro: "Envie a imagem e a miniatura." }, 400);
  if (grande.size > MAX_GRANDE || mini.size > MAX_MINI || grande.size === 0 || mini.size === 0) return c.json({ erro: "Imagem demasiado grande." }, 413);
  const tg = tipoReal(await ler(grande)), tm = tipoReal(await ler(mini));
  if (!tg || !tm || tg === "application/pdf" || tm === "application/pdf") return c.json({ erro: "Apenas imagens JPG, PNG ou WEBP." }, 415);
  const base = `fotos/${id}/${Date.now()}`;
  await c.env.DOCS.put(`${base}-grande.${EXT[tg]}`, grande.stream(), { httpMetadata: { contentType: tg } });
  await c.env.DOCS.put(`${base}-mini.${EXT[tm]}`, mini.stream(), { httpMetadata: { contentType: tm } });
  const antiga = v.fotoKey;
  const agora = new Date().toISOString();
  await drizzle(c.env.DB).update(veiculo).set({ fotoKey: `${base}|${EXT[tg]}|${EXT[tm]}`, fotoAtualizadaEm: agora }).where(eq(veiculo.id, id));
  if (antiga) { const [b, e1, e2] = antiga.split("|"); await c.env.DOCS.delete([`${b}-grande.${e1}`, `${b}-mini.${e2}`]); }
  await registarAuditoria(c.env.DB, c.get("user").id, "foto", "veiculo", id);
  return c.json({ ok: true, fotoVersao: agora });
});

fotos.get("/:id/foto", async (c) => {
  const id = Number(c.req.param("id")); const eu = c.get("user");
  const vis = await idsVisiveis(c.env.DB, eu);
  if (vis !== "todos" && !vis.includes(id)) return c.json({ erro: "Nao encontrado" }, 404);
  const [v] = await drizzle(c.env.DB).select({ k: veiculo.fotoKey }).from(veiculo).where(eq(veiculo.id, id)).limit(1);
  if (!v?.k) return c.json({ erro: "Sem fotografia" }, 404);
  const [b, e1, e2] = v.k.split("|");
  const mini = c.req.query("tam") === "mini";
  const obj = await c.env.DOCS.get(mini ? `${b}-mini.${e2}` : `${b}-grande.${e1}`);
  if (!obj) return c.json({ erro: "Ficheiro em falta" }, 404);
  // O endereco leva ?v=<versao>: ao mudar a foto muda o endereco, por isso a cache pode ser longa.
  return new Response(obj.body, { headers: { "content-type": obj.httpMetadata?.contentType ?? "image/jpeg", "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
});
