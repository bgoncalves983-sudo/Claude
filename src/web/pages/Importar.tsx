import { useState } from "react";
import { api, ErroApi } from "../api";
import { Icon } from "../ui";

interface Linha { linha: number; matricula: string; acao: "novo" | "atualizar" | "erro"; erro?: string }
interface Pre { novos: number; atualizar: number; erros: number; linhas: Linha[]; aplicado?: boolean }

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const CAMPOS: Record<string, string> = { matricula: "matricula", tipo: "tipo", categoria: "categoria", marca: "marca", modelo: "modelo", cor: "cor", combustivel: "combustivel", vin: "vin", escola: "proprietario", proprietario: "proprietario", proprietariolocatario: "proprietario", datadamatricula: "dataMatricula", datamatricula: "dataMatricula" };

/** CSV simples: separador , ou ; ou tab, aspas e quebras de linha dentro de aspas. */
function lerCsv(texto: string): string[][] {
  const sep = [";", "\t", ","].map((c) => [c, texto.split("\n")[0].split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const linhas: string[][] = []; let cel = "", lin: string[] = [], asp = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (asp) { if (ch === '"' && texto[i + 1] === '"') { cel += '"'; i++; } else if (ch === '"') asp = false; else cel += ch; }
    else if (ch === '"') asp = true;
    else if (ch === sep) { lin.push(cel); cel = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && texto[i + 1] === "\n") i++; lin.push(cel); cel = ""; if (lin.some((x) => x.trim())) linhas.push(lin); lin = []; }
    else cel += ch;
  }
  lin.push(cel); if (lin.some((x) => x.trim())) linhas.push(lin);
  return linhas;
}
async function lerFicheiro(f: File): Promise<string> {
  const buf = await f.arrayBuffer();
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, ""); } catch { return new TextDecoder("windows-1252").decode(buf); } // Excel em PT grava em Windows-1252
}

const MODELO = "Matrícula;Tipo;Categoria;Marca;Modelo;Escola;Data da matrícula\nCA-03-PL;Ligeiro;B;Renault;RJA;Escola Radical;28/11/2025\n";

export function Importar() {
  const [linhas, setLinhas] = useState<Record<string, string>[] | null>(null);
  const [pre, setPre] = useState<Pre | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState("");

  async function escolher(f: File | undefined) {
    if (!f) return; setErro(null); setPre(null); setNome(f.name);
    try {
      const t = await lerFicheiro(f); const m = lerCsv(t);
      if (m.length < 2) return setErro("O ficheiro está vazio ou só tem o cabeçalho.");
      const cab = m[0].map((h) => CAMPOS[norm(h)] ?? "");
      if (!cab.includes("matricula")) return setErro("Não encontrei a coluna da matrícula. O cabeçalho tem de ter “Matrícula”.");
      const l = m.slice(1).map((r) => Object.fromEntries(cab.map((c, i) => [c, (r[i] ?? "").trim()]).filter(([c]) => c)));
      setLinhas(l); setPre(await api<Pre>("/veiculos/importar", { metodo: "POST", corpo: { linhas: l } }));
    } catch (x) { setErro((x as ErroApi).message); }
  }
  async function confirmar() {
    if (!linhas) return;
    try { setPre(await api<Pre>("/veiculos/importar", { metodo: "POST", corpo: { linhas, confirmar: true } })); } catch (x) { setErro((x as ErroApi).message); }
  }
  const modelo = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + MODELO], { type: "text/csv" })); a.download = "modelo-veiculos.csv"; a.click(); };

  return (
    <>
      <div><a href="#/veiculos" className="muted">← Veículos</a></div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
        <div className="card form"><h3><Icon n="file" s={18} />Importar veículos</h3>
          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}><li>Descarregue o modelo, ou use o seu Excel com um cabeçalho com “Matrícula”.</li><li>No Excel: <b>Guardar como → CSV</b>.</li><li>Carregue o ficheiro e reveja antes de confirmar.</li></ol>
          <div className="actions"><button className="btn" onClick={modelo}>Descarregar modelo</button></div>
          <label className="f" htmlFor="csv">Ficheiro CSV<input id="csv" type="file" accept=".csv,text/csv" onChange={(e) => void escolher(e.target.files?.[0])} /></label>
          <div className="note">Colunas reconhecidas: matrícula, tipo, categoria, marca, modelo, escola, cor, combustível, VIN, data da matrícula. Veículos que já existem são atualizados pela matrícula; nada é apagado.</div>
          {erro && <div className="errbox" role="alert">{erro}</div>}
        </div>
        {pre && <div className="card"><h3>{pre.aplicado ? "Importação concluída" : "Pré-visualização"}{nome && <span className="muted" style={{ fontWeight: 400 }}>{nome}</span>}</h3>
          <div className="grid kpis" style={{ gridTemplateColumns: "repeat(3,1fr)" }}><div className="kpi"><b style={{ color: "var(--ok)" }}>{pre.novos}</b><span>novos</span></div><div className="kpi"><b style={{ color: "var(--warn)" }}>{pre.atualizar}</b><span>a atualizar</span></div><div className="kpi"><b style={{ color: "var(--crit)" }}>{pre.erros}</b><span>com erro</span></div></div>
          {!pre.aplicado && <><div className="warnbox" style={{ margin: "12px 0" }}>{pre.erros > 0 ? `${pre.erros} linha(s) com erro não serão importadas.` : "Tudo pronto."}</div>
            <button className="btn primary big" disabled={pre.novos + pre.atualizar === 0} onClick={() => void confirmar()}>Importar {pre.novos + pre.atualizar} veículo(s)</button></>}
          {pre.aplicado && <a className="btn primary" href="#/veiculos">Ver veículos</a>}
        </div>}
      </div>
      {pre && !pre.aplicado && <div className="card"><h3>Linhas</h3><div className="tbl"><table><thead><tr><th>Linha</th><th>Matrícula</th><th>Resultado</th></tr></thead><tbody>
        {pre.linhas.slice(0, 200).map((l) => <tr key={l.linha}><td>{l.linha}</td><td><span className="plate">{l.matricula || "—"}</span></td><td><span className={`chip ${l.acao === "novo" ? "ok" : l.acao === "atualizar" ? "info" : "crit"}`}>{l.acao === "novo" ? "Novo" : l.acao === "atualizar" ? "Atualizar" : l.erro}</span></td></tr>)}</tbody></table></div></div>}
    </>
  );
}
