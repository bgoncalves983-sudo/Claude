import { useEffect, useState, type FormEvent } from "react";
import type { Eu, Veiculo } from "../api";
import { ErroApi } from "../api";
import { Campo, num } from "../form";
import { enviarOuGuardar } from "../lib/fila";
import { Carregar, ChipEstado, Foto, Icon, Matricula, useApi } from "../ui";

function useMeuVeiculo() {
  const r = useApi<Veiculo[]>("/veiculos");
  return { ...r, v: r.dados?.[0] ?? null };
}

export function Inicio({ eu }: { eu: Eu }) {
  const { dados, erro, v } = useMeuVeiculo();
  return (
    <Carregar erro={erro} dados={dados}>
      {!v && <div className="card"><h3>Olá, {eu.nome.split(" ")[0]}</h3><p className="muted" style={{ margin: 0 }}>Ainda não tem um veículo atribuído. Fale com o responsável de frota.</p></div>}
      {v && <>
        <a href={`#/veiculos/${v.id}`} className="vcard" style={{ maxWidth: 560 }}>
          <Foto tipo={v.tipo} v={v} grande />
          <div className="vbody"><div className="vmeta"><Matricula m={v.matricula} /><ChipEstado e={v.estado} /></div><b>{[v.marca, v.modelo].filter(Boolean).join(" ")}</b>
            <span className="muted">{v.usaHoras ? `${v.horasAtuais ?? "—"} h` : `${v.kmAtuais?.toLocaleString("pt-PT") ?? "—"} km`}{v.combustivel ? ` · ${v.combustivel}` : ""}</span></div>
        </a>
        <div className="card" style={{ display: "grid", gap: 10, maxWidth: 560 }}><b>Verificação diária do veículo</b><a className="btn primary big" href="#/verificacao"><Icon n="check" s={20} />Fazer verificação</a></div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", maxWidth: 560 }}><a className="btn big" href="#/abastecer"><Icon n="fuel" s={20} />Abastecer</a><a className="btn big" href="#/avaria"><Icon n="alert" s={20} />Avaria</a></div>
      </>}
    </Carregar>
  );
}

function Resultado({ pendente, ok }: { pendente: boolean; ok: string }) {
  return (
    <div className="card" role="status" style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      <b>{pendente ? "Guardado no telemóvel" : ok}</b>
      <span className="muted">{pendente ? "Sem rede neste momento. O registo segue sozinho assim que houver ligação." : ""}</span>
      <a className="btn primary" href="#/">Voltar ao início</a>
    </div>
  );
}

