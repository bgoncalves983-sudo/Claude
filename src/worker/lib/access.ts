// Validacao do JWT do Cloudflare Access (RS256) contra as chaves publicas da equipa.
interface Jwk extends JsonWebKey { kid?: string }

let cacheChaves: { em: number; chaves: Jwk[] } | null = null;

const b64urlParaBytes = (s: string): Uint8Array => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};
const b64urlParaJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlParaBytes(s)));

async function chaves(teamDomain: string): Promise<Jwk[]> {
  if (cacheChaves && Date.now() - cacheChaves.em < 3_600_000) return cacheChaves.chaves;
  const r = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error("Nao foi possivel obter as chaves do Access");
  const { keys } = (await r.json()) as { keys: Jwk[] };
  cacheChaves = { em: Date.now(), chaves: keys };
  return keys;
}

/** Devolve o email autenticado, ou null se o token for invalido. */
export async function emailDoAccess(jwt: string, teamDomain: string, aud: string): Promise<string | null> {
  const [h, p, s] = jwt.split(".");
  if (!h || !p || !s) return null;
  const cab = b64urlParaJson(h) as { kid?: string; alg?: string };
  const corpo = b64urlParaJson(p) as { aud?: string[] | string; exp?: number; iss?: string; email?: string };
  if (cab.alg !== "RS256") return null;
  const audiencias = Array.isArray(corpo.aud) ? corpo.aud : [corpo.aud];
  if (!audiencias.includes(aud)) return null;
  if (corpo.iss !== `https://${teamDomain}`) return null;
  if (!corpo.exp || corpo.exp * 1000 < Date.now()) return null;

  const jwk = (await chaves(teamDomain)).find((k) => k.kid === cab.kid);
  if (!jwk) return null;
  const chave = await crypto.subtle.importKey(
    "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
  );
  const valido = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", chave, b64urlParaBytes(s), new TextEncoder().encode(`${h}.${p}`),
  );
  return valido && corpo.email ? corpo.email.toLowerCase() : null;
}
