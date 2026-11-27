import { createECDH, createPublicKey, randomBytes, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
// @ts-expect-error biblioteca de referencia sem tipos
import ece from "http_ece";
import { autorizacaoVapid, b64u, chavesValidas, cifrar, deB64u } from "../src/worker/lib/push";

// Verifica a nossa cifra contra uma biblioteca independente (http_ece, a usada pelo "web-push").
describe("chaves das notificacoes", () => {
  const par = () => { const e = createECDH("prime256v1"); e.generateKeys(); return { pub: b64u(e.getPublicKey()), priv: b64u(e.getPrivateKey()) }; };
  const env = (x: object) => x as never;
  it("aceita chaves geradas pelo script", () => { const k = par(); expect(chavesValidas(env({ VAPID_PUBLIC_KEY: k.pub, VAPID_PRIVATE_KEY: k.priv }))).toBe(true); });
  it("recusa chaves em falta, texto qualquer, ou trocadas entre si", () => {
    const k = par();
    expect(chavesValidas(env({}))).toBe(false);
    expect(chavesValidas(env({ VAPID_PUBLIC_KEY: "isto nao e uma chave", VAPID_PRIVATE_KEY: "nem isto" }))).toBe(false);
    expect(chavesValidas(env({ VAPID_PUBLIC_KEY: k.priv, VAPID_PRIVATE_KEY: k.pub }))).toBe(false);
  });
});

describe("notificacoes push", () => {
  const cliente = () => {
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    const auth = randomBytes(16);
    return { ecdh, auth, p256dh: b64u(ecdh.getPublicKey()), authB64: b64u(auth) };
  };

  it("a mensagem cifrada por nos e decifrada pela biblioteca de referencia", async () => {
    const c = cliente();
    const mensagem = JSON.stringify({ titulo: "Avaria: CA-03-PL", corpo: "Ruído nos travões — Marta", url: "/#/avarias" });
    const corpo = await cifrar(new TextEncoder().encode(mensagem), c.p256dh, c.authB64);
    const claro = ece.decrypt(Buffer.from(corpo), { version: "aes128gcm", privateKey: c.ecdh, authSecret: c.auth });
    expect(claro.toString("utf8")).toBe(mensagem);
  });

  it("cada cifra e diferente (chave efemera e sal novos) e so o dispositivo certo decifra", async () => {
    const c = cliente(), outro = cliente();
    const a = await cifrar(new TextEncoder().encode("x"), c.p256dh, c.authB64);
    const b = await cifrar(new TextEncoder().encode("x"), c.p256dh, c.authB64);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
    expect(() => ece.decrypt(Buffer.from(a), { version: "aes128gcm", privateKey: outro.ecdh, authSecret: outro.auth })).toThrow();
  });

  it("o cabecalho tem o formato do protocolo (sal, tamanho do registo, chave de 65 bytes)", async () => {
    const c = cliente();
    const corpo = await cifrar(new TextEncoder().encode("ola"), c.p256dh, c.authB64);
    expect(new DataView(corpo.buffer, corpo.byteOffset).getUint32(16)).toBe(4096);
    expect(corpo[20]).toBe(65);
    expect(corpo[21]).toBe(4); // chave publica nao comprimida
  });

  it("a assinatura VAPID e valida com a chave publica", async () => {
    const par = createECDH("prime256v1");
    par.generateKeys();
    const publica = b64u(par.getPublicKey());
    const privada = b64u(par.getPrivateKey());
    const agora = Date.parse("2026-11-27T10:00:00Z");
    const auth = await autorizacaoVapid("https://fcm.googleapis.com/fcm/send/abc", publica, privada, "https://frotaradical.pt", agora);
    expect(auth.startsWith("vapid t=")).toBe(true);
    expect(auth.endsWith(`k=${publica}`)).toBe(true);
    const jwt = auth.slice(8, auth.indexOf(","));
    const [cab, corpo, assin] = jwt.split(".");
    expect(JSON.parse(Buffer.from(cab, "base64url").toString())).toEqual({ typ: "JWT", alg: "ES256" });
    const p = JSON.parse(Buffer.from(corpo, "base64url").toString());
    expect(p.aud).toBe("https://fcm.googleapis.com"); // so a origem do servico de push
    expect(p.sub).toBe("https://frotaradical.pt");
    expect(p.exp).toBe(Math.floor(agora / 1000) + 12 * 3600);
    const chave = createPublicKey({ key: { kty: "EC", crv: "P-256", x: b64u(par.getPublicKey().subarray(1, 33)), y: b64u(par.getPublicKey().subarray(33, 65)) }, format: "jwk" });
    expect(verify("sha256", Buffer.from(`${cab}.${corpo}`), { key: chave, dsaEncoding: "ieee-p1363" }, Buffer.from(assin, "base64url"))).toBe(true);
    expect(deB64u(publica).length).toBe(65);
  });
});
