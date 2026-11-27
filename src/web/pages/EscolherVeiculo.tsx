import { useEffect, useMemo, useRef, useState } from "react";
import type { Veiculo } from "../api";
import { ChipEstado, Icon, Matricula, TIPOS } from "../ui";

const RECENTES = "veiculos-recentes";
export const lerRecentes = (): number[] => { try { return JSON.parse(localStorage.getItem(RECENTES) ?? "[]"); } catch { return []; } };
export const guardarRecente = (id: number) => { try { localStorage.setItem(RECENTES, JSON.stringify([id, ...lerRecentes().filter((x) => x !== id)].slice(0, 5))); } catch { /* sem armazenamento */ } };

/** Extrai o id de um QR da frota (…/#/v/12). */
export const idDoQR = (texto: string): number | null => { const m = texto.match(/#\/v\/(\d+)/); return m ? Number(m[1]) : null; };

function Linha({ v, escolhido, aoEscolher }: { v: Veiculo; escolhido: boolean; aoEscolher: () => void }) {
  return (
    <button type="button" className="vrow" aria-pressed={escolhido} onClick={aoEscolher}>
      <Matricula m={v.matricula} />
      <span className="vrow-t"><b>{[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}</b><small>{TIPOS[v.tipo] ?? v.tipo}{v.categoria ? ` · ${v.categoria}` : ""}{v.proprietario ? ` · ${v.proprietario.replace("Escola ", "")}` : ""}</small></span>
      {escolhido ? <span className="chip ok">✓ Em uso</span> : <Icon n="arrow" s={18} />}
    </button>
  );
}

/** Le o QR colado no veiculo com a camara (onde o browser suporta; senao, a camara normal do telemovel tambem abre o veiculo). */
function LerQR({ aoLer, fechar }: { aoLer: (id: number) => void; fechar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let parar = false; let stream: MediaStream | undefined; let timer: number | undefined;
    (async () => {
      try {
        const Detector = (window as any).BarcodeDetector; const det = new Detector({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (parar) return stream.getTracks().forEach((t) => t.stop());
        video.current!.srcObject = stream; await video.current!.play();
        timer = window.setInterval(async () => {
          try { const r = await det.detect(video.current!); const id = r[0] && idDoQR(r[0].rawValue); if (id) aoLer(id); } catch { /* frame sem codigo */ }
        }, 300);
      } catch { setErro("Não foi possível abrir a câmara. Autorize o acesso nas definições do browser."); }
    })();
    return () => { parar = true; if (timer) clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [aoLer]);
  return (
    <div className="card form">
      <b>Aponte a câmara ao QR do veículo</b>
      <video ref={video} playsInline muted style={{ width: "100%", borderRadius: 12, background: "#000", aspectRatio: "4 / 3", objectFit: "cover" }} />
      {erro && <div className="errbox" role="alert">{erro}</div>}
      <button type="button" className="btn" onClick={fechar}>Cancelar</button>
    </div>
  );
}

export interface PropsEscolher { atribuidos: Veiculo[]; outros: Veiculo[]; podeEscolherOutro: boolean; atual: number | null; aoEscolher: (id: number) => void; fechar: () => void }

/** Ecra inteiro para escolher o veiculo: pesquisa, filtros, recentes, QR. */
export function EscolherVeiculo({ atribuidos, outros, podeEscolherOutro, atual, aoEscolher, fechar }: PropsEscolher) {
  const [q, setQ] = useState(""); const [tipo, setTipo] = useState(""); const [ler, setLer] = useState(false);
  const temScanner = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;
  const todos = useMemo(() => [...atribuidos, ...outros], [atribuidos, outros]);
  const bate = (v: Veiculo) => (!tipo || v.tipo === tipo) && (!q || `${v.matricula} ${v.marca ?? ""} ${v.modelo ?? ""}`.toLowerCase().includes(q.toLowerCase().replace(/[\s-]/g, "")) || v.matricula.replace(/-/g, "").toLowerCase().includes(q.toLowerCase().replace(/[\s-]/g, "")));
  const meus = atribuidos.filter(bate);
  const recentes = !q && !tipo && podeEscolherOutro ? lerRecentes().map((id) => outros.find((v) => v.id === id)).filter(Boolean) as Veiculo[] : [];
  const resto = outros.filter((v) => bate(v) && !recentes.includes(v));
  const escolher = (id: number) => { guardarRecente(id); aoEscolher(id); };
  const lidoQR = useMemo(() => (id: number) => { const v = todos.find((x) => x.id === id); if (v) escolher(v.id); else setLer(false); }, [todos]); // eslint-disable-line

  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); }; addEventListener("keydown", f); return () => removeEventListener("keydown", f); }, [fechar]);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Escolher veículo">
      <header className="sheet-h"><button type="button" className="btn ghost" onClick={fechar} aria-label="Voltar">← Voltar</button><h2>Escolher veículo</h2>{temScanner && podeEscolherOutro && <button type="button" className="btn" onClick={() => setLer((x) => !x)}>Ler QR</button>}</header>
      <div className="sheet-b">
        {ler && <LerQR aoLer={lidoQR} fechar={() => setLer(false)} />}
        {!podeEscolherOutro && atribuidos.length > 1 && <div className="note">Tem mais de um veículo atribuído. Escolha o que vai usar.</div>}
        {podeEscolherOutro && <>
          <label className="search"><span className="muted" aria-hidden="true">⌕&nbsp;</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Matrícula, marca ou modelo" aria-label="Procurar veículo" autoFocus /></label>
          <div className="chips" role="group" aria-label="Tipo de veículo"><button type="button" aria-pressed={tipo === ""} onClick={() => setTipo("")}>Todos</button>{Object.entries(TIPOS).filter(([k]) => k !== "reboque").map(([k, t]) => <button type="button" key={k} aria-pressed={tipo === k} onClick={() => setTipo(k)}>{t}</button>)}</div>
        </>}
        {meus.length > 0 && <section><h3 className="sec">Atribuídos a si</h3><div className="vlist">{meus.map((v) => <Linha key={v.id} v={v} escolhido={atual === v.id} aoEscolher={() => escolher(v.id)} />)}</div></section>}
        {recentes.length > 0 && <section><h3 className="sec">Usados recentemente</h3><div className="vlist">{recentes.map((v) => <Linha key={v.id} v={v} escolhido={atual === v.id} aoEscolher={() => escolher(v.id)} />)}</div></section>}
        {podeEscolherOutro && <section><h3 className="sec">Toda a frota <span className="muted">({resto.length})</span></h3>
          {atribuidos.length === 0 && !q && <div className="note" style={{ marginBottom: 10 }}>Ainda não tem veículo atribuído: escolha o que vai usar. O registo fica identificado para o responsável de frota.</div>}
          <div className="vlist">{resto.length === 0 ? <span className="muted">Nenhum veículo encontrado.</span> : resto.map((v) => <Linha key={v.id} v={v} escolhido={atual === v.id} aoEscolher={() => escolher(v.id)} />)}</div></section>}
        {atribuidos.length === 0 && !podeEscolherOutro && <div className="card">Sem veículos disponíveis.</div>}
      </div>
    </div>
  );
}
export { ChipEstado };
