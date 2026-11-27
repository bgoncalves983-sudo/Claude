import type { Alerta, Veiculo } from "../api";
import { Carregar, ChipDias, fdata, Icon, useApi } from "../ui";

interface Dep { nivelL: number; percentagem: number; abaixoDoMinimo: boolean; autonomiaDias: number | null; deposito: { capacidadeL: number } }

export function Painel() {
  const v = useApi<Veiculo[]>("/veiculos");
  const a = useApi<Alerta[]>("/alertas");
  const dep = useApi<Dep>("/deposito");
  const urgentes = (a.dados ?? []).filter((x) => x.dias <= 15).length;
  const por = (e: string) => (v.dados ?? []).filter((x) => x.estado === e).length;
  return (
    <Carregar erro={v.erro ?? a.erro} dados={v.dados && a.dados}>
      <div className="grid kpis">
        <div className="card kpi"><span>Veículos</span><b>{v.dados?.length}</b></div>
        <div className="card kpi"><span>Prazos urgentes</span><b style={{ color: urgentes ? "var(--crit)" : undefined }}>{urgentes}</b><span>a menos de 15 dias</span></div>
        <div className="card kpi"><span>Em oficina</span><b>{por("oficina")}</b></div>
        <div className="card kpi"><span>Imobilizados</span><b>{por("imobilizado")}</b></div>
      </div>
      {dep.dados && <div className="card"><h3><Icon n="fuel" s={18} />Depósito de gasóleo<span className="sp"><a className="btn ghost" href="#/deposito">Abrir</a></span></h3>
        <div className="gaugebig" role="img" aria-label={`Nível ${dep.dados.percentagem} por cento`}><i style={{ width: `${Math.max(0, Math.min(100, dep.dados.percentagem))}%` }} /></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 6 }}><span><b>{dep.dados.nivelL.toLocaleString("pt-PT", { maximumFractionDigits: 0 })} l</b> de {dep.dados.deposito.capacidadeL.toLocaleString("pt-PT")} l</span><span className={dep.dados.abaixoDoMinimo ? "" : "muted"} style={dep.dados.abaixoDoMinimo ? { color: "var(--crit)", fontWeight: 600 } : undefined}>{dep.dados.abaixoDoMinimo ? "⚠ Nível baixo" : dep.dados.autonomiaDias != null ? `≈ ${dep.dados.autonomiaDias} dias` : ""}</span></div></div>}
      <div className="card"><h3><Icon n="clock" s={18} />Prazos a atender</h3>
        {a.dados?.length === 0 && <p className="muted" style={{ margin: 0 }}>Sem prazos em risco. Assim que forem registados seguros, IUC e inspeções, aparecem aqui.</p>}
        <div className="rows">{(a.dados ?? []).slice(0, 12).map((x) => (
          <div className="row" key={x.chave}><div><b>{x.rotulo}</b><small>{fdata(x.data)}</small></div><div className="right"><ChipDias dias={x.dias} /></div></div>))}</div>
      </div>
    </Carregar>
  );
}