export function Abastecer() {
  const { dados, erro, v } = useMeuVeiculo();
  const [origem, setOrigem] = useState<"deposito" | "posto">("deposito");
  const [f, setF] = useState<Record<string, string>>({});
  const [res, setRes] = useState<{ pendente: boolean; aviso?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const s = (k: string) => (x: string) => setF((o) => ({ ...o, [k]: x }));
  async function enviar(e: FormEvent) {
    e.preventDefault(); if (!v) return; setErr(null);
    try {
      const r = await enviarOuGuardar<{ aviso?: string }>(`/veiculos/${v.id}/abastecimentos`, { origem, litros: num(f.litros ?? ""), [v.usaHoras ? "horas" : "km"]: num(f.km ?? ""), valor: origem === "posto" ? num(f.valor ?? "") : null, posto: origem === "posto" ? f.posto || null : null }, `Abastecimento ${v.matricula}`);
      setRes({ pendente: r.pendente, aviso: r.resposta?.aviso });
    } catch (x) { setErr((x as ErroApi).message); }
  }
  if (res) return <><Resultado pendente={res.pendente} ok="Abastecimento guardado." />{res.aviso && <div className="warnbox">{res.aviso}</div>}</>;
  return (
    <Carregar erro={erro} dados={dados}>
      {!v ? <div className="card">Sem veículo atribuído.</div> : <form className="form" onSubmit={enviar} style={{ maxWidth: 560 }}>
        <div className="note"><Matricula m={v.matricula} /> {v.marca} {v.modelo}. Último registo: {v.usaHoras ? `${v.horasAtuais ?? "—"} h` : `${v.kmAtuais?.toLocaleString("pt-PT") ?? "—"} km`}</div>
        <div className="chips" role="group" aria-label="Onde abasteceu"><button type="button" aria-pressed={origem === "deposito"} onClick={() => setOrigem("deposito")}>Depósito do parque</button><button type="button" aria-pressed={origem === "posto"} onClick={() => setOrigem("posto")}>Posto externo</button></div>
        <div className="card form"><div className="fields">
          <Campo id="l" label="Litros" tipo="number" obrig valor={f.litros ?? ""} onChange={s("litros")} />
          <Campo id="k" label={v.usaHoras ? "Horas no contador" : "Quilómetros no conta-quilómetros"} tipo="number" passo="1" valor={f.km ?? ""} onChange={s("km")} />
          {origem === "posto" && <><Campo id="v" label="Valor pago (€)" tipo="number" obrig valor={f.valor ?? ""} onChange={s("valor")} /><Campo id="p" label="Posto" valor={f.posto ?? ""} onChange={s("posto")} /></>}
        </div>{origem === "deposito" && <div className="note">Os litros saem do depósito do parque. Não precisa de indicar valores.</div>}</div>
        {err && <div className="errbox" role="alert">{err}</div>}
        <button className="btn primary big">Guardar abastecimento</button>
      </form>}
    </Carregar>
  );
}

export function Avaria() {
  const { dados, erro, v } = useMeuVeiculo();
  const [descricao, setDescricao] = useState("");
  const [res, setRes] = useState<{ pendente: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function enviar(e: FormEvent) {
    e.preventDefault(); if (!v) return; setErr(null);
    try { const r = await enviarOuGuardar(`/veiculos/${v.id}/avarias`, { descricao }, `Avaria ${v.matricula}`); setRes({ pendente: r.pendente }); } catch (x) { setErr((x as ErroApi).message); }
  }
  if (res) return <Resultado pendente={res.pendente} ok="Avaria reportada ao responsável de frota." />;
  return (
    <Carregar erro={erro} dados={dados}>
      {!v ? <div className="card">Sem veículo atribuído.</div> : <form className="form" onSubmit={enviar} style={{ maxWidth: 560 }}>
        <div className="note"><Matricula m={v.matricula} /> {v.marca} {v.modelo}</div>
        <div className="card form"><Campo id="d" label="O que se passa?" area obrig valor={descricao} onChange={setDescricao} largo /></div>
        {err && <div className="errbox" role="alert">{err}</div>}
        <button className="btn primary big">Enviar ao responsável de frota</button>
      </form>}
    </Carregar>
  );
}

const ITENS = ["Pneus e pressão", "Luzes e sinalização", "Óleo e líquidos", "Travões", "Espelhos e vidros", "Documentos a bordo", "Limpeza"];
export function Verificacao() {
  const { dados, erro, v } = useMeuVeiculo();
  const [estado, setEstado] = useState<Record<string, boolean>>(() => Object.fromEntries(ITENS.map((i) => [i, true])));
  const [notas, setNotas] = useState("");
  const [res, setRes] = useState<{ pendente: boolean; problema: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const falhas = ITENS.filter((i) => !estado[i]);
  useEffect(() => { setErr(null); }, [estado]);
  async function enviar(e: FormEvent) {
    e.preventDefault(); if (!v) return; setErr(null);
    if (falhas.length && notas.trim().length < 3) return setErr("Descreva o problema nas notas.");
    try { const r = await enviarOuGuardar(`/veiculos/${v.id}/verificacoes`, { itens: ITENS.map((i) => ({ item: i, ok: estado[i] })), notas: notas || null }, `Verificação ${v.matricula}`); setRes({ pendente: r.pendente, problema: falhas.length > 0 }); } catch (x) { setErr((x as ErroApi).message); }
  }
  if (res) return <Resultado pendente={res.pendente} ok={res.problema ? "Verificação enviada. Foi criada uma avaria para o responsável de frota." : "Verificação concluída. Bom trabalho!"} />;
  return (
    <Carregar erro={erro} dados={dados}>
      {!v ? <div className="card">Sem veículo atribuído.</div> : <form className="form" onSubmit={enviar} style={{ maxWidth: 560 }}>
        <div className="note"><Matricula m={v.matricula} /> Antes da primeira aula. Demora menos de um minuto.</div>
        <div className="card">{ITENS.map((i) => (
          <div className="chk" key={i}><b>{i}</b>
            <div className="okno" role="group" aria-label={i}><button type="button" className="y" aria-pressed={estado[i]} onClick={() => setEstado((o) => ({ ...o, [i]: true }))}>OK</button><button type="button" className="n" aria-pressed={!estado[i]} onClick={() => setEstado((o) => ({ ...o, [i]: false }))}>Problema</button></div></div>))}</div>
        {falhas.length > 0 && <div className="card form"><Campo id="n" label={`O que notou? (${falhas.join(", ")})`} area valor={notas} onChange={setNotas} largo /><div className="warnbox">Será criada uma avaria e o responsável de frota recebe um aviso.</div></div>}
        {err && <div className="errbox" role="alert">{err}</div>}
        <button className="btn primary big">Enviar verificação</button>
      </form>}
    </Carregar>
  );
}
