import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createMiddleware } from "hono/factory";
import type { Perfil } from "../shared/dominio";
import { utilizador } from "./db/schema";
import type { AppEnv } from "./env";
import { emailDoAccess } from "./lib/access";

/**
 * Autentica o pedido. Em producao exige o JWT do Cloudflare Access; so em
 * desenvolvimento local aceita o cabecalho X-Dev-User com o email.
 */
export const autenticar = createMiddleware<AppEnv>(async (c, next) => {
  let email: string | null = null;
  if (c.env.ENVIRONMENT === "dev") {
    email = c.req.header("x-dev-user")?.toLowerCase() ?? null;
  } else {
    const jwt = c.req.header("cf-access-jwt-assertion");
    if (jwt && c.env.CF_ACCESS_TEAM_DOMAIN && c.env.CF_ACCESS_AUD) {
      try {
        email = await emailDoAccess(jwt, c.env.CF_ACCESS_TEAM_DOMAIN, c.env.CF_ACCESS_AUD);
      } catch {
        email = null;
      }
    }
  }
  if (!email) return c.json({ erro: "Nao autenticado" }, 401);

  const db = drizzle(c.env.DB);
  const [u] = await db.select().from(utilizador).where(eq(utilizador.email, email)).limit(1);
  if (!u || !u.ativo) return c.json({ erro: "Utilizador sem acesso a esta aplicacao" }, 403);
  c.set("user", { id: u.id, email: u.email, nome: u.nome, perfil: u.perfil });
  await next();
});

export const exigirPerfil = (...perfis: Perfil[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!perfis.includes(c.get("user").perfil)) return c.json({ erro: "Sem permissao" }, 403);
    await next();
  });

/** Gestores e administradores. */
export const soGestao = exigirPerfil("admin", "gestor");
