// Notificacoes push (Web Push): cifra da mensagem (RFC 8291, aes128gcm) e identificacao do servidor (VAPID, RFC 8292),
// tudo com WebCrypto, sem bibliotecas. O servico de push (Google, Mozilla, Apple) so ve texto cifrado.
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { pushSubscricao, utilizador } from "../db/schema";
import type { Env } from "../env";

const enc = new TextEncoder();
export const b64u = (b: ArrayBuffer | Uint8Array): string => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const deB64u = (s: string): Uint8Array => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
const juntar = (...a: Uint8Array[]): Uint8Array => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, bytes * 8));
}

/** Cifra a mensagem para o dispositivo (chave publica p256dh e segredo auth da subscricao). */
export async function cifrar(mensagem: Uint8Array, p256dh: string, auth: string): Promise<Uint8Array> {
  const ua = deB64u(p256dh), authSecret = deB64u(auth);
  const par = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPub = new Uint8Array((await crypto.subtle.exportKey("raw", par.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const segredo = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm, par.privateKey, 256));
  const ikm = await hkdf(authSecret, segredo, juntar(enc.encode("WebPush: info\0"), ua, asPub), 32);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sal, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, juntar(mensagem, new Uint8Array([2])))); // 0x02 = ultimo registo
  const cab = new Uint8Array(21 + asPub.length);
  cab.set(sal, 0); new DataView(cab.buffer).setUint32(16, 4096); cab[20] = asPub.length; cab.set(asPub, 21);
  return juntar(cab, cifrado);
}

/** Cabecalho Authorization (VAPID): prova que o pedido vem desta aplicacao. */
export async function autorizacaoVapid(endpoint: string, publica: string, privada: string, sujeito: string, agora = Date.now()): Promise<string> {
  const cab = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(agora / 1000) + 12 * 3600, sub: sujeito })));
  const pub = deB64u(publica);
  const chave = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: privada }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const assinatura = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, chave, enc.encode(`${cab}.${corpo}`));
  return `vapid t=${cab}.${corpo}.${b64u(assinatura)}, k=${publica}`;
}

export interface Mensagem { titulo: string; corpo: string; url: string; tag?: string }
type Resultado = "ok" | "expirada" | "erro";

async function enviarUm(env: Env, s: { endpoint: string; p256dh: string; auth: string }, m: Mensagem): Promise<Resultado> {
  try {
    const r = await fetch(s.endpoint, {
      method: "POST",
      headers: {
        authorization: await autorizacaoVapid(s.endpoint, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!, env.APP_URL),
        "content-encoding": "aes128gcm", "content-type": "application/octet-stream", ttl: "3600", urgency: "high",
      },
      body: await cifrar(enc.encode(JSON.stringify(m)), s.p256dh, s.auth),
    });
    return r.status === 404 || r.status === 410 ? "expirada" : r.ok ? "ok" : "erro";
  } catch { return "erro"; }
}

/** As chaves so servem se tiverem o formato certo (publica: 65 bytes; privada: 32). Evita notificacoes "ativas" que nunca chegam por uma chave mal colada. */
export function chavesValidas(env: Env): boolean {
  try { return !!env.VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY && deB64u(env.VAPID_PUBLIC_KEY).length === 65 && deB64u(env.VAPID_PRIVATE_KEY).length === 32; } catch { return false; }
}

/** Envia a todos os dispositivos da gestao; remove os que ja nao existem. Nunca falha quem chama. */
export async function notificarGestaoPush(env: Env, m: Mensagem): Promise<number> {
  if (!chavesValidas(env)) return 0;
  try {
    const db = drizzle(env.DB);
    const gestao = await db.select({ id: utilizador.id }).from(utilizador).where(inArray(utilizador.perfil, ["gestor", "admin"]));
    if (gestao.length === 0) return 0;
    const subs = await db.select().from(pushSubscricao).where(inArray(pushSubscricao.utilizadorId, gestao.map((g) => g.id)));
    let enviados = 0;
    await Promise.all(subs.map(async (s) => {
      const r = await enviarUm(env, s, m);
      if (r === "ok") enviados++;
      if (r === "expirada") await db.delete(pushSubscricao).where(eq(pushSubscricao.id, s.id));
    }));
    return enviados;
  } catch (e) { console.error("notificarGestaoPush", e); return 0; }
}
