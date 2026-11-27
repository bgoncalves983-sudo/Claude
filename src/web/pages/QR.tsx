import qrcode from "qrcode-generator";
import { useMemo } from "react";
import type { Veiculo } from "../api";
import { Carregar, Matricula, useApi } from "../ui";

function qrSvg(texto: string): string {
  const q = qrcode(0, "M"); q.addData(texto); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

/** Etiquetas para colar nos veiculos: o QR abre a ficha no endereco dos instrutores (sem "gestao."). */
export function QR() {
  const ids = useMemo(() => (location.hash.split("?ids=")[1] ?? "").split(",").map(Number).filter(Boolean), []);
  const { dados, erro } = useApi<Veiculo[]>("/veiculos");
  const lista = (dados ?? []).filter((v) => (ids.length ? ids.includes(v.id) : v.estado !== "abatido"));
  const base = location.origin.replace("//gestao.", "//");
  return (
    <>
      <div className="noprint"><a href="#/veiculos" className="muted">← Veículos</a></div>
      <div className="noprint card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}><b>{lista.length} etiqueta(s)</b><div className="muted">Imprima em vinil adesivo. O instrutor aponta a câmara e o veículo fica escolhido na aplicação.</div></div>
        <button className="btn primary" onClick={() => window.print()}>Imprimir</button>
      </div>
      <Carregar erro={erro} dados={dados}>
        <div className="qrgrid">{lista.map((v) => (
          <div className="qrlabel" key={v.id}>
            <img src="/brand/logo-h-black.webp" alt="" /><Matricula m={v.matricula} />
            <div dangerouslySetInnerHTML={{ __html: qrSvg(`${base}/#/v/${v.id}`) }} />
            <small>{[v.marca, v.modelo].filter(Boolean).join(" ")}</small>
          </div>))}</div>
      </Carregar>
    </>
  );
}
