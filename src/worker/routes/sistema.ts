import { Hono } from "hono";
import { exigirPerfil } from "../auth";
import type { AppEnv } from "../env";
import { registarAuditoria } from "../lib/auditoria";
import { emailConfigurado, emailsDaGestao, enviarTeste } from "../lib/notificar";
import { chavesValidas } from "../lib/push";

/** Estado das ligacoes externas (emails, notificacoes) para o administrador diagnosticar. */
export const sistemaRota = new Hono<AppEnv>();
sistemaRota.use("*", exigirPerfil("admin"));

sistemaRota.get("/estado", async (c) => c.json({
  email: { configurado: emailConfigurado(c.env), de: c.env.ALERT_FROM, destinatarios: (await emailsDaGestao(c.env)).length },
  push: { configurado: chavesValidas(c.env) },
}));

sistemaRota.post("/email-teste", async (c) => {
  const eu = c.get("user");
  const r = await enviarTeste(c.env, eu.email);
  await registarAuditoria(c.env.DB, eu.id, "email-teste", "sistema", null, { ok: r.ok });
  return c.json(r, r.ok ? 200 : 502);
});
