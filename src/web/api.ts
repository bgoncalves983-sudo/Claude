export class ErroApi extends Error {
  constructor(public estado: number, mensagem: string, public codigo?: string, public dados?: Record<string, unknown>) {
    super(mensagem);
  }
}

/** Todos os pedidos levam X-Requested-With: a API recusa alteracoes sem este cabecalho (protecao contra outros sites). */
export async function api<T>(caminho: string, opcoes: { metodo?: string; corpo?: unknown } = {}): Promise<T> {
  const r = await fetch(`/api${caminho}`, {
    method: opcoes.metodo ?? "GET",
    headers: { "content-type": "application/json", "x-requested-with": "frota" },
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
    credentials: "same-origin",
  });
  const dados = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new ErroApi(r.status, String(dados.erro ?? `Erro ${r.status}`), dados.codigo as string | undefined, dados);
  return dados as T;
}

export type Perfil = "admin" | "gestor" | "instrutor" | "consulta";
export interface Eu { id: number; nome: string; email: string | null; username: string | null; perfil: Perfil; deveMudarSenha: boolean }
export interface Veiculo {
  id: number; matricula: string; tipo: string; categoria: string | null; marca: string | null; modelo: string | null; cor: string | null;
  combustivel: string | null; dataMatricula: string | null; estado: string; proprietario: string | null; kmAtuais: number | null; horasAtuais: number | null;
  ensino: boolean; comandoDuplo: boolean; pesoBruto: number | null; tara: number | null; lugares: number | null; cilindrada: number | null;
  potenciaKw: number | null; pneus: string | null; tacografo: boolean; localizacao: string | null; vin: string | null; instrutorId: number | null; usaHoras: boolean;
  temFoto: boolean; conjuntoAtivo?: { id: number; tratorId: number; reboqueId: number } | null;
  // so a gestao recebe:
  dataAquisicao?: string | null; valorAquisicao?: number | null; fornecedor?: string | null; cartaoCombustivel?: string | null;
  iucAplicavel?: boolean; ipoPeriodicidadeMeses?: number | null; seguroCobertoPeloTrator?: boolean; dataAbate?: string | null; notas?: string | null; versao?: number;
}
export interface Alerta { chave: string; tipo: string; rotulo: string; data: string; dias: number; veiculoId?: number | null }
export interface UtilizadorLinha {
  id: number; nome: string; email: string | null; username: string | null; perfil: Perfil; metodo: "access" | "senha"; ativo: boolean; escola: string | null;
  deveMudarSenha: boolean; ultimoAcesso: string | null; bloqueado: boolean; bloqueadoSegundos: number; cartaValidade: string | null; licencaInstrutorValidade: string | null;
}
