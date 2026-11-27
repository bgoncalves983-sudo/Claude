import { useState, type FormEvent } from "react";
import { api, ErroApi } from "../api";
import { Campo, num } from "../form";
import { Carregar, eur, fdata, Icon, useApi } from "../ui";

interface Estado { deposito: { id: number; nome: string; capacidadeL: number; nivelMinimoL: number; toleranciaPct: number }; nivelL: number; percentagem: number; abaixoDoMinimo: boolean; custoMedioLitro: number | null; mediaDiariaL: number; autonomiaDias: number | null; ultimaContagem: { data: string; diferencaL: number; percentagem: number | null } | null }
interface Mov { id: number; tipo: "entrada" | "saida" | "ajuste"; data: string; deltaLitros: number; precoLitro: number | null; fornecedor: string | null; guia: string | null; motivo: string | null; anulaMovimentoId: number | null }
const l = (n: number) => `${n.toLocaleString("pt-PT", { maximumFractionDigits: 1 })} l`;

export function Deposito({ gestao }: { gestao: boolean }) {
  const est = useApi<Estado>("/deposito");
  const [tipo, setTipo] = useState("");
  const mov = useApi<Mov[]>(`/deposito/movimentos${tipo ? `?tipo=${tipo}` : ""}`);
  const [tab, setTab] = useState<"mov" | "entrada" | "contagem" | "config">("mov");
  const [msg, setMsg] = useState<{ t: string; erro?: boolean } | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const s = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const depois = (t: string) => { setMsg({ t }); setF({}); est.recarregar(); mov.recarregar(); };
  const falha = (x: unknown) => setMsg({ t: (x as ErroApi).message, erro: true });

  async function entrada(e: FormEvent) { e.preventDefault(); setMsg(null); try { await api("/deposito/entradas", { metodo: "POST", corpo: { data: f.data || undefined, litros: num(f.litros ?? ""), precoLitro: num(f.preco ?? ""), fornecedor: f.fornecedor || null, guia: f.guia || null } }); depois("Entrada registada."); setTab("mov"); } catch (x) { falha(x); } }
  async function contagem(e: FormEvent) { e.preventDefault(); setMsg(null); try { const r = await api<{ diferencaL: number; percentagem: number | null; dentroDaTolerancia: boolean }>("/deposito/contagens", { metodo: "POST", corpo: { data: f.data || undefined, medidoLitros: num(f.medido ?? ""), notas: f.notas || null } }); depois(`Contagem registada: diferença de ${l(r.diferencaL)}${r.percentagem != null ? ` (${r.percentagem.toString().replace(".", ",")} %)` : ""}. ${r.dentroDaTolerancia ? "Dentro da tolerância." : "FORA da tolerância: verifique."}`); setTab("mov"); } catch (x) { falha(x); } }
  async function config(e: FormEvent) { e.preventDefault(); setMsg(null); try { await api("/deposito", { metodo: "PATCH", corpo: { nome: f.nome || undefined, capacidadeL: num(f.cap ?? "") ?? undefined, nivelMinimoL: num(f.min ?? "") ?? undefined, toleranciaPct: num(f.tol ?? "") ?? undefined } }); depois("Definições guardadas."); } catch (x) { falha(x); } }
  async function anular(m: Mov) { const motivo = prompt("Motivo da anulação:"); if (!motivo) return; try { await api(`/deposito/movimentos/${m.id}/anular`, { metodo: "POST", corpo: { motivo } }); depois("Movimento anulado (criado um movimento inverso)."); } catch (x) { falha(x); } }

  const d = est.dados;
  // Pre-visualizacao da entrada
  const lit = num(f.litros ?? ""), pr = num(f.preco ?? "");
  const medido = num(f.medido ?? "");

  return (
    <Carregar erro={est.erro} dados={d}>
      {d && <>
        {msg && <div className={msg.erro ? "errbox" : "note"} role="status">{msg.t}</div>}
        {d.nivelL < 0 && <div className="errbox">O nível calculado está negativo: faltam registar entradas, ou há saídas a mais. Faça uma contagem física.</div>}
        <div className="grid kpis">
          <div className="card kpi"><span>Nível atual</span><b>{l(d.nivelL)}</b><span>{d.percentagem}% de {l(d.deposito.capacidadeL)}</span></div>
          <div className="card kpi"><span>Autonomia estimada</span><b>{d.autonomiaDias != null ? `${d.autonomiaDias} dias` : "—"}</b><span>{d.mediaDiariaL ? `consumo ${l(d.mediaDiariaL)}/dia` : "sem saídas recentes"}</span></div>
          <div className="card kpi"><span>Custo médio</span><b>{d.custoMedioLitro != null ? eur(d.custoMedioLitro) : "—"}</b><span>por litro</span></div>
          <div className="card kpi"><span>Última contagem</span><b>{d.ultimaContagem ? l(d.ultimaContagem.diferencaL) : "—"}</b>{d.ultimaContagem && <span>{fdata(d.ultimaContagem.data)}{d.ultimaContagem.percentagem != null ? ` · ${d.ultimaContagem.percentagem.toString().replace(".", ",")} %` : ""}</span>}</div>
        </div>
        <div className="card"><div className="gaugebig" role="img" aria-label={`Nível ${d.percentagem} por cento`}><i style={{ width: `${Math.max(0, Math.min(100, d.percentagem))}%` }} /><span className="min" style={{ left: `${(d.deposito.nivelMinimoL / d.deposito.capacidadeL) * 100}%` }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginTop: 6 }}><span>0 l</span><span className={d.abaixoDoMinimo ? "" : ""} style={d.abaixoDoMinimo ? { color: "var(--crit)", fontWeight: 600 } : undefined}>{d.abaixoDoMinimo ? "⚠ Abaixo do nível mínimo" : `Aviso abaixo de ${l(d.deposito.nivelMinimoL)}`}</span><span>{l(d.deposito.capacidadeL)}</span></div></div>

        <div className="tabs" role="tablist">{([["mov", "Movimentos"], ...(gestao ? [["entrada", "Registar entrada"], ["contagem", "Contagem física"], ["config", "Definições"]] : [])] as [string, string][]).map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k as typeof tab); setF({}); setMsg(null); }}>{t}</button>)}</div>

        {tab === "mov" && <div className="card"><h3>Movimentos</h3>
          <div className="chips" style={{ marginBottom: 12 }}>{[["", "Todos"], ["entrada", "Entradas"], ["saida", "Saídas"], ["ajuste", "Ajustes"]].map(([k, t]) => <button key={k} aria-pressed={tipo === k} onClick={() => setTipo(k)}>{t}</button>)}</div>
          <Carregar erro={mov.erro} dados={mov.dados}>
            {mov.dados?.length === 0 && <span className="muted">Ainda não há movimentos. Registe a primeira entrada de gasóleo.</span>}
            {mov.dados?.map((m) => (
              <div className="mv" key={m.id}>
                <span className={`dot ${m.tipo === "entrada" ? "in" : m.tipo === "saida" ? "out" : "adj"}`}>{m.tipo === "entrada" ? "+" : m.tipo === "saida" ? "−" : "±"}</span>
                <div><b>{m.tipo === "entrada" ? "Entrada" : m.tipo === "saida" ? "Saída" : "Ajuste"} · {l(Math.abs(m.deltaLitros))}{m.deltaLitros < 0 && m.tipo === "ajuste" ? " (menos)" : ""}</b>
                  <small>{[m.fornecedor, m.guia && `guia ${m.guia}`, m.precoLitro != null && `${eur(m.precoLitro)}/l`, m.motivo].filter(Boolean).join(" · ") || "—"}</small>
                  {gestao && !m.anulaMovimentoId && m.tipo !== "ajuste" && <button className="btn ghost" style={{ minHeight: 32, padding: "2px 8px" }} onClick={() => void anular(m)}>Anular</button>}</div>
                <div className="right"><b>{fdata(m.data)}</b></div>
              </div>))}
          </Carregar>
          <p className="muted" style={{ margin: "12px 0 0" }}>Os movimentos não se editam: uma correção é um novo movimento, com autor e motivo.</p></div>}

        {tab === "entrada" && gestao && <form className="card form" onSubmit={entrada}><h3><Icon n="fuel" s={18} />Registar entrada de gasóleo</h3>
          <div className="fields"><Campo id="e1" label="Data da entrega" tipo="date" valor={f.data ?? ""} onChange={s("data")} /><Campo id="e2" label="Litros recebidos" tipo="number" obrig valor={f.litros ?? ""} onChange={s("litros")} /><Campo id="e3" label="Preço por litro (€)" tipo="number" obrig valor={f.preco ?? ""} onChange={s("preco")} /><Campo id="e4" label="Fornecedor" valor={f.fornecedor ?? ""} onChange={s("fornecedor")} /><Campo id="e5" label="N.º da guia ou fatura" valor={f.guia ?? ""} onChange={s("guia")} /></div>
          {lit && pr ? <div className="calc"><div><span>Total da compra</span><b>{eur(lit * pr)}</b></div><div><span>Nível depois</span><b>{l(d.nivelL + lit)}</b></div>{d.nivelL + lit > d.deposito.capacidadeL && <div style={{ color: "var(--crit)" }}><span>⚠ Excede a capacidade</span><b>{l(d.nivelL + lit - d.deposito.capacidadeL)}</b></div>}</div> : null}
          <button className="btn primary big">Registar entrada</button></form>}

        {tab === "contagem" && gestao && <form className="card form" onSubmit={contagem}><h3>Contagem física</h3>
          <div className="fields"><Campo id="c1" label="Data" tipo="date" valor={f.data ?? ""} onChange={s("data")} /><Campo id="c2" label="Litros medidos" tipo="number" obrig valor={f.medido ?? ""} onChange={s("medido")} /><Campo id="c3" label="Notas" valor={f.notas ?? ""} onChange={s("notas")} /></div>
          <div className="calc"><div><span>Nível calculado</span><b>{l(d.nivelL)}</b></div>{medido != null && <><div><span>Nível medido</span><b>{l(medido)}</b></div><div><span>Diferença</span><b>{l(medido - d.nivelL)}{d.nivelL > 0 ? ` (${(((medido - d.nivelL) / d.nivelL) * 100).toFixed(2).replace(".", ",")} %)` : ""}</b></div></>}</div>
          <div className="note">Será criado um ajuste com a diferença, com o seu nome. Tolerância configurada: ±{d.deposito.toleranciaPct} %.</div>
          <button className="btn primary big">Registar contagem e ajustar</button></form>}

        {tab === "config" && gestao && <form className="card form" onSubmit={config}><h3>Definições do depósito</h3>
          <div className="fields"><Campo id="d1" label="Nome" valor={f.nome ?? d.deposito.nome} onChange={s("nome")} /><Campo id="d2" label="Capacidade (l)" tipo="number" valor={f.cap ?? String(d.deposito.capacidadeL)} onChange={s("cap")} /><Campo id="d3" label="Aviso de nível baixo (l)" tipo="number" valor={f.min ?? String(d.deposito.nivelMinimoL)} onChange={s("min")} /><Campo id="d4" label="Tolerância da contagem (%)" tipo="number" valor={f.tol ?? String(d.deposito.toleranciaPct)} onChange={s("tol")} /></div>
          <button className="btn primary">Guardar</button></form>}
      </>}
    </Carregar>
  );
}
