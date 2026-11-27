import { useEffect, useState, type FormEvent } from "react";
import type { Eu, Veiculo } from "../api";
import { ErroApi } from "../api";
import { Campo, num } from "../form";
import { enviarOuGuardar } from "../lib/fila";
import { EscolherVeiculo, guardarRecente } from "./EscolherVeiculo";
import { EscolherFotos, type FotoLocal } from "./Fotos";
import { Carregar, ChipEstado, Foto, Icon, Matricula, useApi } from "../ui";

interface Para { atribuidos: Veiculo[]; podeEscolherOutro: boolean; outros: Veiculo[] }
const CHAVE = "veiculo-escolhido";
const lerEscolha = () => { try { return Number(localStorage.getItem(CHAVE)) || null; } catch { return null; } };

/** O veiculo onde o instrutor vai registar: um dos seus atribuidos ou, se a regra o permitir, outro. */
function useEscolha() {
  const r = useApi<Para>("/veiculos/para-registo");
  const [id, setId] = useState<number | null>(lerEscolha);
  const d = r.dados;
  const todos = d ? [...d.atribuidos, ...(d.podeEscolherOutro ? d.outros : [])] : [];
  const v = todos.find((x) => x.id === id) ?? d?.atribuidos[0] ?? null;
  const atribuido = !!v && !!d?.atribuidos.some((a) => a.id === v.id);
  const escolher = (novo: number) => { setId(novo); guardarRecente(novo); try { localStorage.setItem(CHAVE, String(novo)); } catch { /* sem armazenamento: so nesta sessao */ } };
  return { ...r, v, atribuido, escolher };
}
type Escolha = ReturnType<typeof useEscolha>;

/** Barra com o veiculo atual. "Trocar" abre o ecra de escolha (pesquisa, filtros, recentes, QR). */
function Seletor({ e }: { e: Escolha }) {
  const d = e.dados;
  const [aberto, setAberto] = useState(false);
  if (!d) return null;
  const pode = d.atribuidos.length > 1 || d.podeEscolherOutro;
  const aberta = aberto || !e.v; // sem veiculo, abre logo a escolha
  return (
    <>
      {e.v ? (
        <div className="barra-veiculo">
          <div className="t"><div><Matricula m={e.v.matricula} /></div><b>{[e.v.marca, e.v.modelo].filter(Boolean).join(" ")}</b>
            {!e.atribuido && <span className="chip warn" style={{ justifySelf: "start" }}>Não atribuído a si</span>}</div>
          {pode && <button type="button" className="btn" onClick={() => setAberto(true)}>Trocar</button>}
        </div>
      ) : null}
      {aberta && pode && <EscolherVeiculo atribuidos={d.atribuidos} outros={d.outros} podeEscolherOutro={d.podeEscolherOutro} atual={e.v?.id ?? null} aoEscolher={(id) => { e.escolher(id); setAberto(false); }} fechar={() => setAberto(false)} />}
      {!e.v && !pode && <div className="card" style={{ maxWidth: 560 }}>Não há veículos disponíveis. Fale com o responsável de frota.</div>}
    </>
  );
}

/** Ligacao de um QR colado no veiculo: usa o veiculo (se a regra o permitir) e volta ao inicio. */
export function UsarVeiculo({ id }: { id: number }) {
  const { dados, erro } = useApi<Para>("/veiculos/para-registo");
  useEffect(() => {
    if (!dados) return;
    const ok = [...dados.atribuidos, ...(dados.podeEscolherOutro ? dados.outros : [])].some((v) => v.id === id);
    if (ok) { guardarRecente(id); try { localStorage.setItem(CHAVE, String(id)); } catch { /* sem armazenamento */ } location.hash = "#/"; }
  }, [dados, id]);
  const ok = dados && [...dados.atribuidos, ...(dados.podeEscolherOutro ? dados.outros : [])].some((v) => v.id === id);
  return <Carregar erro={erro} dados={dados}>{!ok && <div className="card" style={{ maxWidth: 560 }}><h3>Este veículo não está disponível para si</h3><p className="muted" style={{ marginTop: 0 }}>Tem mais de um veículo atribuído, e só pode usar esses. Ou o veículo não está ativo.</p><a className="btn primary" href="#/">Voltar ao início</a></div>}</Carregar>;
}

