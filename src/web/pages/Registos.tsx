import { useState, type FormEvent, type ReactNode } from "react";
import { api, ErroApi } from "../api";
import { Campo, num, vazio } from "../form";
import { Carregar, eur, fdata, Icon, useApi } from "../ui";

type R = Record<string, any>;
interface Cp { k: string; t: string; tipo?: "text" | "number" | "date"; opcoes?: [string, string][]; area?: boolean; obrig?: boolean; passo?: string }
interface Acao { rotulo: string; corpo: R; mostrar: (r: R) => boolean }
interface Cfg {
  titulo: string; vazio: string; campos: Cp[]; linha: (r: R) => { t: string; s: string; d?: ReactNode; chip?: ReactNode };
  acoes?: Acao[]; podeApagar?: (r: R) => boolean;
}
const chip = (cls: string, t: string) => <span className={`chip ${cls}`}>{t}</span>;
const ESTADOS_AVARIA: Record<string, [string, string]> = { reportada: ["info", "Reportada"], em_analise: ["warn", "Em análise"], em_reparacao: ["warn", "Em reparação"], resolvida: ["ok", "Resolvida"] };

export const RECURSOS: Record<string, Cfg> = {
  seguros: { titulo: "Seguros", vazio: "Ainda não há seguros registados.", campos: [
    { k: "seguradora", t: "Seguradora", obrig: true }, { k: "apolice", t: "Apólice", obrig: true }, { k: "cobertura", t: "Cobertura" }, { k: "premio", t: "Prémio (€)", tipo: "number" },
    { k: "dataInicio", t: "Início", tipo: "date", obrig: true }, { k: "dataFim", t: "Fim", tipo: "date", obrig: true }],
    linha: (r) => ({ t: `${r.seguradora} · ${r.apolice}`, s: `${fdata(r.dataInicio)} a ${fdata(r.dataFim)}${r.cobertura ? ` · ${r.cobertura}` : ""}`, d: r.premio != null ? eur(r.premio) : undefined }), podeApagar: () => true },
  iuc: { titulo: "IUC", vazio: "Ainda não há IUC registado.", campos: [
    { k: "ano", t: "Ano", tipo: "number", obrig: true, passo: "1" }, { k: "valor", t: "Valor (€)", tipo: "number" }, { k: "dataLimite", t: "Data limite", tipo: "date", obrig: true }, { k: "dataPagamento", t: "Data de pagamento", tipo: "date" }],
    linha: (r) => ({ t: `IUC ${r.ano}`, s: r.pago ? `Pago em ${fdata(r.dataPagamento)}` : `Limite ${fdata(r.dataLimite)}`, d: r.valor != null ? eur(r.valor) : undefined, chip: r.pago ? chip("ok", "Pago") : chip("warn", "Por pagar") }),
    acoes: [{ rotulo: "Marcar pago", corpo: { pago: true }, mostrar: (r) => !r.pago }], podeApagar: () => true },
  inspecoes: { titulo: "Inspeções (IPO)", vazio: "Ainda não há inspeções registadas.", campos: [
    { k: "data", t: "Data", tipo: "date", obrig: true }, { k: "resultado", t: "Resultado", obrig: true, opcoes: [["aprovado", "Aprovado"], ["reprovado", "Reprovado"], ["condicionado", "Condicionado"]] },
    { k: "km", t: "Quilómetros", tipo: "number", passo: "1" }, { k: "centro", t: "Centro" }, { k: "custo", t: "Custo (€)", tipo: "number" }, { k: "proximaData", t: "Próxima inspeção", tipo: "date" }],
    linha: (r) => ({ t: `${fdata(r.data)} · ${r.centro ?? "—"}`, s: r.proximaData ? `Próxima: ${fdata(r.proximaData)}` : "—", d: r.custo != null ? eur(r.custo) : undefined, chip: chip(r.resultado === "aprovado" ? "ok" : r.resultado === "reprovado" ? "crit" : "warn", r.resultado) }), podeApagar: () => true },
  manutencoes: { titulo: "Manutenção", vazio: "Ainda não há manutenções registadas.", campos: [
    { k: "tipo", t: "Tipo", obrig: true, opcoes: [["preventiva", "Preventiva"], ["corretiva", "Corretiva"]] }, { k: "data", t: "Data", tipo: "date", obrig: true },
    { k: "km", t: "Quilómetros", tipo: "number", passo: "1" }, { k: "horas", t: "Horas", tipo: "number" }, { k: "oficina", t: "Oficina" }, { k: "custo", t: "Custo (€)", tipo: "number" },
    { k: "proximaData", t: "Próxima revisão (data)", tipo: "date" }, { k: "proximoKm", t: "Próxima revisão (km)", tipo: "number", passo: "1" }, { k: "descricao", t: "Descrição", area: true }],
    linha: (r) => ({ t: `${r.descricao ?? (r.tipo === "preventiva" ? "Revisão preventiva" : "Reparação")}`, s: `${fdata(r.data)} · ${r.oficina ?? "—"}${r.km != null ? ` · ${r.km.toLocaleString("pt-PT")} km` : ""}`, d: r.custo != null ? eur(r.custo) : undefined }), podeApagar: () => true },
  abastecimentos: { titulo: "Abastecimentos", vazio: "Ainda não há abastecimentos.", campos: [
    { k: "data", t: "Data", tipo: "date" }, { k: "origem", t: "Origem", obrig: true, opcoes: [["deposito", "Depósito do parque"], ["posto", "Posto externo"]] }, { k: "litros", t: "Litros", tipo: "number", obrig: true },
    { k: "km", t: "Quilómetros", tipo: "number", passo: "1" }, { k: "valor", t: "Valor pago (€, só posto externo)", tipo: "number" }, { k: "posto", t: "Posto" }],
    linha: (r) => ({ t: `${r.litros} l · ${fdata(r.data)}`, s: `${r.origem === "deposito" ? "Depósito do parque" : (r.posto ?? "Posto externo")}${r.km != null ? ` · ${r.km.toLocaleString("pt-PT")} km` : ""}`, d: r.valor != null ? eur(r.valor) : undefined }),
    podeApagar: (r) => r.origem !== "deposito" },
  avarias: { titulo: "Avarias", vazio: "Sem avarias registadas.", campos: [{ k: "descricao", t: "Descrição", area: true, obrig: true }],
    linha: (r) => ({ t: r.descricao, s: `Reportada a ${fdata(r.dataReporte)}${r.dataResolucao ? ` · resolvida a ${fdata(r.dataResolucao)}` : ""}`, chip: chip(...ESTADOS_AVARIA[r.estado]) }),
    acoes: [{ rotulo: "Em análise", corpo: { estado: "em_analise" }, mostrar: (r) => r.estado === "reportada" }, { rotulo: "Em reparação", corpo: { estado: "em_reparacao" }, mostrar: (r) => r.estado === "reportada" || r.estado === "em_analise" }, { rotulo: "Resolvida", corpo: { estado: "resolvida" }, mostrar: (r) => r.estado !== "resolvida" }] },
  sinistros: { titulo: "Sinistros", vazio: "Sem sinistros registados.", campos: [
    { k: "data", t: "Data", tipo: "date", obrig: true }, { k: "descricao", t: "O que aconteceu", obrig: true, area: true }, { k: "participacao", t: "N.º da participação" }, { k: "valor", t: "Valor (€)", tipo: "number" }],
    linha: (r) => ({ t: r.descricao, s: `${fdata(r.data)}${r.participacao ? ` · participação ${r.participacao}` : ""}`, d: r.valor != null ? eur(r.valor) : undefined, chip: chip(r.estado === "encerrado" ? "ok" : "warn", r.estado === "aberto" ? "Aberto" : r.estado === "em_analise" ? "Em análise" : "Encerrado") }),
    acoes: [{ rotulo: "Em análise", corpo: { estado: "em_analise" }, mostrar: (r) => r.estado === "aberto" }, { rotulo: "Encerrar", corpo: { estado: "encerrado" }, mostrar: (r) => r.estado !== "encerrado" }], podeApagar: () => true },
  multas: { titulo: "Multas e coimas", vazio: "Sem multas registadas.", campos: [
    { k: "data", t: "Data da infração", tipo: "date", obrig: true }, { k: "auto", t: "N.º do auto" }, { k: "local", t: "Local" }, { k: "valor", t: "Valor (€)", tipo: "number" }, { k: "limitePagamento", t: "Pagar até", tipo: "date" }],
    linha: (r) => ({ t: `${fdata(r.data)}${r.auto ? ` · auto ${r.auto}` : ""}`, s: `${r.local ?? "—"}${r.limitePagamento && r.estado === "por_pagar" ? ` · pagar até ${fdata(r.limitePagamento)}` : ""}`, d: r.valor != null ? eur(r.valor) : undefined, chip: chip(r.estado === "paga" ? "ok" : r.estado === "contestada" ? "info" : "crit", r.estado === "paga" ? "Paga" : r.estado === "contestada" ? "Contestada" : "⚠ Por pagar") }),
    acoes: [{ rotulo: "Marcar paga", corpo: { estado: "paga" }, mostrar: (r) => r.estado === "por_pagar" }, { rotulo: "Contestada", corpo: { estado: "contestada" }, mostrar: (r) => r.estado === "por_pagar" }], podeApagar: () => true },
};

