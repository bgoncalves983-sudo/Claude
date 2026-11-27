// Fila de envio no telemovel: se nao houver rede, o registo (e as suas fotografias) ficam guardados e seguem quando voltar.
// Cada registo e cada foto levam um identificador gerado aqui, por isso um reenvio nunca duplica no servidor.
import { api, enviarFormulario, ErroApi } from "../api";

export interface FotoPendente { id: string; grande: Blob; mini: Blob }
interface Pendente {
  id: string; caminho: string; corpo: Record<string, unknown>; criadoEm: number; descricao: string;
  registoFeito?: boolean; fotos?: FotoPendente[]; veiculoId?: number;
}
const BD = "frota-fila", STORE = "pendentes";

function abrir(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(BD, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const tx = async <T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const d = await abrir();
  return new Promise((res, rej) => { const q = f(d.transaction(STORE, modo).objectStore(STORE)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
};
const guardar = (p: Pendente) => tx("readwrite", (s) => s.put(p));
const apagar = (id: string) => tx("readwrite", (s) => s.delete(id));

const ouvintes = new Set<(n: number) => void>();
async function notificar() { const n = await contar().catch(() => 0); ouvintes.forEach((f) => f(n)); }
export const contar = () => tx<number>("readonly", (s) => s.count());
export function aoMudar(f: (n: number) => void) { ouvintes.add(f); contar().then(f).catch(() => {}); return () => { ouvintes.delete(f); }; }

const eErroDeRede = (e: unknown) => e instanceof TypeError || (e instanceof ErroApi && e.estado >= 500);
const eSessao = (e: unknown) => e instanceof ErroApi && (e.estado === 401 || e.estado === 403);

type Resultado = { estado: "feito" | "pendente"; resposta?: unknown };

/** Envia o registo e depois as fotografias, guardando o progresso: se a rede cair a meio, retoma onde ficou. */
async function processar(p: Pendente, aoErro: "subir" | "ignorar"): Promise<Resultado> {
  let resposta: unknown;
  if (!p.registoFeito) {
    try { resposta = await api(p.caminho, { metodo: "POST", corpo: p.corpo }); p.registoFeito = true; await guardar(p); }
    catch (e) {
      if (eErroDeRede(e) || eSessao(e)) return { estado: "pendente" };
      await apagar(p.id); // recusado de vez (validacao): nao fica a tentar para sempre
      if (aoErro === "subir") throw e;
      return { estado: "feito" };
    }
  }
  for (const f of [...(p.fotos ?? [])]) {
    const form = new FormData();
    form.append("grande", f.grande, "g.jpg"); form.append("mini", f.mini, "m.jpg"); form.append("clienteId", f.id); form.append("avariaClienteId", String(p.corpo.clienteId));
    try { await enviarFormulario(`/veiculos/${p.veiculoId}/avaria-fotos`, form); }
    catch (e) { if (eErroDeRede(e) || eSessao(e)) return { estado: "pendente", resposta }; /* 4xx: descarta so esta foto */ }
    p.fotos = p.fotos!.filter((x) => x.id !== f.id); await guardar(p);
  }
  await apagar(p.id);
  return { estado: "feito", resposta };
}

/** Guarda primeiro (nada se perde se a pagina fechar) e envia a seguir. Erros de validacao sobem para o utilizador corrigir. */
export async function enviarOuGuardar<T = unknown>(caminho: string, corpo: Record<string, unknown>, descricao: string, fotos: FotoPendente[] = []): Promise<{ pendente: boolean; resposta?: T }> {
  const clienteId = (corpo.clienteId as string) ?? crypto.randomUUID();
  const p: Pendente = { id: clienteId, caminho, corpo: { ...corpo, clienteId }, criadoEm: Date.now(), descricao, fotos, veiculoId: Number(caminho.match(/\/veiculos\/(\d+)\//)?.[1]) };
  await guardar(p); await notificar();
  try {
    const r = await processar(p, "subir");
    return { pendente: r.estado === "pendente", resposta: r.resposta as T | undefined };
  } finally { await notificar(); }
}

let aSincronizar = false;
export async function sincronizar(): Promise<number> {
  if (aSincronizar || !navigator.onLine) return 0;
  aSincronizar = true; let enviados = 0;
  try {
    const todos = await tx<Pendente[]>("readonly", (s) => s.getAll());
    for (const p of todos.sort((a, b) => a.criadoEm - b.criadoEm)) {
      const r = await processar(p, "ignorar");
      if (r.estado === "feito") enviados++; else break; // sem rede ou sem sessao: tenta mais tarde
    }
  } finally { aSincronizar = false; await notificar(); }
  return enviados;
}
export function iniciarSincronizacao() {
  addEventListener("online", () => void sincronizar());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void sincronizar(); });
  setInterval(() => void sincronizar(), 60_000);
  void sincronizar();
}
