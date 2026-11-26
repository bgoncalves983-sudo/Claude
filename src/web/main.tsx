import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, ErroApi, type Eu } from "./api";
import { Login, MudarSenha, SessaoExpirada } from "./pages/Acesso";
import { Ficha } from "./pages/Ficha";
import { Inicio } from "./pages/Inicio";
import { Painel } from "./pages/Painel";
import { Sistema } from "./pages/Sistema";
import { Utilizadores } from "./pages/Utilizadores";
import { Veiculos } from "./pages/Veiculos";
import { Icon, Logo } from "./ui";
import "./styles.css";

function useRota(): string[] {
  const ler = () => location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [r, setR] = useState(ler);
  useEffect(() => { const f = () => setR(ler()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return r;
}

const NAV_GESTAO = [["", "Painel", "home"], ["veiculos", "Veículos", "car"], ["utilizadores", "Utilizadores", "users"]] as const;

function Shell({ eu, sair }: { eu: Eu; sair: () => void }) {
  const r = useRota();
  const instrutor = eu.perfil === "instrutor";
  const consulta = eu.perfil === "consulta";
  const nav: ReadonlyArray<readonly [string, string, string]> = instrutor
    ? [["", "O meu veículo", "car"]]
    : consulta ? [["veiculos", "Veículos", "car"]]
    : eu.perfil === "admin" ? [...NAV_GESTAO, ["sistema", "Sistema", "shield"]] : NAV_GESTAO;
  const atual = r[0] ?? "";
  const titulo = r[0] === "veiculos" && r[1] ? "Ficha do veículo" : (nav.find((n) => n[0] === atual)?.[1] ?? "Frota");

  let pagina;
  if (instrutor) pagina = r[0] === "veiculos" && r[1] ? <Ficha id={r[1]} eu={eu} /> : <Inicio eu={eu} />;
  else if (r[0] === "veiculos" && r[1]) pagina = <Ficha id={r[1]} eu={eu} />;
  else if (r[0] === "veiculos" || (consulta && !r[0])) pagina = <Veiculos eu={eu} />;
  else if (r[0] === "utilizadores" && !consulta) pagina = <Utilizadores eu={eu} />;
  else if (r[0] === "sistema" && eu.perfil === "admin") pagina = <Sistema />;
  else pagina = consulta ? <Veiculos eu={eu} /> : <Painel />;

  const ligacoes = (cls?: string) => nav.map(([h, t, i]) => (
    <a key={h} href={`#/${h}`} className={cls} aria-current={(atual === h || (h === "" && instrutor && atual === "veiculos")) ? "page" : undefined}><Icon n={i} s={cls ? 22 : 18} />{cls ? <span>{t}</span> : t}</a>));
  const iniciais = eu.nome.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="app">
      <aside className="side">
        <div className="logo"><Logo /><small>Gestão de frota</small></div>
        <nav className="nav" aria-label="Principal">{ligacoes()}</nav>
        <div className="me"><span className="avatar">{iniciais}</span><div><b>{eu.nome}</b><small>{eu.perfil === "instrutor" ? "Instrutor" : eu.perfil === "admin" ? "Administrador" : eu.perfil === "gestor" ? "Gestor" : "Consulta"}</small></div>
          {eu.username && <button className="btn ghost" style={{ gridColumn: "1 / -1" }} onClick={sair}><Icon n="logout" s={16} />Sair</button>}</div>
      </aside>
      <div className="main">
        <header className="topbar"><img className="tmark" src="/brand/mark-color.png" alt="" /><h2>{titulo}</h2>{eu.username && <button className="btn ghost" style={{ minHeight: 40 }} onClick={sair} aria-label="Sair"><Icon n="logout" s={18} /></button>}</header>
        <main className="content">{pagina}</main>
      </div>
      <nav className="bottomnav" aria-label="Principal">{ligacoes("b")}</nav>
    </div>
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

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
if ("serviceWorker" in navigator && import.meta.env.PROD) navigator.serviceWorker.register("/sw.js").catch(() => {});
