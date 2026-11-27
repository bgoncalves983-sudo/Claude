// Documentos de bordo (DUA, apolice...) guardados no telemovel para mostrar as autoridades mesmo sem rede.
import { api } from "../api";

export interface DocLocal { id: number; veiculoId: number; tipo: string; nome: string; tamanho: number; validade: string | null; versao: number; guardadoEm: number; blob: Blob }
interface DocApi { id: number; veiculoId: number; tipo: string; nomeFicheiro: string; tamanho: number; validade: string | null; versao: number }

const BD = "frota-docs", STORE = "docs", LIMITE = 40 * 1024 * 1024;
export const NOMES_TIPO: Record<string, string> = { dua: "Documento Único Automóvel", apolice: "Apólice de seguro", recibo_seguro: "Recibo do seguro", ipo: "Ficha de inspeção" };

function abrir(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(BD, 1);
    r.onupgradeneeded = () => { const s = r.result.createObjectStore(STORE, { keyPath: "id" }); s.createIndex("veiculo", "veiculoId"); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const pedido = <T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
  abrir().then((d) => new Promise<T>((res, rej) => { const q = f(d.transaction(STORE, modo).objectStore(STORE)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }));

export const todosLocais = () => pedido<DocLocal[]>("readonly", (s) => s.getAll());
export const locaisDoVeiculo = async (veiculoId: number) => (await todosLocais()).filter((d) => d.veiculoId === veiculoId).sort((a, b) => a.tipo.localeCompare(b.tipo));
export const limparDocsLocais = () => pedido("readwrite", (s) => s.clear()).catch(() => {});

let aSincronizar = false;
/** Descarrega para o telemovel a versao mais recente de cada documento de bordo dos veiculos indicados; remove o que ja nao existe. */
export async function sincronizarDocs(veiculoIds: number[]): Promise<{ guardados: number; novos: number }> {
  if (aSincronizar || !navigator.onLine || veiculoIds.length === 0) return { guardados: 0, novos: 0 };
  aSincronizar = true; let novos = 0;
  try {
    const locais = await todosLocais();
    let usado = locais.reduce((n, d) => n + d.tamanho, 0);
    for (const vid of veiculoIds) {
      let lista: DocApi[];
      try { lista = await api<DocApi[]>(`/documentos?veiculoId=${vid}`); } catch { continue; }
      // so a versao mais recente de cada tipo
      const maisRecentes = [...new Map(lista.sort((a, b) => a.versao - b.versao).map((d) => [d.tipo, d])).values()];
      const idsAtuais = new Set(maisRecentes.map((d) => d.id));
      for (const antigo of locais.filter((l) => l.veiculoId === vid && !idsAtuais.has(l.id))) { await pedido("readwrite", (s) => s.delete(antigo.id)); usado -= antigo.tamanho; }
      for (const d of maisRecentes) {
        if (locais.some((l) => l.id === d.id)) continue;
        if (usado + d.tamanho > LIMITE) continue;
        try {
          const r = await fetch(`/api/documentos/${d.id}/ficheiro`, { credentials: "same-origin" });
          if (!r.ok) continue;
          const blob = await r.blob();
          await pedido("readwrite", (s) => s.put({ id: d.id, veiculoId: vid, tipo: d.tipo, nome: d.nomeFicheiro, tamanho: blob.size, validade: d.validade, versao: d.versao, guardadoEm: Date.now(), blob } satisfies DocLocal));
          usado += blob.size; novos++;
        } catch { /* sem rede a meio: tenta da proxima vez */ }
      }
    }
  } finally { aSincronizar = false; }
  return { guardados: (await todosLocais()).length, novos };
}

/** Abre o documento guardado (funciona sem rede). */
export async function abrirLocal(id: number): Promise<void> {
  const d = await pedido<DocLocal | undefined>("readonly", (s) => s.get(id));
  if (!d) throw new Error("Este documento ainda não está guardado no telemóvel. Ligue-se à rede para o descarregar.");
  const url = URL.createObjectURL(d.blob);
  const w = window.open(url, "_blank");
  if (!w) location.href = url; // popup bloqueado: abre no mesmo separador
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
}
