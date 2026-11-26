import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, ErroApi, type Alerta, type Utilizador, type Veiculo } from "./api";
import "./styles.css";

const useHash = () => {
  const [h, setH] = useState(location.hash || "#/");
  useEffect(() => {
    const f = () => setH(location.hash || "#/");
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  return h;
};

function useApi<T>(caminho: string | null) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (!caminho) return;
    setDados(null);
    setErro(null);
    api<T>(caminho).then(setDados, (e: ErroApi) => setErro(e.message));
  }, [caminho]);
  return { dados, erro };
}

const TIPOS: Record<string, string> = { mota: "Mota", ligeiro: "Ligeiro", pesado: "Pesado", reboque: "Reboque", trator_maquina: "Trator/Máquina" };

function Painel() {
  const { dados, erro } = useApi<Alerta[]>("/alertas");
  if (erro) return <p className="aviso">{erro}</p>;
  if (!dados) return <p>A carregar…</p>;
  return (
    <>
      <h2>Prazos a atender</h2>
      {dados.length === 0 && <p>Sem prazos em risco. 👍</p>}
      <ul className="lista">
        {dados.map((a) => (
          <li key={a.chave} className={a.dias < 0 ? "caducado" : a.dias <= 15 ? "urgente" : ""}>
            <b>{a.rotulo}</b>
            <span>{a.dias < 0 ? `caducado há ${-a.dias} d` : a.dias === 0 ? "caduca hoje" : `${a.dias} dias`} · {a.data}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function ListaVeiculos() {
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tipo) params.set("tipo", tipo);
  const { dados, erro } = useApi<Veiculo[]>(`/veiculos?${params}`);
  return (
    <>
      <h2>Veículos {dados && <small>({dados.length})</small>}</h2>
      <div className="filtros">
        <input placeholder="Pesquisar matrícula, marca…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {erro && <p className="aviso">{erro}</p>}
      {!dados && !erro && <p>A carregar…</p>}
      <ul className="lista">
        {dados?.map((v) => (
          <li key={v.id}>
            <a href={`#/veiculos/${v.id}`}><b>{v.matricula}</b> <span>{[v.marca, v.modelo].filter(Boolean).join(" ")}</span></a>
            <span>{TIPOS[v.tipo]}{v.categoria ? ` · ${v.categoria}` : ""} · {v.estado}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Ficha({ id }: { id: string }) {
  const { dados: v, erro } = useApi<Veiculo>(`/veiculos/${id}`);
  if (erro) return <p className="aviso">{erro}</p>;
  if (!v) return <p>A carregar…</p>;
  return (
    <>
      <p><a href="#/veiculos">← Veículos</a></p>
      <h2>{v.matricula}</h2>
      <dl className="ficha">
        <dt>Tipo</dt><dd>{TIPOS[v.tipo]}{v.categoria ? ` (${v.categoria})` : ""}</dd>
        <dt>Marca / modelo</dt><dd>{[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}</dd>
        <dt>Estado</dt><dd>{v.estado}</dd>
        <dt>Km</dt><dd>{v.kmAtuais ?? "—"}</dd>
        <dt>Conjunto</dt><dd>{v.conjuntoAtivo ? `Associado (trator #${v.conjuntoAtivo.tratorId} + reboque #${v.conjuntoAtivo.reboqueId})` : "Sem reboque associado"}</dd>
      </dl>
    </>
  );
}

function App() {
  const hash = useHash();
  const { dados: eu, erro } = useApi<Utilizador>("/me");
  if (erro) return <main><p className="aviso">{erro}</p></main>;
  if (!eu) return <main><p>A carregar…</p></main>;
  const gestao = eu.perfil === "admin" || eu.perfil === "gestor";
  const partes = hash.replace(/^#\/?/, "").split("/");
  return (
    <>
      <header>
        <strong>Frota Radical</strong>
        <nav>
          {gestao && <a href="#/" aria-current={partes[0] === "" ? "page" : undefined}>Painel</a>}
          <a href="#/veiculos" aria-current={partes[0] === "veiculos" ? "page" : undefined}>Veículos</a>
        </nav>
        <small>{eu.nome}</small>
      </header>
      <main>
        {partes[0] === "veiculos" && partes[1] ? <Ficha id={partes[1]} /> : partes[0] === "veiculos" || !gestao ? <ListaVeiculos /> : <Painel />}
      </main>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
if ("serviceWorker" in navigator && import.meta.env.PROD) navigator.serviceWorker.register("/sw.js").catch(() => {});
