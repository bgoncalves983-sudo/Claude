import { Hono } from "hono";
import { soGestao } from "../auth";
import type { AppEnv } from "../env";
import { avisosDoDia } from "../lib/prazos";

export const alertas = new Hono<AppEnv>();

// Prazos em aberto (para o painel inicial).
alertas.get("/", soGestao, async (c) => c.json(await avisosDoDia(c.env.DB, new Date().toISOString().slice(0, 10))));
