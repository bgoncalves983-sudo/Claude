import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, ErroApi, type Eu } from "./api";
import { Login, MudarSenha, SessaoExpirada } from "./pages/Acesso";
import { Ficha } from "./pages/Ficha";
import { Abastecer, Avaria, Inicio, UsarVeiculo, Verificacao } from "./pages/Instrutor";
import { Avarias, type ResumoAvarias } from "./pages/Avarias";
import { Deposito } from "./pages/Deposito";
import { FormVeiculo } from "./pages/FormVeiculo";
import { Importar } from "./pages/Importar";
import { QR } from "./pages/QR";
import { aoMudar, iniciarSincronizacao, sincronizar } from "./lib/fila";
import { Painel } from "./pages/Painel";
import { Sistema } from "./pages/Sistema";
import { Utilizadores } from "./pages/Utilizadores";
import { Veiculos } from "./pages/Veiculos";
import { Icon, Logo } from "./ui";
import "./styles.css";

function useRota(): string[] {
  const ler = () => location.hash.replace(/^#\/?/, "").split("?")[0].split("/").filter(Boolean);
  const [r, setR] = useState(ler);
  useEffect(() => { const f = () => setR(ler()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return r;
}

const NAV_GESTAO = [["", "Painel", "home"], ["avarias", "Avarias", "alert"], ["veiculos", "Veículos", "car"], ["deposito", "Depósito", "fuel"], ["utilizadores", "Utilizadores", "users"]] as const;
const NAV_INSTRUTOR = [["", "Início", "home"], ["abastecer", "Abastecer", "fuel"], ["avaria", "Avaria", "alert"], ["verificacao", "Verificação", "check"]] as const;

function Shell({ eu, sair }: { eu: Eu; sair: () => void }) {
  const r = useRota();
  const instrutor = eu.perfil === "instrutor";
  const consulta = eu.perfil === "consulta";
  const gestao = !instrutor && !consulta;
  const [pendentes, setPendentes] = useState(0);
  useEffect(() => aoMudar(setPendentes), []);
  // A gestao ve de 30 em 30 segundos (e ao voltar ao separador) quantas avarias novas ha.
  const [novas, setNovas] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (instrutor) return;
    let vivo = true;
    const ver = () => { if (document.visibilityState === "visible") api<ResumoAvarias>("/avarias/resumo").then((r) => vivo && setNovas(r.novas)).catch(() => {}); };
    ver(); const t = setInterval(ver, 30_000); document.addEventListener("visibilitychange", ver);
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", ver); };
  }, [instrutor, tick]);
  useEffect(() => { document.title = novas > 0 ? `(${novas}) Frota Radical` : "Frota Radical"; try { (navigator as any).setAppBadge?.(novas || undefined); } catch { /* sem suporte */ } }, [novas]);
  const nav: ReadonlyArray<readonly [string, string, string]> = instrutor ? NAV_INSTRUTOR
    : consulta ? [["", "Veículos", "car"], ["avarias", "Avarias", "alert"], ["deposito", "Depósito", "fuel"]]
    : eu.perfil === "admin" ? [...NAV_GESTAO, ["sistema", "Sistema", "shield"]] : NAV_GESTAO;
  const raiz = r[0] ?? "";
  const atual = instrutor && raiz === "veiculos" ? "" : consulta && raiz === "veiculos" ? "" : raiz;
  const TITULOS: Record<string, string> = { avarias: "Avarias", "": instrutor ? "O meu veículo" : consulta ? "Veículos" : "Painel", veiculos: "Veículos", deposito: "Depósito de gasóleo", utilizadores: "Utilizadores", sistema: "Sistema", abastecer: "Registar abastecimento", avaria: "Reportar avaria", verificacao: "Verificação diária", qr: "Etiquetas QR" };
  let titulo = TITULOS[raiz] ?? "Frota";
  if (raiz === "veiculos") titulo = r[1] === "novo" ? "Novo veículo" : r[1] === "importar" ? "Importar veículos" : r[1] && r[2] === "editar" ? "Editar veículo" : r[1] && r[2] === "duplicar" ? "Duplicar veículo" : r[1] ? "Ficha do veículo" : "Veículos";

  let pagina;
  if (instrutor) {
    pagina = raiz === "v" && r[1] ? <UsarVeiculo id={Number(r[1])} /> : raiz === "veiculos" && r[1] ? <Ficha id={r[1]} eu={eu} /> : raiz === "abastecer" ? <Abastecer /> : raiz === "avaria" ? <Avaria /> : raiz === "verificacao" ? <Verificacao /> : <Inicio eu={eu} />;
  } else if (raiz === "v" && r[1]) { location.replace(`#/veiculos/${r[1]}`); pagina = null;
  } else if (raiz === "veiculos" && r[1] === "novo" && gestao) pagina = <FormVeiculo modo="novo" />;
  else if (raiz === "veiculos" && r[1] === "importar" && gestao) pagina = <Importar />;
  else if (raiz === "veiculos" && r[1] && r[2] === "editar" && gestao) pagina = <FormVeiculo modo="editar" id={r[1]} />;
  else if (raiz === "veiculos" && r[1] && r[2] === "duplicar" && gestao) pagina = <FormVeiculo modo="duplicar" id={r[1]} />;
  else if (raiz === "veiculos" && r[1]) pagina = <Ficha id={r[1]} eu={eu} />;
  else if (raiz === "veiculos" || (consulta && !raiz)) pagina = <Veiculos eu={eu} />;
  else if (raiz === "avarias") pagina = <Avarias gestao={gestao} aoAlterar={() => setTick((x) => x + 1)} />;
  else if (raiz === "deposito") pagina = <Deposito gestao={gestao} />;
  else if (raiz === "qr" && gestao) pagina = <QR />;
  else if (raiz === "utilizadores" && gestao) pagina = <Utilizadores eu={eu} />;
  else if (raiz === "sistema" && eu.perfil === "admin") pagina = <Sistema />;
  else pagina = <Painel />;

  const ligacoes = (cls?: string) => nav.map(([h, t, i]) => (
    <a key={h} href={`#/${h}`} className={cls} aria-current={atual === h ? "page" : undefined}><Icon n={i} s={cls ? 22 : 18} />{cls ? <span>{t}</span> : t}{h === "avarias" && novas > 0 && <span className="badge-n" aria-label={`${novas} novas`}>{novas}</span>}</a>));
  const iniciais = eu.nome.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      {pendentes > 0 && <div className="banner" role="status">{pendentes} registo(s) por enviar. <button className="btn ghost" style={{ minHeight: 32, padding: "2px 10px" }} onClick={() => void sincronizar()}>Enviar agora</button></div>}
      <div className="app">
        <aside className="side">
          <div className="logo"><Logo /><small>Gestão de frota</small></div>
          <nav className="nav" aria-label="Principal">{ligacoes()}</nav>
          <div className="me"><span className="avatar">{iniciais}</span><div><b>{eu.nome}</b><small>{instrutor ? "Instrutor" : eu.perfil === "admin" ? "Administrador" : eu.perfil === "gestor" ? "Gestor" : "Consulta"}</small></div>
            {eu.username && <button className="btn ghost" style={{ gridColumn: "1 / -1" }} onClick={sair}><Icon n="logout" s={16} />Sair</button>}</div>
        </aside>
        <div className="main">
          <header className="topbar"><img className="tmark" src="/brand/mark-color.png" alt="" /><h2>{titulo}</h2>{eu.username && <button className="btn ghost" style={{ minHeight: 40 }} onClick={sair} aria-label="Sair"><Icon n="logout" s={18} /></button>}</header>
          <main className="content">{pagina}</main>
        </div>
        <nav className="bottomnav" aria-label="Principal">{ligacoes("b")}</nav>
      </div>
    </>
  );
}

function App() {
  const [eu, setEu] = useState<Eu | null | undefined>(undefined);
  const [senhaTemp, setSenhaTemp] = useState("");
  const gestaoHost = location.hostname.startsWith("gestao.");

  const carregar = useCallback(() => {
    api<Eu>("/me").then(setEu, (e: ErroApi) => { if (e.estado === 401 || e.estado === 403) setEu(null); else throw e; });
  }, []);
  useEffect(carregar, [carregar]);

  if (eu === undefined) return <div className="full"><div className="skel" style={{ width: 200, height: 24 }} aria-busy="true" /></div>;
  if (eu === null) return gestaoHost ? <SessaoExpirada /> : <Login aoEntrar={(s) => { setSenhaTemp(s); carregar(); }} />;
  if (eu.deveMudarSenha) return <MudarSenha senhaAtual={senhaTemp} aoConcluir={() => { setSenhaTemp(""); carregar(); }} />;
  return <Shell eu={eu} sair={async () => { await api("/auth/logout", { metodo: "POST" }).catch(() => {}); setSenhaTemp(""); setEu(null); location.hash = "#/"; }} />;
}

iniciarSincronizacao();
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
if ("serviceWorker" in navigator && import.meta.env.PROD) navigator.serviceWorker.register("/sw.js").catch(() => {});
