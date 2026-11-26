import { useMemo, useState } from "react";
import type { Eu, Veiculo } from "../api";
import { Carregar, ChipEstado, Foto, fdata, Matricula, TIPOS, useApi } from "../ui";

function Cartao({ v }: { v: Veiculo }) {
  return (
    <a className="vcard" href={`#/veiculos/${v.id}`}>
      <Foto tipo={v.tipo} tag />
      <div className="vbody">
        <Matricula m={v.matricula} />
        <b>{[v.marca, v.modelo].filter(Boolean).join(" ") || "Sem marca"}</b>
        <div className="vmeta"><ChipEstado e={v.estado} />{v.proprietario && <span className="chip">{v.proprietario.replace("Escola ", "")}</span>}{v.categoria && <span className="chip">Cat. {v.categoria}</span>}</div>
      </div>
    </a>
  );
}

export function Veiculos({ eu }: { eu: Eu }) {
  const { dados, erro } = useApi<Veiculo[]>("/veiculos");
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [escola, setEscola] = useState("");
  const [vista, setVista] = useState<"grelha" | "lista">("grelha");
  const escolas = useMemo(() => [...new Set((dados ?? []).map((v) => v.proprietario).filter(Boolean))] as string[], [dados]);
  const lista = useMemo(() => (dados ?? []).filter((v) =>
    (!tipo || v.tipo === tipo) && (!escola || v.proprietario === escola) &&
    (!q || `${v.matricula} ${v.marca ?? ""} ${v.modelo ?? ""}`.toLowerCase().includes(q.toLowerCase()))), [dados, q, tipo, escola]);

  return (
    <>
      <div className="chips">
        <label className="search"><span className="muted" aria-hidden="true">⌕&nbsp;</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar matrícula, marca…" aria-label="Pesquisar veículos" /></label>
        {escolas.length > 1 && (
          <label className="f" style={{ minWidth: 150 }}><span className="muted" style={{ position: "absolute", left: -9999 }}>Escola</span>
            <select value={escola} onChange={(e) => setEscola(e.target.value)} aria-label="Escola" style={{ minHeight: 44, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", padding: "0 12px", color: "var(--ink)" }}>
              <option value="">Todas as escolas</option>{escolas.map((e) => <option key={e}>{e}</option>)}
            </select>
          </label>)}
      </div>
      <div className="chips" role="group" aria-label="Filtrar por tipo">
        <button aria-pressed={tipo === ""} onClick={() => setTipo("")}>Todos</button>
        {Object.entries(TIPOS).map(([k, v]) => <button key={k} aria-pressed={tipo === k} onClick={() => setTipo(k)}>{v}</button>)}
        {eu.perfil !== "instrutor" && <><span style={{ flex: 1 }} /><button aria-pressed={vista === "grelha"} onClick={() => setVista("grelha")}>Grelha</button><button aria-pressed={vista === "lista"} onClick={() => setVista("lista")}>Lista</button></>}
      </div>
      <Carregar erro={erro} dados={dados}>
        <div className="muted" aria-live="polite">{lista.length} veículo(s)</div>
        {lista.length === 0 && <div className="card">Nenhum veículo corresponde à pesquisa.</div>}
        {vista === "grelha"
          ? <div className="vgrid">{lista.map((v) => <Cartao key={v.id} v={v} />)}</div>
          : <div className="card"><div className="rows">{lista.map((v) => (
              <div className="row" key={v.id} style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}>
                <Matricula m={v.matricula} />
                <a href={`#/veiculos/${v.id}`} style={{ textDecoration: "none" }}><b>{[v.marca, v.modelo].filter(Boolean).join(" ")}</b><small>{TIPOS[v.tipo]} · {v.proprietario ?? "—"} · registado em {fdata(v.dataMatricula)}</small></a>
                <ChipEstado e={v.estado} />
              </div>))}</div></div>}
      </Carregar>
    </>
  );
}
