import { Hono } from "hono";
import { exigirPerfil } from "../auth";
import type { AppEnv } from "../env";
import { registarAuditoria } from "../lib/auditoria";
import { caminhoBackup, fazerBackup, listarBackups } from "../lib/backup";
import { hojeLisboa } from "../lib/seguranca";

export const backups = new Hono<AppEnv>();
backups.use("*", exigirPerfil("admin")); // so administradores

backups.get("/", async (c) => c.json(await listarBackups(c.env)));

backups.post("/", async (c) => {
  const r = await fazerBackup(c.env, `${hojeLisboa()}-manual-${Date.now().toString(36)}`);
  await registarAuditoria(c.env.DB, c.get("user").id, "backup", "sistema", null, r);
  return c.json(r, 201);
});

backups.get("/:nome", async (c) => {
  const nome = c.req.param("nome");
  if (!/^[\w.-]+\.json\.gz$/.test(nome)) return c.json({ erro: "Nome invalido" }, 400);
  const obj = await c.env.DOCS.get(caminhoBackup(nome));
  if (!obj) return c.json({ erro: "Nao encontrado" }, 404);
  await registarAuditoria(c.env.DB, c.get("user").id, "descarregar-backup", "sistema", null, { nome });
  return new Response(obj.body, { headers: { "content-type": "application/gzip", "content-disposition": `attachment; filename="${nome}"`, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
});
