import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { exigirPerfil } from "../auth";
import { pushSubscricao } from "../db/schema";
import type { AppEnv } from "../env";
import { chavesValidas, deB64u } from "../lib/push";

/** Subscricao de dispositivos da gestao as notificacoes push. */
export const pushRota = new Hono<AppEnv>();
pushRota.use("*", exigirPerfil("admin", "gestor"));

pushRota.get("/chave", (c) => c.json({ chave: chavesValidas(c.env) ? c.env.VAPID_PUBLIC_KEY! : null, motivo: chavesValidas(c.env) ? null : "As chaves das notificações não estão configuradas ou estão mal registadas." }));

const sub = z.object({ endpoint: z.string().url().max(600), keys: z.object({ p256dh: z.string().min(80).max(120), auth: z.string().min(16).max(40) }) });

pushRota.post("/subscrever", zValidator("json", sub), async (c) => {
  const { endpoint, keys } = c.req.valid("json");
  // So endereços https dos servicos de push (em desenvolvimento local aceita-se http://localhost).
  const u = new URL(endpoint);
  if (u.protocol !== "https:" && !(c.env.ENVIRONMENT === "dev" && u.hostname === "localhost")) return c.json({ erro: "Endereço de notificações inválido." }, 400);
  if (deB64u(keys.p256dh).length !== 65) return c.json({ erro: "Chave inválida." }, 400);
  const db = drizzle(c.env.DB);
  await db.delete(pushSubscricao).where(eq(pushSubscricao.endpoint, endpoint)); // o mesmo dispositivo pode mudar de utilizador
  await db.insert(pushSubscricao).values({ utilizadorId: c.get("user").id, endpoint, p256dh: keys.p256dh, auth: keys.auth, dispositivo: c.req.header("user-agent")?.slice(0, 160) ?? null });
  return c.json({ ok: true }, 201);
});

pushRota.post("/remover", zValidator("json", z.object({ endpoint: z.string().url().max(600) })), async (c) => {
  await drizzle(c.env.DB).delete(pushSubscricao).where(and(eq(pushSubscricao.endpoint, c.req.valid("json").endpoint), eq(pushSubscricao.utilizadorId, c.get("user").id)));
  return c.json({ ok: true });
});
