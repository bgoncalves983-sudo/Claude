import { useState } from "react";
import { api, ErroApi } from "../api";
import { Carregar, Foto, fdata, Icon, Matricula, useApi } from "../ui";

export interface AvariaGeral { id: number; veiculoId: number; matricula: string; veiculo: string; escola: string | null; descricao: string; estado: string; dataReporte: string; dataResolucao: string | null; reportadoPor: string | null; horasEmAberto: number | null; fotos: number[] }
export interface ResumoAvarias { novas: number; emAnalise: number; emReparacao: number; abertas: number; maisAntigaHoras: number | null }

export const ESTADOS: Record<string, [string, string]> = { reportada: ["crit", "Nova"], em_analise: ["warn", "Em análise"], em_reparacao: ["warn", "Em reparação"], resolvida: ["ok", "Resolvida"] };

export function haQuanto(horas: number | null): string {
  if (horas === null) return "";
  if (horas < 1) return "há menos de 1 h";
  if (horas < 24) return `há ${horas} h`;
  const d = Math.floor(horas / 24); return `há ${d} dia${d > 1 ? "s" : ""}`;
}
/** Quanto mais antiga e sem resposta, mais forte o destaque. */
export function urgencia(a: { estado: string; horasEmAberto: number | null }): string {
  if (a.estado !== "reportada" || a.horasEmAberto === null) return "";
  return a.horasEmAberto >= 24 ? "crit" : a.horasEmAberto >= 4 ? "warn" : "";
}

export function CartaoAvaria({ a, aoAlterar, gestao }: { a: AvariaGeral; aoAlterar: () => void; gestao: boolean }) {
  const [erro, setErro] = useState<string | null>(null);
  const mudar = async (estado: string) => { try { await api(`/veiculos/${a.veiculoId}/avarias/${a.id}`, { metodo: "PATCH", corpo: { estado } }); aoAlterar(); } catch (e) { setErro((e as ErroApi).message); } };
  const [cls, txt] = ESTADOS[a.estado];
  const u = urgencia(a);
  return (
    <div className="card" style={u ? { borderLeft: `5px solid var(--${u === "crit" ? "crit" : "warn"})` } : undefined}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Matricula m={a.matricula} /><b style={{ flex: 1, minWidth: 140 }}>{a.veiculo}</b>
        <span className={`chip ${cls}`}>{a.estado === "reportada" ? "⚠ " : ""}{txt}</span>
      </div>
      <p style={{ margin: "10px 0 4px", fontSize: 15 }}>{a.descricao}</p>
      <div className="muted" style={{ fontSize: 13 }}>
        {a.reportadoPor ?? "—"} · {fdata(a.dataReporte)} {a.dataReporte.slice(11, 16)}{a.horasEmAberto !== null && <> · <b style={u ? { color: `var(--${u === "crit" ? "crit" : "warn"})` } : undefined}>{haQuanto(a.horasEmAberto)}</b></>}{a.escola ? ` · ${a.escola.replace("Escola ", "")}` : ""}
      </div>
      {a.fotos.length > 0 && <div className="thumbs" style={{ marginTop: 10 }}>{a.fotos.map((id) => <a key={id} className="thumb" href={`/api/avaria-fotos/${id}`} target="_blank" rel="noopener"><img src={`/api/avaria-fotos/${id}?tam=mini`} alt="Fotografia da avaria" loading="lazy" /></a>)}</div>}
      {erro && <div className="errbox" style={{ marginTop: 10 }} role="alert">{erro}</div>}
      <div className="actions" style={{ marginTop: 12 }}>
        <a className="btn" href={`#/veiculos/${a.veiculoId}`}><Icon n="car" s={16} />Ver veículo</a>
        {gestao && a.estado === "reportada" && <button className="btn" onClick={() => void mudar("em_analise")}>Em análise</button>}
        {gestao && (a.estado === "reportada" || a.estado === "em_analise") && <button className="btn" onClick={() => void mudar("em_reparacao")}>Em reparação</button>}
        {gestao && a.estado !== "resolvida" && <button className="btn primary" onClick={() => void mudar("resolvida")}>Resolvida</button>}
      </div>
    </div>
  );
}

export function Avarias({ gestao, aoAlterar }: { gestao: boolean; aoAlterar: () => void }) {
  const [filtro, setFiltro] = useState<"abertas" | "todas">("abertas");
  const { dados, erro, recarregar } = useApi<AvariaGeral[]>(`/avarias?estado=${filtro}`);
  const r = useApi<ResumoAvarias>("/avarias/resumo");
  const depois = () => { recarregar(); r.recarregar(); aoAlterar(); };
  return (
    <>
      {r.dados && <div className="grid kpis">
        <div className="card kpi"><span>Novas</span><b style={{ color: r.dados.novas ? "var(--crit)" : undefined }}>{r.dados.novas}</b><span>por ver</span></div>
        <div className="card kpi"><span>Em análise</span><b>{r.dados.emAnalise}</b></div>
        <div className="card kpi"><span>Em reparação</span><b>{r.dados.emReparacao}</b></div>
        <div className="card kpi"><span>Mais antiga</span><b style={{ fontSize: 22 }}>{r.dados.maisAntigaHoras !== null ? haQuanto(r.dados.maisAntigaHoras).replace("há ", "") : "—"}</b><span>em aberto</span></div>
      </div>}
      <div className="chips"><button aria-pressed={filtro === "abertas"} onClick={() => setFiltro("abertas")}>Abertas</button><button aria-pressed={filtro === "todas"} onClick={() => setFiltro("todas")}>Todas</button></div>
      <Carregar erro={erro} dados={dados}>
        {dados?.length === 0 && <div className="card">{filtro === "abertas" ? "Sem avarias abertas. 👍" : "Ainda não há avarias."}</div>}
        <div className="grid">{dados?.map((a) => <CartaoAvaria key={a.id} a={a} gestao={gestao} aoAlterar={depois} />)}</div>
      </Carregar>
    </>
  );
}
