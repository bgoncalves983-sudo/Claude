import type { Env } from "../env";

const PREFIXO = "backups/";
const MANTER = 12; // ultimas 12 copias (cerca de 3 meses, se semanais)
// Dados de seguranca que nao vao para as copias: sessoes e tentativas de login.
const EXCLUIR = new Set(["sessao", "tentativa_login", "d1_migrations"]);

/** Copia de todas as tabelas para um ficheiro JSON comprimido no R2 (privado). As palavras-passe nao vao na copia. */
export async function fazerBackup(env: Env, nome: string): Promise<{ nome: string; tamanho: number; tabelas: number }> {
  const { results: tabelas } = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all<{ name: string }>();
  const dados: Record<string, unknown[]> = {};
  for (const { name } of tabelas) {
    if (EXCLUIR.has(name)) continue;
    const { results } = await env.DB.prepare(`SELECT * FROM "${name.replace(/"/g, "")}"`).all<Record<string, unknown>>();
    dados[name] = name === "utilizador" ? results.map((r) => ({ ...r, senha_hash: null, deve_mudar_senha: 1 })) : results;
  }
  const json = JSON.stringify({ versao: 1, criadoEm: new Date().toISOString(), tabelas: dados });
  const gz = new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip")));
  const corpo = await gz.arrayBuffer();
  await env.DOCS.put(`${PREFIXO}${nome}.json.gz`, corpo, { httpMetadata: { contentType: "application/gzip" } });
  await limparAntigos(env);
  return { nome: `${nome}.json.gz`, tamanho: corpo.byteLength, tabelas: Object.keys(dados).length };
}

export async function listarBackups(env: Env) {
  const l = await env.DOCS.list({ prefix: PREFIXO });
  return l.objects.map((o) => ({ nome: o.key.slice(PREFIXO.length), tamanho: o.size, data: o.uploaded.toISOString() })).sort((a, b) => b.nome.localeCompare(a.nome));
}

async function limparAntigos(env: Env) {
  const todos = (await listarBackups(env)).slice(MANTER);
  for (const b of todos) await env.DOCS.delete(PREFIXO + b.nome);
}

export const caminhoBackup = (nome: string) => PREFIXO + nome;
