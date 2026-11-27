import { useMemo, useState, type FormEvent } from "react";
import { api, enviarFormulario, ErroApi, type Eu, type Veiculo } from "../api";
import { Campo } from "../form";
import { reduzir } from "../lib/imagem";
import { Carregar, ChipDias, ChipEstado, eur, Foto, fdata, Icon, TIPOS, useApi } from "../ui";
import { Documentos } from "./Documentos";
import { Registos } from "./Registos";

type R = Record<string, any>;
const sn = (b: boolean | null | undefined) => (b ? "Sim" : "Não");
const D = ({ k, v }: { k: string; v: React.ReactNode }) => <div><small>{k}</small><b>{v === null || v === undefined || v === "" ? "—" : v}</b></div>;
const hoje = () => new Date().toISOString().slice(0, 10);
const dias = (d: string) => Math.round((Date.parse(d + "T00:00:00Z") - Date.parse(hoje() + "T00:00:00Z")) / 86_400_000);

function Resumo({ v }: { v: Veiculo }) {
  const seguros = useApi<R[]>(`/veiculos/${v.id}/seguros`); const ipos = useApi<R[]>(`/veiculos/${v.id}/inspecoes`); const iucs = useApi<R[]>(`/veiculos/${v.id}/iuc`);
  const manut = useApi<R[]>(`/veiculos/${v.id}/manutencoes`); const abast = useApi<R[]>(`/veiculos/${v.id}/abastecimentos`);
  const pronto = seguros.dados && ipos.dados && iucs.dados && manut.dados && abast.dados;
  const c = useMemo(() => {
    if (!pronto) return null;
    const seguroFim = seguros.dados!.map((s) => s.dataFim as string).sort().at(-1);
    const proxIpo = ipos.dados!.filter((i) => i.proximaData).sort((a, b) => b.data.localeCompare(a.data))[0]?.proximaData as string | undefined;
    const iuc = iucs.dados!.filter((i) => !i.pago).sort((a, b) => a.dataLimite.localeCompare(b.dataLimite))[0];
    const comKm = abast.dados!.filter((a) => a.km != null).sort((a, b) => a.km - b.km);
    const consumo = comKm.length >= 2 && comKm.at(-1)!.km > comKm[0].km ? (comKm.slice(1).reduce((s, a) => s + a.litros, 0) / (comKm.at(-1)!.km - comKm[0].km)) * 100 : null;
    const desde = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
    const soma = (l: R[], k: string, dk: string) => l.filter((x) => x[dk] >= desde).reduce((s, x) => s + (x[k] ?? 0), 0);
    const custos = [["Combustível", soma(abast.dados!, "valor", "data")], ["Manutenção", soma(manut.dados!, "custo", "data")], ["Inspeções", soma(ipos.dados!, "custo", "data")]] as [string, number][];
    return { seguroFim, proxIpo, iuc, consumo, custos, total: custos.reduce((s, x) => s + x[1], 0) };
  }, [pronto, seguros.dados, ipos.dados, iucs.dados, manut.dados, abast.dados]);
  const erro = seguros.erro ?? ipos.erro ?? iucs.erro;
  return (
    <Carregar erro={erro} dados={pronto ? c : null}>
      {c && <>
        <div className="grid kpis">
          <div className="card kpi"><span>Seguro</span><b style={{ fontSize: 20 }}>{v.seguroCobertoPeloTrator ? "Coberto" : fdata(c.seguroFim)}</b>{c.seguroFim && !v.seguroCobertoPeloTrator ? <ChipDias dias={dias(c.seguroFim)} /> : <span>{v.seguroCobertoPeloTrator ? "pelo pesado associado" : "sem seguro registado"}</span>}</div>
          <div className="card kpi"><span>Próxima IPO</span><b style={{ fontSize: 20 }}>{fdata(c.proxIpo)}</b>{c.proxIpo ? <ChipDias dias={dias(c.proxIpo)} /> : <span>sem inspeção registada</span>}</div>
          <div className="card kpi"><span>IUC</span><b style={{ fontSize: 20 }}>{v.iucAplicavel === false ? "Isento" : c.iuc ? fdata(c.iuc.dataLimite) : "Em dia"}</b>{c.iuc && <ChipDias dias={dias(c.iuc.dataLimite)} />}</div>
          <div className="card kpi"><span>Consumo médio</span><b style={{ fontSize: 20 }}>{c.consumo ? `${c.consumo.toFixed(1).replace(".", ",")} l/100 km` : "—"}</b><span>{c.consumo ? "entre abastecimentos" : "faltam registos com km"}</span></div>
        </div>
        <div className="card"><h3>Custos dos últimos 12 meses</h3>
          {c.total === 0 ? <span className="muted">Ainda sem custos registados.</span> : <div className="grid">{c.custos.map(([n, x]) => (
            <div key={n} style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr) 90px", gap: 10, alignItems: "center" }}><span>{n}</span><div className="gauge"><i style={{ width: `${(x / c.total) * 100}%` }} /></div><b style={{ textAlign: "right" }}>{eur(x)}</b></div>))}
            <div className="muted">Total {eur(c.total)}{v.kmAtuais ? "" : ""}</div></div>}
        </div>
      </>}
    </Carregar>
  );
}

function Abater({ v, fechar }: { v: Veiculo; fechar: () => void }) {
  const [motivo, setMotivo] = useState("vendido"); const [data, setData] = useState(hoje()); const [valor, setValor] = useState(""); const [comprador, setComprador] = useState(""); const [notas, setNotas] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  async function ok(e: FormEvent) {
    e.preventDefault();
    try { await api(`/veiculos/${v.id}/abater`, { metodo: "POST", corpo: { motivo, data, valorVenda: valor ? Number(valor.replace(",", ".")) : null, comprador: comprador || null, notas: notas || null } }); location.hash = "#/veiculos"; location.reload(); }
    catch (x) { setErro((x as ErroApi).message); }
  }
  return (
    <form className="card form" onSubmit={ok}><h3><Icon n="alert" s={18} />Abater ou arquivar {v.matricula}</h3>
      {erro && <div className="errbox" role="alert">{erro}</div>}
      <div className="fields">
        <Campo id="am" label="Motivo" valor={motivo} onChange={setMotivo} opcoes={[["vendido", "Vendido"], ["sucata", "Abatido (sucata)"], ["roubado", "Roubado"], ["outro", "Outro"]]} />
        <Campo id="ad" label="Data" valor={data} onChange={setData} tipo="date" /><Campo id="av" label="Valor de venda (€)" valor={valor} onChange={setValor} tipo="number" /><Campo id="ac" label="Comprador" valor={comprador} onChange={setComprador} />
        <Campo id="an" label="Notas" valor={notas} onChange={setNotas} area largo />
      </div>
      <div className="note">O histórico completo mantém-se (seguros, inspeções, custos, documentos). Deixa de aparecer na lista normal e de gerar alertas, e termina o conjunto com reboque. Pode ser reativado.</div>
      <div className="actions"><button className="btn primary">Confirmar</button><button type="button" className="btn" onClick={fechar}>Cancelar</button></div>
    </form>
  );
}

export function Ficha({ id, eu }: { id: string; eu: Eu }) {
  const { dados: v, erro, recarregar } = useApi<Veiculo>(`/veiculos/${id}`);
  const gestao = eu.perfil === "admin" || eu.perfil === "gestor";
  const consulta = eu.perfil === "consulta";
  const instrutor = eu.perfil === "instrutor";
  const tabs: [string, string][] = instrutor
    ? [["resumo", "Resumo"], ["dados", "Dados"], ["comb", "Combustível"], ["avarias", "Avarias"], ["docs", "Documentos"]]
    : [["resumo", "Resumo"], ["dados", "Dados"], ["seguros", "Seguros"], ["prazos", "IUC e IPO"], ["manut", "Manutenção"], ["comb", "Combustível"], ["avarias", "Avarias"], ["ocorr", "Ocorrências"], ["docs", "Documentos"]];
  const [tab, setTab] = useState("resumo");
  const [abater, setAbater] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function mudarFoto(ficheiro: File | undefined) {
    if (!ficheiro) return;
    setMsg("A enviar a fotografia…");
    try {
      const form = new FormData(); form.append("grande", await reduzir(ficheiro, 1600, 0.82), "g.jpg"); form.append("mini", await reduzir(ficheiro, 400, 0.8), "m.jpg");
      await enviarFormulario(`/veiculos/${id}/foto`, form); setMsg(null); recarregar();
    } catch (x) { setMsg((x as ErroApi).message || "Não foi possível enviar a fotografia."); }
  }

  return (
    <>
      <div className="noprint"><a href="#/veiculos" className="muted">← Veículos</a></div>
      <Carregar erro={erro} dados={v}>
        {v && <>
          {msg && <div className="note" role="status">{msg}</div>}
          <div className="hero">
            <div style={{ position: "relative" }}>
              <Foto tipo={v.tipo} v={v} grande />
              {gestao && <label className="btn" style={{ position: "absolute", right: 12, bottom: 12, cursor: "pointer" }}><Icon n="camera" s={18} />{v.temFoto ? "Alterar foto" : "Adicionar foto"}<input type="file" accept="image/*" hidden onChange={(e) => void mudarFoto(e.target.files?.[0])} /></label>}
            </div>
            <div className="info">
              <div className="vmeta"><span className="plate" style={{ fontSize: 16 }}>{v.matricula}</span><ChipEstado e={v.estado} />{v.proprietario && <span className="chip">{v.proprietario}</span>}</div>
              <h2>{[v.marca, v.modelo].filter(Boolean).join(" ") || v.matricula}</h2>
              <div className="facts">
                <D k="Tipo / categoria" v={`${TIPOS[v.tipo] ?? v.tipo}${v.categoria ? ` · ${v.categoria}` : ""}`} />
                <D k={v.usaHoras ? "Horas" : "Quilómetros"} v={v.usaHoras ? (v.horasAtuais != null ? `${v.horasAtuais.toLocaleString("pt-PT")} h` : null) : (v.kmAtuais != null ? `${v.kmAtuais.toLocaleString("pt-PT")} km` : null)} />
                <D k="Combustível" v={v.combustivel} /><D k="Cor" v={v.cor} />
              </div>
              {v.conjuntoAtivo && <div className="note"><Icon n="link" s={14} /> Faz conjunto com um reboque.</div>}
              <div className="actions noprint">
                {gestao && <><a className="btn primary" href={`#/veiculos/${v.id}/editar`}>Editar</a><a className="btn" href={`#/veiculos/${v.id}/duplicar`}>Duplicar</a><a className="btn" href={`#/qr?ids=${v.id}`}>Etiqueta QR</a>
                  {v.estado === "abatido" ? <button className="btn" onClick={async () => { await api(`/veiculos/${v.id}/reativar`, { metodo: "POST" }); recarregar(); }}>Reativar</button> : <button className="btn ghost" onClick={() => setAbater((x) => !x)}>Abater / arquivar</button>}</>}
                {instrutor && <><a className="btn primary" href="#/abastecer"><Icon n="fuel" s={16} />Abastecer</a><a className="btn" href="#/avaria"><Icon n="alert" s={16} />Reportar avaria</a></>}
              </div>
            </div>
          </div>
          {abater && gestao && <Abater v={v} fechar={() => setAbater(false)} />}
          <div className="tabs noprint" role="tablist">{tabs.map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{t}</button>)}</div>
          {tab === "resumo" && (instrutor ? <div className="card"><h3>Identificação</h3><div className="dl"><D k="Matrícula" v={v.matricula} /><D k="Data da matrícula" v={fdata(v.dataMatricula)} /><D k="N.º de quadro (VIN)" v={v.vin} /><D k="Localização" v={v.localizacao} /></div></div> : <Resumo v={v} />)}
          {tab === "dados" && <>
            <div className="card"><h3>Identificação e características</h3><div className="dl">
              <D k="Matrícula" v={v.matricula} /><D k="Data da matrícula" v={fdata(v.dataMatricula)} /><D k="N.º de quadro (VIN)" v={v.vin} /><D k="Categoria de ensino" v={v.categoria} />
              <D k="Comando duplo" v={sn(v.comandoDuplo)} /><D k="Cilindrada" v={v.cilindrada && `${v.cilindrada} cc`} /><D k="Potência" v={v.potenciaKw && `${v.potenciaKw} kW`} /><D k="Peso bruto" v={v.pesoBruto && `${v.pesoBruto} kg`} />
              <D k="Tara" v={v.tara && `${v.tara} kg`} /><D k="Lugares" v={v.lugares} /><D k="Pneus" v={v.pneus} /><D k="Tacógrafo" v={sn(v.tacografo)} /><D k="Localização" v={v.localizacao} />
            </div></div>
            {(gestao || consulta) && <div className="card"><h3>Gestão</h3><div className="dl">
              <D k="Adquirido em" v={fdata(v.dataAquisicao)} /><D k="Fornecedor" v={v.fornecedor} /><D k="Valor de aquisição" v={v.valorAquisicao != null ? eur(v.valorAquisicao) : null} />
              <D k="Cartão de combustível" v={v.cartaoCombustivel} /><D k="IUC aplicável" v={sn(v.iucAplicavel)} /><D k="IPO (meses)" v={v.ipoPeriodicidadeMeses} /><D k="Notas" v={v.notas} />
            </div></div>}
            {gestao && <Atribuicoes id={v.id} />}
          </>}
          {tab === "seguros" && <Registos veiculoId={v.id} recurso="seguros" gestao={gestao} />}
          {tab === "prazos" && <div className="grid two" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}><Registos veiculoId={v.id} recurso="inspecoes" gestao={gestao} /><Registos veiculoId={v.id} recurso="iuc" gestao={gestao} /></div>}
          {tab === "manut" && <Registos veiculoId={v.id} recurso="manutencoes" gestao={gestao} />}
          {tab === "comb" && <Registos veiculoId={v.id} recurso="abastecimentos" gestao={gestao} podeCriar={gestao} />}
          {tab === "avarias" && <Registos veiculoId={v.id} recurso="avarias" gestao={gestao} podeCriar={false} />}
          {tab === "ocorr" && <div className="grid"><Registos veiculoId={v.id} recurso="sinistros" gestao={gestao} /><Registos veiculoId={v.id} recurso="multas" gestao={gestao} /></div>}
          {tab === "docs" && <Documentos veiculoId={v.id} gestao={gestao} />}
        </>}
      </Carregar>
    </>
  );
}

function Atribuicoes({ id }: { id: number }) {
  const { dados } = useApi<{ id: number; utilizadorId: number; inicio: string; fim: string | null }[]>(`/veiculos/${id}/atribuicoes`);
  const u = useApi<{ id: number; nome: string }[]>("/utilizadores");
  const nome = (i: number) => u.dados?.find((x) => x.id === i)?.nome ?? `Utilizador ${i}`;
  if (!dados?.length) return null;
  return <div className="card"><h3>Histórico de atribuição</h3><div className="rows">{dados.map((a) => <div className="row" key={a.id}><div><b>{nome(a.utilizadorId)}</b><small>{fdata(a.inicio)} a {a.fim ? fdata(a.fim) : "atual"}</small></div>{!a.fim && <span className="chip ok">Atual</span>}</div>)}</div></div>;
}
