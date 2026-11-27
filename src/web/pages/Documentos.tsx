import { useState, type FormEvent } from "react";
import { enviarFormulario, ErroApi } from "../api";
import { Campo } from "../form";
import { Carregar, fdata, Icon, useApi } from "../ui";

interface Doc { id: number; tipo: string; nomeFicheiro: string; validade: string | null; versao: number; tamanho: number; criadoEm: string }
const TIPOS = [["dua", "Documento Único Automóvel"], ["apolice", "Apólice de seguro"], ["recibo_seguro", "Recibo do seguro"], ["iuc", "IUC"], ["ipo", "Ficha de inspeção"], ["fatura", "Fatura"], ["foto", "Fotografia"], ["alvara", "Alvará"], ["outro", "Outro"]] as [string, string][];
const nomeTipo = (t: string) => TIPOS.find((x) => x[0] === t)?.[1] ?? t;

export function Documentos({ veiculoId, gestao }: { veiculoId: number | null; gestao: boolean }) {
  const { dados, erro, recarregar } = useApi<Doc[]>(veiculoId ? `/documentos?veiculoId=${veiculoId}` : "/documentos");
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState("dua"); const [validade, setValidade] = useState(""); const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null); const [aEnviar, setAEnviar] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault(); if (!ficheiro) return;
    setAEnviar(true); setMsg(null);
    const form = new FormData(); form.append("file", ficheiro); form.append("tipo", tipo); if (veiculoId) form.append("veiculoId", String(veiculoId)); if (validade) form.append("validade", validade);
    try { await enviarFormulario("/documentos", form); setAberto(false); setFicheiro(null); setValidade(""); recarregar(); } catch (x) { setMsg((x as ErroApi).message); } finally { setAEnviar(false); }
  }
  return (
    <div className="card"><h3><Icon n="file" s={18} />Documentos{gestao && <span className="sp"><button className="btn primary" onClick={() => setAberto((x) => !x)}><Icon n="plus" s={16} />Carregar</button></span>}</h3>
      {msg && <div className="errbox" style={{ marginBottom: 12 }} role="alert">{msg}</div>}
      {aberto && <form className="form" onSubmit={enviar} style={{ marginBottom: 16 }}>
        <div className="fields">
          <Campo id="dt" label="Tipo" valor={tipo} onChange={setTipo} opcoes={TIPOS} obrig />
          <Campo id="dv" label="Válido até (opcional)" valor={validade} onChange={setValidade} tipo="date" />
          <label className="f" htmlFor="df">Ficheiro (PDF, JPG, PNG; até 15 MB)<input id="df" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFicheiro(e.target.files?.[0] ?? null)} required /></label>
        </div>
        <div className="actions"><button className="btn primary" disabled={aEnviar || !ficheiro}>{aEnviar ? "A enviar…" : "Carregar"}</button><button type="button" className="btn ghost" onClick={() => setAberto(false)}>Cancelar</button></div>
      </form>}
      <Carregar erro={erro} dados={dados}>
        {dados?.length === 0 && <span className="muted">Ainda não há documentos.</span>}
        <div className="rows">{dados?.map((d) => (
          <div className="row" key={d.id}><div><b>{nomeTipo(d.tipo)}</b><small>{d.nomeFicheiro} · versão {d.versao} · {(d.tamanho / 1024).toFixed(0)} KB{d.validade ? ` · válido até ${fdata(d.validade)}` : ""}</small></div>
            <a className="btn" href={`/api/documentos/${d.id}/ficheiro`} target="_blank" rel="noopener">Abrir</a></div>))}</div>
      </Carregar>
    </div>
  );
}