export function Registos({ veiculoId, recurso, gestao, podeCriar = gestao }: { veiculoId: number; recurso: string; gestao: boolean; podeCriar?: boolean }) {
  const cfg = RECURSOS[recurso];
  const { dados, erro, recarregar } = useApi<R[]>(`/veiculos/${veiculoId}/${recurso}`);
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  async function guardar(e: FormEvent) {
    e.preventDefault(); setMsg(null);
    const corpo: R = {};
    for (const c of cfg.campos) {
      const v = f[c.k] ?? "";
      corpo[c.k] = c.tipo === "number" ? num(v) : vazio(v);
    }
    try { await api(`/veiculos/${veiculoId}/${recurso}`, { metodo: "POST", corpo }); setAberto(false); setF({}); recarregar(); }
    catch (x) { setMsg((x as ErroApi).message); }
  }
  async function acao(id: number, corpo: R) { try { await api(`/veiculos/${veiculoId}/${recurso}/${id}`, { metodo: "PATCH", corpo }); recarregar(); } catch (x) { setMsg((x as ErroApi).message); } }
  async function apagar(id: number) { if (!confirm("Apagar este registo?")) return; try { await api(`/veiculos/${veiculoId}/${recurso}/${id}`, { metodo: "DELETE" }); recarregar(); } catch (x) { setMsg((x as ErroApi).message); } }

  return (
    <div className="card"><h3>{cfg.titulo}{podeCriar && <span className="sp"><button className="btn primary" onClick={() => setAberto((x) => !x)}><Icon n="plus" s={16} />Registar</button></span>}</h3>
      {msg && <div className="errbox" style={{ marginBottom: 12 }} role="alert">{msg}</div>}
      {aberto && <form className="form" onSubmit={guardar} style={{ marginBottom: 16 }}>
        <div className="fields">{cfg.campos.map((c) => <Campo key={c.k} id={`${recurso}-${c.k}`} label={c.t} valor={f[c.k] ?? ""} onChange={(v) => setF((x) => ({ ...x, [c.k]: v }))} tipo={c.tipo} opcoes={c.opcoes} area={c.area} obrig={c.obrig} passo={c.passo} largo={c.area} />)}</div>
        <div className="actions"><button className="btn primary">Guardar</button><button type="button" className="btn ghost" onClick={() => setAberto(false)}>Cancelar</button></div>
      </form>}
      <Carregar erro={erro} dados={dados}>
        {dados?.length === 0 && <span className="muted">{cfg.vazio}</span>}
        <div className="rows">{dados?.map((r) => { const l = cfg.linha(r); return (
          <div className="row" key={r.id}>
            <div><b>{l.t}</b><small>{l.s}</small>
              {gestao && (cfg.acoes?.some((a) => a.mostrar(r)) || cfg.podeApagar?.(r)) && <div className="actions" style={{ marginTop: 8 }}>
                {cfg.acoes?.filter((a) => a.mostrar(r)).map((a) => <button key={a.rotulo} className="btn" onClick={() => acao(r.id, a.corpo)}>{a.rotulo}</button>)}
                {cfg.podeApagar?.(r) && <button className="btn ghost" onClick={() => apagar(r.id)}>Apagar</button>}</div>}
            </div>
            <div className="right">{l.chip}{l.d && <div><b>{l.d}</b></div>}</div>
          </div>); })}</div>
      </Carregar>
    </div>
  );
}