export function Inicio({ eu }: { eu: Eu }) {
  const e = useEscolha();
  const { dados, erro, v } = e;
  return (
    <Carregar erro={erro} dados={dados}>
      <Seletor e={e} />
      {v && <>
        {(e.atribuido ? <a href={`#/veiculos/${v.id}`} className="vcard" style={{ maxWidth: 560 }}>
          <Foto tipo={v.tipo} v={v} grande />
          <div className="vbody"><div className="vmeta"><Matricula m={v.matricula} /><ChipEstado e={v.estado} /></div><b>{[v.marca, v.modelo].filter(Boolean).join(" ")}</b>
            <span className="muted">{v.usaHoras ? `${v.horasAtuais ?? "—"} h` : `${v.kmAtuais?.toLocaleString("pt-PT") ?? "—"} km`}{v.combustivel ? ` · ${v.combustivel}` : ""}</span></div>
        </a> : null)}
        <div className="card" style={{ display: "grid", gap: 10, maxWidth: 560 }}><b>Verificação diária do veículo</b><a className="btn primary big" href="#/verificacao"><Icon n="check" s={20} />Fazer verificação</a></div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", maxWidth: 560 }}><a className="btn big" href="#/abastecer"><Icon n="fuel" s={20} />Abastecer</a><a className="btn big" href="#/avaria"><Icon n="alert" s={20} />Avaria</a></div>
      </>}
      {!v && <p className="muted">Olá, {eu.nome.split(" ")[0]}. Escolha acima o veículo para começar.</p>}
    </Carregar>
  );
}

function Resultado({ pendente, ok }: { pendente: boolean; ok: string }) {
  return (
    <div className="card" role="status" style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      <b>{pendente ? "Guardado no telemóvel" : ok}</b>
      <span className="muted">{pendente ? "Sem rede neste momento. O registo (e as fotografias) seguem sozinhos assim que houver ligação." : ""}</span>
      <a className="btn primary" href="#/">Voltar ao início</a>
    </div>
  );
}

