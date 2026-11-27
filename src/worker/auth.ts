import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { Perfil } from "../shared/dominio";
import { utilizador } from "./db/schema";
import type { AppEnv, Env, Utilizador } from "./env";
import { emailDoAccess } from "./lib/access";
import { validarSessao } from "./lib/sessao";

export const nomeCookie = (env: Env) => (env.ENVIRONMENT === "dev" ? "sessao" : "__Host-sessao");
const hosts = (env: Env) => ({ gestao: env.GESTAO_HOST || "gestao.frotaradical.pt", instrutor: env.INSTRUTOR_HOST || "frotaradical.pt" });

const paraUtilizador = (u: typeof utilizador.$inferSelect): Utilizador => ({
  id: u.id, email: u.email, nome: u.nome, perfil: u.perfil, metodo: u.metodo, deveMudarSenha: u.deveMudarSenha, username: u.username,
});

// Rotas permitidas enquanto o instrutor ainda tem de mudar a palavra-passe temporaria.
const ROTAS_MUDAR_SENHA = ["/api/me", "/api/auth/mudar-senha", "/api/auth/logout"];

/**
 * Autentica o pedido conforme o endereco:
 * - gestao.frotaradical.pt: token do Cloudflare Access (gestao, administradores, consulta);
 * - frotaradical.pt: sessao propria (so instrutores);
 * - desenvolvimento local: cabecalho x-dev-user ou sessao.
 * Uma conta nunca vale no endereco do outro tipo.
 */
export const autenticar = createMiddleware<AppEnv>(async (c, next) => {
  const env = c.env;
  const host = new URL(c.req.url).hostname;
  const dev = env.ENVIRONMENT === "dev";
  const h = hosts(env);
  const db = drizzle(env.DB);
  let u: Utilizador | null = null;

  const porAccess = async () => {
    const jwt = c.req.header("cf-access-jwt-assertion");
    if (!jwt || !env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) return null;
    try {
      const email = await emailDoAccess(jwt, env.CF_ACCESS_TEAM_DOMAIN, env.CF_ACCESS_AUD);
      if (!email) return null;
      const [x] = await db.select().from(utilizador).where(eq(utilizador.email, email)).limit(1);
      return x && x.ativo && x.metodo === "access" ? paraUtilizador(x) : null;
    } catch { return null; }
  };
  const porSessao = async () => {
    const token = getCookie(c, nomeCookie(env));
    if (!token) return null;
    const x = await validarSessao(env.DB, token);
    return x && x.metodo === "senha" && x.perfil === "instrutor" ? paraUtilizador(x) : null;
  };

  if (dev) {
    const dh = c.req.header("x-dev-user")?.toLowerCase();
    if (dh) {
      const [x] = await db.select().from(utilizador).where(eq(utilizador.email, dh)).limit(1);
      u = x && x.ativo ? paraUtilizador(x) : null;
    } else u = await porSessao();
  } else if (host === h.gestao) u = await porAccess();
  else if (host === h.instrutor) u = await porSessao();

  if (!u) return c.json({ erro: "Não autenticado" }, 401);
  if (u.deveMudarSenha && !ROTAS_MUDAR_SENHA.includes(new URL(c.req.url).pathname)) {
    return c.json({ erro: "Tem de mudar a palavra-passe temporária.", codigo: "MUDAR_SENHA" }, 403);
  }
  c.set("user", u);
  await next();
});

export const exigirPerfil = (...perfis: Perfil[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!perfis.includes(c.get("user").perfil)) return c.json({ erro: "Sem permissão" }, 403);
    await next();
  });

/** Gestores e administradores. */
export const soGestao = exigirPerfil("admin", "gestor");
