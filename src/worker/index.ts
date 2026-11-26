import { Hono } from "hono";
import { autenticar } from "./auth";
import { correrAlertas } from "./cron";
import type { AppEnv, Env } from "./env";
import { alertas } from "./routes/alertas";
import { conjuntos } from "./routes/conjuntos";
import { documentos } from "./routes/documentos";
import { veiculos } from "./routes/veiculos";

const app = new Hono<AppEnv>();

app.get("/api/saude", (c) => c.json({ ok: true }));

app.use("/api/*", autenticar);
app.get("/api/me", (c) => c.json(c.get("user")));
app.route("/api/veiculos", veiculos);
app.route("/api/conjuntos", conjuntos);
app.route("/api/documentos", documentos);
app.route("/api/alertas", alertas);

app.onError((e, c) => {
  console.error(e);
  return c.json({ erro: "Erro interno" }, 500);
});

export default {
  fetch: app.fetch,
  scheduled: async (_evento: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(correrAlertas(env));
  },
} satisfies ExportedHandler<Env>;