export function Abastecer() {
  const e = useEscolha();
  const { dados, erro, v } = e;
  const [origem, setOrigem] = useState<"deposito" | "posto">("deposito");
  const [f, setF] = useState<Record<string, string>>({});
  const [res, setRes] = useState<{ pendente: boolean; aviso?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const s = (k: string) => (x: string) => setF((o) => ({ ...o, [k]: x }));
  async function enviar(ev: FormEvent) {
    ev.preventDefault(); if (!v) return; setErr(null);
    try {
      const r = await enviarOuGuardar<{ aviso?: string }>(`/veiculos/${v.id}/abastecimentos`, { origem, litros: num(f.litros ?? ""), [v.usaHoras ? "horas" : "km"]: num(f.km ?? ""), valor: origem === "posto" ? num(f.valor ?? "") : null, posto: origem === "posto" ? f.posto || null : null }, `Abastecimento ${v.matricula}`);
      setRes({ pendente: r.pendente, aviso: r.resposta?.aviso });
    } catch (x) { setErr((x as ErroApi).message); }
  }
  if (res) return <><Resultado pendente={res.pendente} ok="Abastecimento guardado." />{res.aviso && <div className="warnbox">{res.aviso}</div>}</>;
  return (
    <Carregar erro={erro} dados={dados}>
      <Seletor e={e} />
      {!v ? null : <form className="form" onSubmit={enviar} style={{ maxWidth: 560 }}>
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
  const e = useEscolha();
  const { dados, erro, v } = e;
  const [descricao, setDescricao] = useState("");
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [res, setRes] = useState<{ pendente: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function enviar(ev: FormEvent) {
    ev.preventDefault(); if (!v) return; setErr(null);
    try { const r = await enviarOuGuardar(`/veiculos/${v.id}/avarias`, { descricao }, `Avaria ${v.matricula}`, fotos); setRes({ pendente: r.pendente }); } catch (x) { setErr((x as ErroApi).message); }
  }
  if (res) return <Resultado pendente={res.pendente} ok="Avaria reportada ao responsável de frota." />;
  return (
    <Carregar erro={erro} dados={dados}>
      <Seletor e={e} />
      {!v ? null : <form className="form" onSubmit={enviar} style={{ maxWidth: 560 }}>
        <div className="note"><Matricula m={v.matricula} /> {v.marca} {v.modelo}</div>
        <div className="card form"><Campo id="d" label="O que se passa?" area obrig valor={descricao} onChange={setDescricao} largo /><b style={{ fontSize: 13 }}>Fotografias (opcional)</b><EscolherFotos fotos={fotos} onChange={setFotos} /></div>
        {err && <div className="errbox" role="alert">{err}</div>}
        <button className="btn primary big">Enviar ao responsável de frota</button>
      </form>}
    </Carregar>
  );
}

const ITENS = ["Pneus e pressão", "Luzes e sinalização", "Óleo e líquidos", "Travões", "Espelhos e vidros", "Documentos a bordo", "Limpeza"];
export function Verificacao() {
  const e = useEscolha();
  const { dados, erro, v } = e;
  const [estado, setEstado] = useState<Record<string, boolean>>(() => Object.fromEntries(ITENS.map((i) => [i, true])));
  const [notas, setNotas] = useState("");
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [res, setRes] = useState<{ pendente: boolean; problema: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const falhas = ITENS.filter((i) => !estado[i]);
  useEffect(() => { setErr(null); }, [estado]);
  async function enviar(ev: FormEvent) {
    ev.preventDefault(); if (!v) return; setErr(null);
    if (falhas.length && notas.trim().length < 3) return setErr("Descreva o problema nas notas.");
    try { const r = await enviarOuGuardar(`/veiculos/${v.id}/verificacoes`, { itens: ITENS.map((i) => ({ item: i, ok: estado[i] })), notas: notas || null }, `Verificação ${v.matricula}`, falhas.length ? fotos : []); setRes({ pendente: r.pendente, problema: falhas.length > 0 }); } catch (x) { setErr((x as ErroApi).message); }
  }
  if (res) return <Resultado pendente={res.pendente} ok={res.problema ? "Verificação enviada. Foi criada uma avaria para o responsável de frota." : "Verificação concluída. Bom trabalho!"} />;
  return (
    <Carregar erro={erro} dados={dados}>
      <Seletor e={e} />
      {!v ? null : <form className="form" onSubmit={enviar} style={{ maxWidth: 560 }}>
        <div className="note"><Matricula m={v.matricula} /> Antes da primeira aula. Demora menos de um minuto.</div>
        <div className="card">{ITENS.map((i) => (
          <div className="chk" key={i}><b>{i}</b>
            <div className="okno" role="group" aria-label={i}><button type="button" className="y" aria-pressed={estado[i]} onClick={() => setEstado((o) => ({ ...o, [i]: true }))}>OK</button><button type="button" className="n" aria-pressed={!estado[i]} onClick={() => setEstado((o) => ({ ...o, [i]: false }))}>Problema</button></div></div>))}</div>
        {falhas.length > 0 && <div className="card form"><Campo id="n" label={`O que notou? (${falhas.join(", ")})`} area valor={notas} onChange={setNotas} largo /><b style={{ fontSize: 13 }}>Mostre o problema (fotografias, opcional)</b><EscolherFotos fotos={fotos} onChange={setFotos} /><div className="warnbox">Será criada uma avaria e o responsável de frota recebe um aviso.</div></div>}
        {err && <div className="errbox" role="alert">{err}</div>}
        <button className="btn primary big">Enviar verificação</button>
      </form>}
    </Carregar>
  );
}
