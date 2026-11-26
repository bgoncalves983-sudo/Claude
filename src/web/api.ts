export class ErroApi extends Error {
  constructor(public estado: number, mensagem: string) {
    super(mensagem);
  }
}

export async function api<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api${caminho}`, {
    ...opcoes,
    headers: { "content-type": "application/json", ...opcoes.headers },
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroApi(r.status, (corpo as { erro?: string }).erro ?? `Erro ${r.status}`);
  return corpo as T;
}

export interface Utilizador { id: number; nome: string; email: string; perfil: "admin" | "gestor" | "instrutor" | "consulta" }
export interface Veiculo {
  id: number; matricula: string; tipo: string; categoria: string | null; marca: string | null;
  modelo: string | null; estado: string; kmAtuais: number | null; conjuntoAtivo?: { id: number; tratorId: number; reboqueId: number } | null;
}
export interface Alerta { chave: string; tipo: string; rotulo: string; data: string; dias: number; veiculoId?: number | null }
