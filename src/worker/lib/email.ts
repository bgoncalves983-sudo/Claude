import type { Env } from "../env";
import type { Alerta } from "./alertas";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function enviarResumo(env: Env, para: string[], alertas: Alerta[]): Promise<boolean> {
  if (!env.RESEND_API_KEY || para.length === 0 || alertas.length === 0) return false;
  const linhas = alertas
    .map((a) => {
      const estado = a.dias < 0 ? `CADUCADO há ${-a.dias} dia(s)` : a.dias === 0 ? "caduca HOJE" : `caduca em ${a.dias} dia(s)`;
      return `<li><b>${esc(a.rotulo)}</b>: ${estado} (${a.data})</li>`;
    })
    .join("");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.ALERT_FROM,
      to: para,
      subject: `Frota: ${alertas.length} prazo(s) a atender`,
      html: `<p>Prazos a atender:</p><ul>${linhas}</ul><p><a href="${esc(env.APP_URL)}">Abrir a aplicação</a></p>`,
    }),
  });
  return r.ok;
}
