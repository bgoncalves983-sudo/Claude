import { useCallback, useEffect, useState } from "react";
import { abrirLocal, locaisDoVeiculo, NOMES_TIPO, sincronizarDocs, type DocLocal } from "../lib/docs";
import { fdata, Icon } from "../ui";

/** Documentos a bordo do veiculo: guardados no telemovel, abrem sem rede. */
export function DocumentosBordo({ veiculoIds, veiculoId }: { veiculoIds: number[]; veiculoId: number }) {
  const [docs, setDocs] = useState<DocLocal[] | null>(null);
  const [aAtualizar, setAAtualizar] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const chave = veiculoIds.join(",");

  const ler = useCallback(async () => setDocs(await locaisDoVeiculo(veiculoId).catch(() => [])), [veiculoId]);
  const atualizar = useCallback(async () => {
    setAAtualizar(true);
    try { await sincronizarDocs(veiculoIds); } finally { setAAtualizar(false); await ler(); }
  }, [chave, ler]); // eslint-disable-line
  useEffect(() => { void ler(); void atualizar(); }, [veiculoId, chave]); // eslint-disable-line
  useEffect(() => {
    const f = () => { setOnline(navigator.onLine); if (navigator.onLine) void atualizar(); };
    addEventListener("online", f); addEventListener("offline", f);
    return () => { removeEventListener("online", f); removeEventListener("offline", f); };
  }, [atualizar]);

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h3><Icon n="file" s={18} />Documentos a bordo{!online && <span className="chip warn" style={{ marginLeft: "auto" }}>Sem rede</span>}</h3>
      {msg && <div className="errbox" style={{ marginBottom: 10 }} role="alert">{msg}</div>}
      {docs === null ? <div className="skel" style={{ height: 60 }} aria-busy="true" /> : docs.length === 0 ? (
        <span className="muted">{online ? "Ainda não há documentos de bordo para este veículo. O responsável de frota pode carregá-los." : "Sem rede e sem documentos guardados neste telemóvel. Abra esta página uma vez com rede para os guardar."}</span>
      ) : (
        <div className="rows">{docs.map((d) => (
          <div className="row" key={d.id}>
            <div><b>{NOMES_TIPO[d.tipo] ?? d.tipo}</b><small>{d.validade ? `Válido até ${fdata(d.validade)} · ` : ""}guardado no telemóvel</small></div>
            <button className="btn primary" onClick={async () => { setMsg(null); try { await abrirLocal(d.id); } catch (e) { setMsg((e as Error).message); } }}>Abrir</button>
          </div>))}</div>
      )}
      {docs && docs.length > 0 && <p className="muted" style={{ margin: "10px 0 0", fontSize: 12 }}>Estes documentos ficam guardados neste telemóvel e abrem mesmo sem rede.{online && <> <button className="btn ghost" style={{ minHeight: 32, padding: "0 8px" }} disabled={aAtualizar} onClick={() => void atualizar()}>{aAtualizar ? "A atualizar…" : "Atualizar"}</button></>}</p>}
    </div>
  );
}
