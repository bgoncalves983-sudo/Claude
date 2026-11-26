import { Hono } from "hono";
import { autenticar } from "./auth";
import { cabecalhosSeguranca, protegerAlteracoes } from "./lib/seguranca";
import { auth } from "./routes/auth";
import { utilizadores } from "./routes/utilizadores";
import { backups } from "./routes/backups";
import { correrTarefasDiarias } from "./cron";
import type { AppEnv, Env } from "./env";
import { alertas } from "./routes/alertas";
import { conjuntos } from "./routes/conjuntos";
import { documentos } from "./routes/documentos";
import { veiculos } from "./routes/veiculos";

const app = new Hono<AppEnv>();

app.use("/api/*", cabecalhosSeguranca);
app.use("/api/*", protegerAlteracoes);

app.get("/api/saude", (c) => c.json({ ok: true }));
app.route("/api/auth", auth); // login/logout/mudar-senha (cada rota trata da sua autenticacao)

app.use("/api/*", autenticar);
app.get("/api/me", (c) => { const u = c.get("user"); return c.json({ id: u.id, nome: u.nome, email: u.metodo === "senha" ? null : u.email, username: u.username, perfil: u.perfil, deveMudarSenha: u.deveMudarSenha }); });
app.route("/api/utilizadores", utilizadores);
app.route("/api/backups", backups);
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
    ctx.waitUntil(correrTarefasDiarias(env));
  },
} satisfies ExportedHandler<Env>;
