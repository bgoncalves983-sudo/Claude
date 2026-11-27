import { useMemo, useState, type FormEvent } from "react";
import { api, ErroApi, type Veiculo } from "../api";
import { Campo } from "../form";
import { Carregar, fdata, Icon, Matricula, TIPOS, useApi } from "../ui";

interface Assoc { id: number; tratorId: number; reboqueId: number; dataInicio: string; dataFim: string | null; motivo: string | null }
const PUXAM = ["pesado", "ligeiro", "trator_maquina"];

function Par({ a, mapa }: { a: Assoc; mapa: Map<number, Veiculo> }) {
  const t = mapa.get(a.tratorId), r = mapa.get(a.reboqueId);
  return (
    <div className="pair">
      <div className="mini"><Matricula m={t?.matricula ?? `#${a.tratorId}`} /><small className="muted">{t ? `${TIPOS[t.tipo]}${t.categoria ? ` · ${t.categoria}` : ""}` : "—"}</small></div>
      <span className="muted" aria-hidden="true"><Icon n="link" s={20} /></span>
      <div className="mini"><Matricula m={r?.matricula ?? `#${a.reboqueId}`} /><small className="muted">Reboque{r?.categoria ? ` · ${r.categoria}` : ""}</small></div>
    </div>
  );
}

function Historico({ veiculoId, mapa }: { veiculoId: number; mapa: Map<number, Veiculo> }) {
  const { dados } = useApi<Assoc[]>(`/conjuntos/veiculo/${veiculoId}`);
  return <div className="rows" style={{ marginTop: 10 }}>{dados?.map((a) => (
    <div className="row" key={a.id}><div><b>{mapa.get(a.reboqueId)?.matricula} com {mapa.get(a.tratorId)?.matricula}</b><small>{fdata(a.dataInicio)} a {a.dataFim ? fdata(a.dataFim) : "atual"}{a.motivo ? ` · ${a.motivo}` : ""}</small></div>{!a.dataFim && <span className="chip ok">Atual</span>}</div>))}</div>;
}

