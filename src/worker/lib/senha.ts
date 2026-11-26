// Palavras-passe dos instrutores: PBKDF2-SHA256 com sal por utilizador e segredo da aplicacao ("pepper").
// O Cloudflare Workers limita o PBKDF2 a 100 000 iteracoes; o bloqueio por tentativas compensa (ver ANALISE.md, secao 5).
const ITERACOES = 100_000;
const enc = new TextEncoder();

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function resumo(senha: string, pepper: string, sal: Uint8Array, iteracoes: number): Promise<string> {
  if (!pepper) throw new Error("SENHA_PEPPER nao configurado");
  // 1) mistura a palavra-passe com o segredo da aplicacao; 2) PBKDF2 com o sal do utilizador.
  const hk = await crypto.subtle.importKey("raw", enc.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const misturada = await crypto.subtle.sign("HMAC", hk, enc.encode(senha));
  const pk = await crypto.subtle.importKey("raw", misturada, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iteracoes }, pk, 256);
  return b64(bits);
}

export async function criarHash(senha: string, pepper: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${ITERACOES}$${b64(sal)}$${await resumo(senha, pepper, sal, ITERACOES)}`;
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Hash falso para gastar o mesmo tempo quando o utilizador nao existe (nao revela quem tem conta).
const FALSO = `pbkdf2-sha256$${ITERACOES}$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`;

export async function verificarSenha(senha: string, guardado: string | null, pepper: string): Promise<boolean> {
  const alvo = guardado ?? FALSO;
  const [algo, it, sal, hash] = alvo.split("$");
  if (algo !== "pbkdf2-sha256") return false;
  const calc = await resumo(senha, pepper, deB64(sal), Number(it));
  return iguais(calc, hash) && guardado !== null;
}

const COMUNS = [
  "1234567890", "12345678910", "0123456789", "qwertyuiop", "password12", "password123", "passw0rd123",
  "abcdefghij", "1q2w3e4r5t", "iloveyou123", "senha12345", "palavrapasse", "palavra-passe", "benfica1904",
  "sportinglisboa", "fcporto1893", "portugal123", "lisboa12345", "123456789a",
];

/** Devolve a mensagem de erro, ou null se a palavra-passe for aceitavel. Sem regras de simbolos: so tamanho e previsibilidade. */
export function validarSenha(senha: string, username: string): string | null {
  if (senha.length < 10) return "A palavra-passe tem de ter pelo menos 10 caracteres.";
  if (senha.length > 128) return "A palavra-passe e demasiado longa (maximo 128 caracteres).";
  const s = senha.toLowerCase();
  if (username && s.includes(username.toLowerCase())) return "A palavra-passe nao pode conter o seu utilizador.";
  if (s.includes("radical")) return "A palavra-passe nao pode conter o nome da escola.";
  if (/^(.)\1+$/.test(senha)) return "A palavra-passe e demasiado previsivel.";
  if (COMUNS.includes(s)) return "Essa palavra-passe e demasiado comum. Escolha outra.";
  if (new Set(senha).size < 5) return "A palavra-passe e demasiado previsivel.";
  return null;
}

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // sem 0/O, 1/l/I
/** Palavra-passe temporaria aleatoria, no formato XXXX-XXXX-XXXX (~69 bits). */
export function gerarSenhaTemporaria(): string {
  const limite = 256 - (256 % ALFABETO.length);
  let out = "";
  while (out.replace(/-/g, "").length < 12) {
    for (const b of crypto.getRandomValues(new Uint8Array(24))) {
      if (b >= limite) continue; // rejeicao para nao enviesar
      const n = out.replace(/-/g, "").length;
      if (n >= 12) break;
      if (n > 0 && n % 4 === 0 && !out.endsWith("-")) out += "-";
      out += ALFABETO[b % ALFABETO.length];
    }
  }
  return out;
}

/** "Marta Silva" -> "marta.silva" (primeiro e ultimo nome, sem acentos). */
export function sugerirUsername(nome: string): string {
  const partes = nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z\s'-]/g, "").split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  return partes.length === 1 ? partes[0] : `${partes[0]}.${partes[partes.length - 1]}`;
}
