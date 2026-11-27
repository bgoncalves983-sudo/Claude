// Fila de envio no telemovel: se nao houver rede, o registo fica guardado e segue quando voltar.
// Cada registo leva um clienteId gerado aqui, por isso um reenvio nunca duplica no servidor.
import { api, ErroApi } from "../api";

interface Pendente { id: string; caminho: string; corpo: Record<string, unknown>; criadoEm: number; descricao: string }
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

const ouvintes = new Set<(n: number) => void>();
async function notificar() { const n = (await contar().catch(() => 0)); ouvintes.forEach((f) => f(n)); }
export const contar = () => tx<number>("readonly", (s) => s.count());
export function aoMudar(f: (n: number) => void) { ouvintes.add(f); contar().then(f).catch(() => {}); return () => { ouvintes.delete(f); }; }

const eErroDeRede = (e: unknown) => e instanceof TypeError || (e instanceof ErroApi && e.estado >= 500);

/** Envia; se a rede falhar, guarda para depois. Erros de validacao (4xx) sobem para o utilizador corrigir. */
export async function enviarOuGuardar<T = unknown>(caminho: string, corpo: Record<string, unknown>, descricao: string): Promise<{ pendente: boolean; resposta?: T }> {
  const comId = { ...corpo, clienteId: (corpo.clienteId as string) ?? crypto.randomUUID() };
  try { return { pendente: false, resposta: await api<T>(caminho, { metodo: "POST", corpo: comId }) }; }
  catch (e) {
    if (!eErroDeRede(e)) throw e;
    await tx("readwrite", (s) => s.put({ id: comId.clienteId, caminho, corpo: comId, criadoEm: Date.now(), descricao } satisfies Pendente));
    await notificar();
    return { pendente: true };
  }
}

let aSincronizar = false;
export async function sincronizar(): Promise<number> {
  if (aSincronizar || !navigator.onLine) return 0;
  aSincronizar = true; let enviados = 0;
  try {
    const todos = await tx<Pendente[]>("readonly", (s) => s.getAll());
    for (const p of todos.sort((a, b) => a.criadoEm - b.criadoEm)) {
      try { await api(p.caminho, { metodo: "POST", corpo: p.corpo }); await tx("readwrite", (s) => s.delete(p.id)); enviados++; }
      catch (e) {
        if (eErroDeRede(e)) break; // sem rede: tenta mais tarde
        if (e instanceof ErroApi && (e.estado === 401 || e.estado === 403)) break; // sessao terminada: mantem-se guardado
        await tx("readwrite", (s) => s.delete(p.id)); // recusado de vez (ex.: veiculo ja nao e seu): nao fica a tentar para sempre
      }
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
