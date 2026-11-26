import { hojeLisboa } from "./lib/seguranca";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { alertaLog, utilizador } from "./db/schema";
import type { Env } from "./env";
import { enviarResumo } from "./lib/email";
import { avisosDoDia } from "./lib/prazos";

/** Corre diariamente: envia aos gestores os avisos que ainda nao foram enviados. */
export async function correrAlertas(env: Env, hoje = hojeLisboa()) {
  const db = drizzle(env.DB);
  const devidos = await avisosDoDia(env.DB, hoje);
  if (devidos.length === 0) return { enviados: 0 };

  const jaEnviados = new Set<string>();
  for (let i = 0; i < devidos.length; i += 50) {
    const lote = devidos.slice(i, i + 50).map((a) => a.chave);
    for (const r of await db.select().from(alertaLog).where(inArray(alertaLog.chave, lote))) jaEnviados.add(r.chave);
  }
  const novos = devidos.filter((a) => !jaEnviados.has(a.chave));
  if (novos.length === 0) return { enviados: 0 };

  const gestores = (await db.select().from(utilizador)).filter((u) => u.ativo && (u.perfil === "gestor" || u.perfil === "admin"));
  const ok = await enviarResumo(env, gestores.map((g) => g.email), novos);
  if (ok) for (const a of novos) await db.insert(alertaLog).values({ chave: a.chave }).onConflictDoNothing();
  return { enviados: ok ? novos.length : 0 };
}
