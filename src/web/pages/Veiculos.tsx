import { useMemo, useState } from "react";
import { api, ErroApi, type Eu, type Veiculo } from "../api";
import { Campo } from "../form";
import { Carregar, ChipEstado, Foto, fdata, Icon, Matricula, TIPOS, useApi } from "../ui";

function Cartao({ v, sel, marcado, alternar }: { v: Veiculo; sel: boolean; marcado: boolean; alternar: () => void }) {
  const Tag = sel ? "button" : "a";
  return (
    <Tag className={`vcard${marcado ? " on" : ""}`} {...(sel ? { type: "button", onClick: alternar, "aria-pressed": marcado } : { href: `#/veiculos/${v.id}` })}>
      {sel && <span className={`selbox${marcado ? " on" : ""}`}>{marcado && <Icon n="check" s={16} />}</span>}
      <Foto tipo={v.tipo} v={v} tag />
      <div className="vbody">
        <Matricula m={v.matricula} />
        <b>{[v.marca, v.modelo].filter(Boolean).join(" ") || "Sem marca"}</b>
        <div className="vmeta"><ChipEstado e={v.estado} />{v.proprietario && <span className="chip">{v.proprietario.replace("Escola ", "")}</span>}{v.categoria && <span className="chip">Cat. {v.categoria}</span>}</div>
      </div>
    </Tag>
  );
}

/** Edicao em lote: so os campos marcados sao alterados. */
function Lote({ ids, fechar, feito }: { ids: number[]; fechar: () => void; feito: () => void }) {
  const [usar, setUsar] = useState<Record<string, boolean>>({}); const [val, setVal] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const campos: [string, string, [string, string][] | undefined, "number"?][] = [
    ["tipo", "Tipo de veículo", Object.entries(TIPOS)], ["categoria", "Categoria de ensino", undefined], ["proprietario", "Escola", [["Escola Radical", "Escola Radical"], ["Escola Patria", "Escola Pátria"]]],
    ["estado", "Estado", [["ativo", "Ativo"], ["oficina", "Em oficina"], ["imobilizado", "Imobilizado"]]], ["ipoPeriodicidadeMeses", "Periodicidade da IPO (meses)", undefined, "number"], ["iucAplicavel", "IUC aplicável", [["true", "Sim"], ["false", "Não"]]],
  ];
  async function aplicar() {
    const alteracoes: Record<string, unknown> = {};
    for (const [k, , , t] of campos) if (usar[k] && val[k] !== undefined && val[k] !== "") alteracoes[k] = t === "number" ? Number(val[k]) : k === "iucAplicavel" ? val[k] === "true" : val[k];
    if (!Object.keys(alteracoes).length) return setMsg("Marque e preencha pelo menos um campo.");
    try { const r = await api<{ alterados: number }>("/veiculos/lote", { metodo: "POST", corpo: { ids, alteracoes } }); setMsg(`${r.alterados} veículo(s) alterado(s).`); feito(); } catch (x) { setMsg((x as ErroApi).message); }
  }
  return (
    <div className="card form"><h3>Editar {ids.length} veículo(s)</h3>
      <div className="note">Só os campos marcados são alterados. Cada alteração fica na auditoria.</div>
      {campos.map(([k, t, op, tipo]) => (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 12, alignItems: "end" }}>
          <label className="toggle" htmlFor={`u-${k}`}><input id={`u-${k}`} type="checkbox" checked={!!usar[k]} onChange={(e) => setUsar((o) => ({ ...o, [k]: e.target.checked }))} />Alterar</label>
          <Campo id={`l-${k}`} label={t} valor={val[k] ?? ""} onChange={(v) => { setVal((o) => ({ ...o, [k]: v })); setUsar((o) => ({ ...o, [k]: true })); }} opcoes={op} tipo={tipo} lista={k === "categoria" ? ["AM", "A1", "A2", "A", "B", "BE", "C1", "C", "CE", "D1", "D", "DE"] : undefined} />
        </div>))}
      {msg && <div className="note" role="status">{msg}</div>}
      <div className="actions"><button className="btn primary" onClick={() => void aplicar()}>Aplicar a {ids.length} veículo(s)</button><button className="btn" onClick={fechar}>Fechar</button></div>
    </div>
  );
}

export function Veiculos({ eu }: { eu: Eu }) {
  const { dados, erro, recarregar } = useApi<Veiculo[]>("/veiculos");
  const [selMode, setSelMode] = useState(false); const [sel, setSel] = useState<number[]>([]); const [lote, setLote] = useState(false);
  const gestao = eu.perfil === "admin" || eu.perfil === "gestor";
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
      {gestao && <div className="chips noprint">
        <a className="btn primary" href="#/veiculos/novo"><Icon n="plus" s={16} />Novo veículo</a>
        <button className="btn" onClick={() => { setSelMode((x) => !x); setSel([]); setLote(false); }}><Icon n="check" s={16} />{selMode ? "Sair da seleção" : "Selecionar vários"}</button>
        <a className="btn" href="#/veiculos/importar"><Icon n="file" s={16} />Importar</a>
        <a className="btn" href="#/qr">Etiquetas QR</a>
      </div>}
      {lote && <Lote ids={sel} fechar={() => setLote(false)} feito={recarregar} />}
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
        {eu.perfil !== "instrutor" && !selMode && <><span style={{ flex: 1 }} /><button aria-pressed={vista === "grelha"} onClick={() => setVista("grelha")}>Grelha</button><button aria-pressed={vista === "lista"} onClick={() => setVista("lista")}>Lista</button></>}
      </div>
      <Carregar erro={erro} dados={dados}>
        <div className="muted" aria-live="polite">{lista.length} veículo(s)</div>
        {lista.length === 0 && <div className="card">Nenhum veículo corresponde à pesquisa.</div>}
        {vista === "grelha"
          ? <div className="vgrid">{lista.map((v) => <Cartao key={v.id} v={v} sel={selMode} marcado={sel.includes(v.id)} alternar={() => setSel((x) => (x.includes(v.id) ? x.filter((i) => i !== v.id) : [...x, v.id]))} />)}</div>
          : <div className="card"><div className="rows">{lista.map((v) => (
              <div className="row" key={v.id} style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}>
                <Matricula m={v.matricula} />
                <a href={`#/veiculos/${v.id}`} style={{ textDecoration: "none" }}><b>{[v.marca, v.modelo].filter(Boolean).join(" ")}</b><small>{TIPOS[v.tipo]} · {v.proprietario ?? "—"} · registado em {fdata(v.dataMatricula)}</small></a>
                <ChipEstado e={v.estado} />
              </div>))}</div></div>}
      </Carregar>
      {selMode && sel.length > 0 && <div className="bulkbar"><b>{sel.length} selecionado(s)</b><button className="btn primary" onClick={() => setLote(true)}>Editar em lote</button><a className="btn" href={`#/qr?ids=${sel.join(",")}`}>Etiquetas QR</a><button className="btn" onClick={() => setSel([])}>Limpar</button></div>}
    </>
  );
}
