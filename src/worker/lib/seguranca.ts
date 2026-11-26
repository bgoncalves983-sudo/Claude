import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";

/** Cabecalhos de seguranca em todas as respostas da API. */
export const cabecalhosSeguranca = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("Referrer-Policy", "no-referrer");
  if (!c.res.headers.has("Cache-Control")) c.res.headers.set("Cache-Control", "no-store");
});

export const METODOS_ALTERACAO = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Protecao contra pedidos vindos de outros sites (CSRF):
 * - o cabecalho X-Requested-With so pode ser enviado pela propria aplicacao (um site externo nao o consegue, sem CORS);
 * - se houver Origin, tem de ser o mesmo endereco do pedido.
 */
export function pedidoPermitido(metodo: string, host: string, origin: string | null, pedidoCom: string | null): boolean {
  if (!METODOS_ALTERACAO.includes(metodo)) return true;
  if (pedidoCom !== "frota") return false;
  if (origin) {
    try { if (new URL(origin).host !== host) return false; } catch { return false; }
  }
  return true;
}

export const protegerAlteracoes = createMiddleware<AppEnv>(async (c, next) => {
  const url = new URL(c.req.url);
  if (!pedidoPermitido(c.req.method, url.host, c.req.header("origin") ?? null, c.req.header("x-requested-with") ?? null)) {
    return c.json({ erro: "Pedido recusado" }, 403);
  }
  await next();
});

/** Data de hoje (AAAA-MM-DD) no fuso de Lisboa, para nao ficar um dia atrasada logo depois da meia-noite no verao. */
export function hojeLisboa(d = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Lisbon" }).format(d);
}
