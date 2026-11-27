import { zValidator } from "@hono/zod-validator";
import { and, eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { soGestao } from "../auth";
import { utilizador } from "../db/schema";
import type { AppEnv } from "../env";
import { registarAuditoria } from "../lib/auditoria";
import { eUnico } from "../lib/erros";
import { criarHash, gerarSenhaTemporaria, sugerirUsername } from "../lib/senha";
import { estadoLogin, terminarSessoes } from "../lib/sessao";

export const utilizadores = new Hono<AppEnv>();
utilizadores.use("*", soGestao);

const DIAS_TEMPORARIA = 7;
const expiraTemporaria = () => new Date(Date.now() + DIAS_TEMPORARIA * 86_400_000).toISOString();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const publico = (u: typeof utilizador.$inferSelect) => ({
  id: u.id, nome: u.nome, email: u.metodo === "senha" ? null : u.email, username: u.username, perfil: u.perfil, metodo: u.metodo,
  ativo: u.ativo, escola: u.escola, deveMudarSenha: u.deveMudarSenha, ultimoAcesso: u.ultimoAcesso,
  cartaValidade: u.cartaValidade, licencaInstrutorValidade: u.licencaInstrutorValidade,
});

utilizadores.get("/", async (c) => {
  const lista = await drizzle(c.env.DB).select().from(utilizador).orderBy(utilizador.nome);
  const out = [];
  for (const u of lista) {
    const b = u.username ? await estadoLogin(c.env.DB, u.username, null) : null;
    out.push({ ...publico(u), bloqueado: !!b?.bloqueado, bloqueadoSegundos: b?.segundos ?? 0 });
  }
  return c.json(out);
});

const criar = z.object({
  nome: z.string().trim().min(2).max(80),
  perfil: z.enum(["admin", "gestor", "instrutor", "consulta"]),
  email: z.string().trim().toLowerCase().email().optional(), // so para a gestao
  username: z.string().trim().toLowerCase().regex(/^[a-z][a-z.\-']{1,40}$/, "Use letras minusculas, ponto e hifen").optional(),
  escola: z.string().trim().max(60).nullish(),
  cartaValidade: data.nullish(),
  licencaInstrutorValidade: data.nullish(),
});

utilizadores.post("/", zValidator("json", criar), async (c) => {
  const eu = c.get("user");
  const dados = c.req.valid("json");
  // So um administrador cria administradores e gestores.
  if (dados.perfil !== "instrutor" && dados.perfil !== "consulta" && eu.perfil !== "admin") return c.json({ erro: "Apenas um administrador cria gestores e administradores." }, 403);
  const db = drizzle(c.env.DB);

  if (dados.perfil !== "instrutor") {
    if (!dados.email) return c.json({ erro: "Indique o email (a gestao entra com código enviado por email)." }, 422);
    try {
      const [n] = await db.insert(utilizador).values({ email: dados.email, nome: dados.nome, perfil: dados.perfil, metodo: "access", escola: dados.escola ?? null }).returning();
      await registarAuditoria(c.env.DB, eu.id, "criar", "utilizador", n.id, { perfil: n.perfil });
      return c.json(publico(n), 201);
    } catch (e) { if (eUnico(e)) return c.json({ erro: "Já existe um utilizador com esse email." }, 409); throw e; }
  }

  // Instrutor: nome de utilizador "primeiro.ultimo", unico (acrescenta numero se necessario).
  const base = dados.username ?? sugerirUsername(dados.nome);
  if (!base) return c.json({ erro: "Não foi possível sugerir um utilizador a partir do nome." }, 422);
  let username = base;
  for (let i = 2; i < 50; i++) {
    const [existe] = await db.select({ id: utilizador.id }).from(utilizador).where(eq(utilizador.username, username)).limit(1);
    if (!existe) break;
    if (dados.username) return c.json({ erro: "Esse utilizador já existe." }, 409);
    username = `${base}${i}`;
  }
  const senha = gerarSenhaTemporaria();
  try {
    const [n] = await db.insert(utilizador).values({
      email: `${username}@sem-email.local`, nome: dados.nome, perfil: "instrutor", metodo: "senha", username, escola: dados.escola ?? null,
      cartaValidade: dados.cartaValidade ?? null, licencaInstrutorValidade: dados.licencaInstrutorValidade ?? null,
      senhaHash: await criarHash(senha, c.env.SENHA_PEPPER ?? ""), deveMudarSenha: true, senhaTemporariaExpira: expiraTemporaria(),
    }).returning();
    await registarAuditoria(c.env.DB, eu.id, "criar", "utilizador", n.id, { perfil: "instrutor", username });
    // A palavra-passe temporaria so aparece nesta resposta, uma vez.
    return c.json({ ...publico(n), senhaTemporaria: senha, senhaTemporariaExpira: n.senhaTemporariaExpira }, 201);
  } catch (e) { if (eUnico(e)) return c.json({ erro: "Esse utilizador já existe." }, 409); throw e; }
});

utilizadores.patch("/:id", zValidator("json", z.object({
  nome: z.string().trim().min(2).max(80).optional(), escola: z.string().trim().max(60).nullish(), ativo: z.boolean().optional(),
  cartaValidade: data.nullish(), licencaInstrutorValidade: data.nullish(),
})), async (c) => {
  const eu = c.get("user"); const id = Number(c.req.param("id")); const alt = c.req.valid("json");
  const db = drizzle(c.env.DB);
  const [alvo] = await db.select().from(utilizador).where(eq(utilizador.id, id)).limit(1);
  if (!alvo) return c.json({ erro: "Não encontrado" }, 404);
  if (alt.ativo === false && id === eu.id) return c.json({ erro: "Não pode desativar a sua própria conta." }, 422);
  if (alvo.perfil !== "instrutor" && alvo.perfil !== "consulta" && eu.perfil !== "admin") return c.json({ erro: "Apenas um administrador altera gestores e administradores." }, 403);
  if (Object.keys(alt).length === 0) return c.json({ erro: "Nada para alterar" }, 400);
  const [n] = await db.update(utilizador).set(alt).where(eq(utilizador.id, id)).returning();
  if (alt.ativo === false) await terminarSessoes(c.env.DB, id); // desativar fecha o acesso de imediato
  await registarAuditoria(c.env.DB, eu.id, alt.ativo === false ? "desativar" : "editar", "utilizador", id, alt);
  return c.json(publico(n));
});

utilizadores.post("/:id/repor-senha", async (c) => {
  const eu = c.get("user"); const id = Number(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const [alvo] = await db.select().from(utilizador).where(and(eq(utilizador.id, id), eq(utilizador.metodo, "senha"))).limit(1);
  if (!alvo) return c.json({ erro: "Instrutor não encontrado" }, 404);
  const senha = gerarSenhaTemporaria();
  await db.update(utilizador).set({ senhaHash: await criarHash(senha, c.env.SENHA_PEPPER ?? ""), deveMudarSenha: true, senhaTemporariaExpira: expiraTemporaria() }).where(eq(utilizador.id, id));
  await terminarSessoes(c.env.DB, id);
  // Limpa tentativas falhadas: com palavra-passe nova a conta fica desbloqueada.
  await c.env.DB.prepare("DELETE FROM tentativa_login WHERE username = ?").bind(alvo.username).run();
  await registarAuditoria(c.env.DB, eu.id, "repor-senha", "utilizador", id);
  return c.json({ senhaTemporaria: senha, senhaTemporariaExpira: expiraTemporaria() });
});

utilizadores.post("/:id/terminar-sessoes", async (c) => {
  const id = Number(c.req.param("id"));
  await terminarSessoes(c.env.DB, id);
  await registarAuditoria(c.env.DB, c.get("user").id, "terminar-sessoes", "utilizador", id);
  return c.json({ ok: true });
});
