import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { autenticar, nomeCookie } from "../auth";
import { utilizador } from "../db/schema";
import type { AppEnv } from "../env";
import { registarAuditoria } from "../lib/auditoria";
import { criarHash, validarSenha, verificarSenha } from "../lib/senha";
import { criarSessao, DURACAO_SESSAO_DIAS, estadoLogin, MAX_FALHAS, registarTentativa, terminarSessao, terminarSessoes } from "../lib/sessao";

export const auth = new Hono<AppEnv>();

const opcoesCookie = (dev: boolean) => ({ httpOnly: true, secure: !dev, sameSite: "Strict" as const, path: "/", maxAge: DURACAO_SESSAO_DIAS * 86_400 });
const MSG_ERRO = "Utilizador ou palavra-passe incorretos.";

auth.post("/login", zValidator("json", z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(200) })), async (c) => {
  const { password } = c.req.valid("json");
  const username = c.req.valid("json").username.toLowerCase();
  const ip = c.req.header("cf-connecting-ip") ?? null;
  const pepper = c.env.SENHA_PEPPER ?? "";
  if (!pepper) { console.error("SENHA_PEPPER nao configurado"); return c.json({ erro: "Servico indisponivel" }, 503); }

  const estado = await estadoLogin(c.env.DB, username, ip);
  if (estado.bloqueado) {
    c.header("Retry-After", String(estado.segundos));
    return c.json({ erro: "Demasiadas tentativas. Aguarde alguns minutos ou fale com o responsavel de frota.", tentarEmSegundos: estado.segundos }, 429);
  }

  const db = drizzle(c.env.DB);
  const [u] = await db.select().from(utilizador).where(eq(utilizador.username, username)).limit(1);
  const conta = u && u.ativo && u.metodo === "senha" ? u : null;
  // Verifica sempre (mesmo sem conta) para o tempo de resposta nao revelar quem existe.
  const ok = await verificarSenha(password, conta?.senhaHash ?? null, pepper);
  if (!conta || !ok) {
    await registarTentativa(c.env.DB, username, ip, false);
    return c.json({ erro: MSG_ERRO, tentativasRestantes: Math.max(0, MAX_FALHAS - (estado.falhas + 1)) }, 401);
  }
  if (conta.deveMudarSenha && conta.senhaTemporariaExpira && conta.senhaTemporariaExpira < new Date().toISOString()) {
    await registarTentativa(c.env.DB, username, ip, false);
    return c.json({ erro: "A palavra-passe temporaria expirou. Fale com o responsavel de frota." }, 401);
  }

  await registarTentativa(c.env.DB, username, ip, true);
  const { token } = await criarSessao(c.env.DB, conta.id, c.req.header("user-agent") ?? null);
  await db.update(utilizador).set({ ultimoAcesso: new Date().toISOString() }).where(eq(utilizador.id, conta.id));
  await registarAuditoria(c.env.DB, conta.id, "login", "utilizador", conta.id);
  setCookie(c, nomeCookie(c.env), token, opcoesCookie(c.env.ENVIRONMENT === "dev"));
  return c.json({ utilizador: { id: conta.id, nome: conta.nome, perfil: conta.perfil }, deveMudarSenha: conta.deveMudarSenha });
});

auth.post("/logout", async (c) => {
  const token = getCookie(c, nomeCookie(c.env));
  if (token) await terminarSessao(c.env.DB, token);
  deleteCookie(c, nomeCookie(c.env), { path: "/", secure: c.env.ENVIRONMENT !== "dev" });
  return c.json({ ok: true });
});

auth.post("/mudar-senha", autenticar, zValidator("json", z.object({ atual: z.string().min(1).max(200), nova: z.string().min(1).max(200) })), async (c) => {
  const eu = c.get("user");
  if (eu.metodo !== "senha") return c.json({ erro: "Esta conta nao usa palavra-passe." }, 400);
  const { atual, nova } = c.req.valid("json");
  const pepper = c.env.SENHA_PEPPER ?? "";
  const db = drizzle(c.env.DB);
  const [u] = await db.select().from(utilizador).where(eq(utilizador.id, eu.id)).limit(1);
  if (!(await verificarSenha(atual, u?.senhaHash ?? null, pepper))) return c.json({ erro: "A palavra-passe atual esta incorreta." }, 400);
  if (nova === atual) return c.json({ erro: "A nova palavra-passe tem de ser diferente da atual." }, 400);
  const erro = validarSenha(nova, eu.username ?? "");
  if (erro) return c.json({ erro }, 400);
  await db.update(utilizador).set({
    senhaHash: await criarHash(nova, pepper), deveMudarSenha: false, senhaTemporariaExpira: null, senhaAlteradaEm: new Date().toISOString(),
  }).where(eq(utilizador.id, eu.id));
  // Termina as outras sessoes (outros telemoveis) e mantem a atual.
  const token = getCookie(c, nomeCookie(c.env));
  await terminarSessoes(c.env.DB, eu.id, token);
  await registarAuditoria(c.env.DB, eu.id, "mudar-senha", "utilizador", eu.id);
  return c.json({ ok: true });
});
