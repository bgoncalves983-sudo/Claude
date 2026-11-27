export class ErroApi extends Error {
  constructor(public estado: number, mensagem: string, public codigo?: string, public dados?: Record<string, unknown>) {
    super(mensagem);
  }
}

// Respostas guardadas no telemovel (so o que o instrutor precisa para trabalhar sem rede).
const CACHEAVEIS = [/^\/me$/, /^\/veiculos\/para-registo$/, /^\/documentos\?veiculoId=\d+$/];
const chaveCache = (caminho: string) => `c:${caminho}`;
const lerCache = <T>(caminho: string): T | null => { try { const x = localStorage.getItem(chaveCache(caminho)); return x ? (JSON.parse(x) as { d: T }).d : null; } catch { return null; } };
/** Apaga tudo o que ficou guardado no telemovel (ao sair, para o proximo utilizador nao ver dados alheios). */
export function limparCacheLocal() {
  try { for (const k of Object.keys(localStorage)) if (k.startsWith("c:") || k.startsWith("veiculo") ) localStorage.removeItem(k); } catch { /* sem armazenamento */ }
}

/** Todos os pedidos levam X-Requested-With: a API recusa alteracoes sem este cabecalho (protecao contra outros sites).
 *  Sem rede, as leituras essenciais do instrutor respondem com a ultima copia guardada. */
export async function api<T>(caminho: string, opcoes: { metodo?: string; corpo?: unknown } = {}): Promise<T> {
  const metodo = opcoes.metodo ?? "GET";
  const cacheavel = metodo === "GET" && CACHEAVEIS.some((r) => r.test(caminho));
  let r: Response;
  try {
    r = await fetch(`/api${caminho}`, {
      method: metodo,
      headers: { "content-type": "application/json", "x-requested-with": "frota" },
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
      credentials: "same-origin",
    });
  } catch (e) {
    const guardado = cacheavel ? lerCache<T>(caminho) : null;
    if (guardado !== null) return guardado; // sem rede: usa a ultima copia
    throw e;
  }
  const dados = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) {
    if (r.status === 401) limparCacheLocal();
    throw new ErroApi(r.status, String(dados.erro ?? `Erro ${r.status}`), dados.codigo as string | undefined, dados);
  }
  if (cacheavel) { try { localStorage.setItem(chaveCache(caminho), JSON.stringify({ em: Date.now(), d: dados })); } catch { /* sem espaco */ } }
  return dados as T;
}

export type Perfil = "admin" | "gestor" | "instrutor" | "consulta";
export interface Eu { id: number; nome: string; email: string | null; username: string | null; perfil: Perfil; deveMudarSenha: boolean }
export interface Veiculo {
  id: number; matricula: string; tipo: string; categoria: string | null; marca: string | null; modelo: string | null; cor: string | null;
  combustivel: string | null; dataMatricula: string | null; estado: string; proprietario: string | null; kmAtuais: number | null; horasAtuais: number | null;
  ensino: boolean; comandoDuplo: boolean; pesoBruto: number | null; tara: number | null; lugares: number | null; cilindrada: number | null;
  potenciaKw: number | null; pneus: string | null; tacografo: boolean; localizacao: string | null; vin: string | null; instrutorId: number | null; usaHoras: boolean;
  temFoto: boolean; fotoVersao?: string | null; conjuntoAtivo?: { id: number; tratorId: number; reboqueId: number } | null;
  // so a gestao recebe:
  dataAquisicao?: string | null; valorAquisicao?: number | null; fornecedor?: string | null; cartaoCombustivel?: string | null;
  iucAplicavel?: boolean; ipoPeriodicidadeMeses?: number | null; seguroCobertoPeloTrator?: boolean; dataAbate?: string | null; notas?: string | null; versao?: number;
}
export interface Alerta { chave: string; tipo: string; rotulo: string; data: string; dias: number; veiculoId?: number | null }
export interface UtilizadorLinha {
  id: number; nome: string; email: string | null; username: string | null; perfil: Perfil; metodo: "access" | "senha"; ativo: boolean; escola: string | null;
  deveMudarSenha: boolean; ultimoAcesso: string | null; bloqueado: boolean; bloqueadoSegundos: number; cartaValidade: string | null; licencaInstrutorValidade: string | null;
}

/** Envio de ficheiros (multipart): o browser define o Content-Type com o separador certo. */
export async function enviarFormulario<T>(caminho: string, form: FormData): Promise<T> {
  const r = await fetch(`/api${caminho}`, { method: "POST", headers: { "x-requested-with": "frota" }, body: form, credentials: "same-origin" });
  const dados = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new ErroApi(r.status, String(dados.erro ?? `Erro ${r.status}`), dados.codigo as string | undefined, dados);
  return dados as T;
}
