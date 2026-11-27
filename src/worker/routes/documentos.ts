import { and, desc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { TIPOS_DOCUMENTO } from "../../shared/dominio";
import { soGestao } from "../auth";
import { documento } from "../db/schema";
import type { AppEnv } from "../env";
import { registarAuditoria } from "../lib/auditoria";
import { ler, tipoReal } from "../lib/ficheiros";
import { idsVisiveis } from "./veiculos";

export const documentos = new Hono<AppEnv>();

const MAX_BYTES = 15 * 1024 * 1024;
const TIPOS_FICHEIRO = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const nomeSeguro = (n: string) => n.replace(/[^\w.\-]+/g, "_").slice(-80) || "ficheiro";

async function podeVer(c: { env: AppEnv["Bindings"]; get: (k: "user") => AppEnv["Variables"]["user"] }, veiculoId: number | null) {
  const u = c.get("user");
  if (u.perfil !== "instrutor") return true;
  if (veiculoId === null) return false; // documentos da escola: so gestao/consulta
  const v = await idsVisiveis(c.env.DB, u);
  return v === "todos" || v.includes(veiculoId);
}

// Lista (por veiculo; sem veiculoId = documentos da escola).
documentos.get("/", async (c) => {
  const vid = c.req.query("veiculoId");
  const veiculoId = vid ? Number(vid) : null;
  if (!(await podeVer(c, veiculoId))) return c.json({ erro: "Sem permissão" }, 403);
  const db = drizzle(c.env.DB);
  const linhas = await db
    .select()
    .from(documento)
    .where(veiculoId === null ? isNull(documento.veiculoId) : eq(documento.veiculoId, veiculoId))
    .orderBy(desc(documento.criadoEm));
  return c.json(linhas);
});

// Upload (multipart: file, tipo, veiculoId?, validade?, entidade?, entidadeId?)
documentos.post("/", soGestao, async (c) => {
  const form = await c.req.formData();
  const ficheiro = form.get("file");
  if (!(ficheiro instanceof File)) return c.json({ erro: "Ficheiro em falta" }, 400);
  if (ficheiro.size === 0 || ficheiro.size > MAX_BYTES) return c.json({ erro: "Ficheiro vazio ou maior que 15 MB" }, 413);
  // O tipo e decidido pelo conteudo real do ficheiro, nao pelo que o browser declara.
  const real = tipoReal(await ler(ficheiro));
  if (!real || !TIPOS_FICHEIRO.includes(real)) return c.json({ erro: "Apenas PDF, JPG, PNG ou WEBP" }, 415);

  const tipo = String(form.get("tipo") ?? "outro");
  if (!(TIPOS_DOCUMENTO as readonly string[]).includes(tipo)) return c.json({ erro: "Tipo de documento inválido" }, 400);
  const vid = form.get("veiculoId");
  const veiculoId = vid ? Number(vid) : null;
  const validade = form.get("validade") ? String(form.get("validade")) : null;
  if (validade && !/^\d{4}-\d{2}-\d{2}$/.test(validade)) return c.json({ erro: "Validade no formato AAAA-MM-DD" }, 400);

  const db = drizzle(c.env.DB);
  // Nova versao do mesmo tipo para o mesmo veiculo.
  const anteriores = await db
    .select({ versao: documento.versao })
    .from(documento)
    .where(and(veiculoId === null ? isNull(documento.veiculoId) : eq(documento.veiculoId, veiculoId), eq(documento.tipo, tipo)))
    .orderBy(desc(documento.versao))
    .limit(1);
  const versao = (anteriores[0]?.versao ?? 0) + 1;

  const r2Key = `${veiculoId === null ? "escola" : `veiculos/${veiculoId}`}/${crypto.randomUUID()}-${nomeSeguro(ficheiro.name)}`;
  await c.env.DOCS.put(r2Key, ficheiro.stream(), { httpMetadata: { contentType: real } });
  try {
    const [novo] = await db
      .insert(documento)
      .values({
        veiculoId, tipo, versao, validade, r2Key,
        nomeFicheiro: ficheiro.name, contentType: real, tamanho: ficheiro.size,
        entidade: form.get("entidade") ? String(form.get("entidade")) : null,
        entidadeId: form.get("entidadeId") ? Number(form.get("entidadeId")) : null,
        carregadoPor: c.get("user").id,
      })
      .returning();
    await registarAuditoria(c.env.DB, c.get("user").id, "carregar", "documento", novo.id, { tipo, veiculoId });
    return c.json(novo, 201);
  } catch (e) {
    await c.env.DOCS.delete(r2Key); // nao deixar ficheiros orfaos
    throw e;
  }
});

// Download (ficheiros nunca sao publicos: passam sempre pela API autenticada).
documentos.get("/:id/ficheiro", async (c) => {
  const db = drizzle(c.env.DB);
  const [d] = await db.select().from(documento).where(eq(documento.id, Number(c.req.param("id")))).limit(1);
  if (!d || !(await podeVer(c, d.veiculoId))) return c.json({ erro: "Não encontrado" }, 404);
  const obj = await c.env.DOCS.get(d.r2Key);
  if (!obj) return c.json({ erro: "Ficheiro em falta no armazenamento" }, 404);
  return new Response(obj.body, {
    headers: {
      "content-type": d.contentType,
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(d.nomeFicheiro)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox", // um PDF aberto no browser nao pode executar nada
    },
  });
});