export function Conjuntos() {
  const ativos = useApi<Assoc[]>("/conjuntos");
  const veiculos = useApi<Veiculo[]>("/veiculos");
  const mapa = useMemo(() => new Map((veiculos.dados ?? []).map((v) => [v.id, v])), [veiculos.dados]);
  const [novo, setNovo] = useState(false);
  const [trator, setTrator] = useState(""); const [reboque, setReboque] = useState(""); const [motivo, setMotivo] = useState("");
  const [troca, setTroca] = useState<number | null>(null); const [novoReb, setNovoReb] = useState("");
  const [hist, setHist] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ t: string; erro?: boolean } | null>(null);

  const emUsoT = new Set((ativos.dados ?? []).map((a) => a.tratorId)), emUsoR = new Set((ativos.dados ?? []).map((a) => a.reboqueId));
  const ativosV = (veiculos.dados ?? []).filter((v) => v.estado === "ativo" || v.estado === "oficina");
  const tratoresLivres = ativosV.filter((v) => PUXAM.includes(v.tipo) && !emUsoT.has(v.id));
  const reboquesLivres = ativosV.filter((v) => v.tipo === "reboque" && !emUsoR.has(v.id));
  const haReboques = (veiculos.dados ?? []).some((v) => v.tipo === "reboque");
  const lbl = (v: Veiculo) => `${v.matricula} · ${[v.marca, v.modelo].filter(Boolean).join(" ")}${v.categoria ? ` (${v.categoria})` : ""}`;
  const recarregar = () => { ativos.recarregar(); veiculos.recarregar(); };
  const falha = (x: unknown) => setMsg({ t: (x as ErroApi).message, erro: true });

  async function criar(e: FormEvent) {
    e.preventDefault(); setMsg(null);
    try { await api("/conjuntos", { metodo: "POST", corpo: { tratorId: Number(trator), reboqueId: Number(reboque), motivo: motivo || null } }); setMsg({ t: "Conjunto criado." }); setNovo(false); setTrator(""); setReboque(""); setMotivo(""); recarregar(); } catch (x) { falha(x); }
  }
  async function trocar(id: number) {
    setMsg(null);
    try { await api(`/conjuntos/${id}/trocar`, { metodo: "POST", corpo: { reboqueId: Number(novoReb), motivo: motivo || null } }); setMsg({ t: "Reboque trocado. O anterior fica no histórico." }); setTroca(null); setNovoReb(""); setMotivo(""); recarregar(); } catch (x) { falha(x); }
  }
  async function terminar(id: number) {
    const m = prompt("Motivo (opcional):"); if (m === null) return;
    try { await api(`/conjuntos/${id}/terminar`, { metodo: "POST", corpo: { motivo: m || null } }); setMsg({ t: "Conjunto terminado." }); recarregar(); } catch (x) { falha(x); }
  }

  return (
    <Carregar erro={ativos.erro ?? veiculos.erro} dados={ativos.dados && veiculos.dados}>
      <div className="note">Só o responsável de frota associa, troca ou termina conjuntos. Cada alteração fica registada e o histórico mantém-se. Combinações permitidas: pesado C com reboque CE, e ligeiro B com reboque BE.</div>
      {msg && <div className={msg.erro ? "errbox" : "note"} role="status">{msg.t}</div>}
      {!haReboques && <div className="warnbox">Ainda não há reboques registados. Crie-os em <a href="#/veiculos/novo">Veículos → Novo veículo</a>, escolhendo o tipo <b>Reboque</b> e a categoria (por exemplo CE).</div>}

      <div className="card"><h3><Icon n="link" s={18} />Conjuntos ativos<span className="sp"><button className="btn primary" onClick={() => { setNovo((x) => !x); setMsg(null); }}><Icon n="plus" s={16} />Novo conjunto</button></span></h3>
        {novo && <form className="form" onSubmit={criar} style={{ marginBottom: 16 }}>
          <div className="fields">
            <Campo id="ct" label="Pesado (ou veículo que puxa)" valor={trator} onChange={setTrator} obrig opcoes={tratoresLivres.map((v) => [String(v.id), lbl(v)])} />
            <Campo id="cr" label="Reboque disponível" valor={reboque} onChange={setReboque} obrig opcoes={reboquesLivres.map((v) => [String(v.id), lbl(v)])} />
            <Campo id="cm" label="Motivo (opcional)" valor={motivo} onChange={setMotivo} />
          </div>
          <div className="actions"><button className="btn primary">Associar</button><button type="button" className="btn ghost" onClick={() => setNovo(false)}>Cancelar</button></div>
        </form>}
        {ativos.dados?.length === 0 && <span className="muted">Não há conjuntos ativos.</span>}
        <div className="rows">{ativos.dados?.map((a) => (
          <div className="row" key={a.id} style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
            <Par a={a} mapa={mapa} />
            <small className="muted">Desde {fdata(a.dataInicio)}{a.motivo ? ` · ${a.motivo}` : ""}</small>
            <div className="actions">
              <button className="btn" onClick={() => { setTroca(troca === a.id ? null : a.id); setMsg(null); }}>Trocar reboque</button>
              <button className="btn ghost" onClick={() => void terminar(a.id)}>Terminar</button>
              <button className="btn ghost" onClick={() => setHist(hist === a.tratorId ? null : a.tratorId)}>Histórico</button>
            </div>
            {troca === a.id && <div className="form" style={{ marginTop: 6 }}>
              <div className="fields"><Campo id={`nr${a.id}`} label="Novo reboque" valor={novoReb} onChange={setNovoReb} obrig opcoes={reboquesLivres.map((v) => [String(v.id), lbl(v)])} /><Campo id={`nm${a.id}`} label="Motivo" valor={motivo} onChange={setMotivo} /></div>
              <div className="actions"><button className="btn primary" disabled={!novoReb} onClick={() => void trocar(a.id)}>Confirmar troca</button></div>
            </div>}
            {hist === a.tratorId && <Historico veiculoId={a.tratorId} mapa={mapa} />}
          </div>))}</div>
      </div>
    </Carregar>
  );
}
