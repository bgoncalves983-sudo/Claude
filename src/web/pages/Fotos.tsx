import { useEffect, useRef, useState } from "react";
import { reduzir } from "../lib/imagem";
import type { FotoPendente } from "../lib/fila";

export interface FotoLocal extends FotoPendente { url: string }

/** Tirar ou escolher fotografias (ate 5). Reduzem-se no telemovel antes de seguirem. */
export function EscolherFotos({ fotos, onChange, max = 5 }: { fotos: FotoLocal[]; onChange: (f: FotoLocal[]) => void; max?: number }) {
  const [aPreparar, setAPreparar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ref = useRef(fotos); ref.current = fotos;
  useEffect(() => () => { ref.current.forEach((f) => URL.revokeObjectURL(f.url)); }, []);

  async function adicionar(lista: FileList | null) {
    if (!lista?.length) return;
    setErro(null); setAPreparar(true);
    try {
      const novas: FotoLocal[] = [];
      for (const f of Array.from(lista).slice(0, max - fotos.length)) {
        if (!f.type.startsWith("image/")) { setErro("Só é possível anexar imagens."); continue; }
        const mini = await reduzir(f, 400, 0.8);
        novas.push({ id: crypto.randomUUID(), grande: await reduzir(f, 1600, 0.82), mini, url: URL.createObjectURL(mini) });
      }
      onChange([...fotos, ...novas]);
    } catch { setErro("Não foi possível preparar a fotografia. Tente outra."); } finally { setAPreparar(false); }
  }
  const remover = (id: string) => { const f = fotos.find((x) => x.id === id); if (f) URL.revokeObjectURL(f.url); onChange(fotos.filter((x) => x.id !== id)); };
  const cheio = fotos.length >= max;

  return (
    <div className="form">
      <div className="thumbs">
        {fotos.map((f) => (
          <div className="thumb" key={f.id}><img src={f.url} alt="Fotografia anexada" /><button type="button" onClick={() => remover(f.id)} aria-label="Remover fotografia">×</button></div>))}
      </div>
      {!cheio && <div className="actions">
        <label className="btn" style={{ cursor: "pointer" }}>📷 Tirar foto<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void adicionar(e.target.files); e.target.value = ""; }} /></label>
        <label className="btn" style={{ cursor: "pointer" }}>Escolher da galeria<input type="file" accept="image/*" multiple hidden onChange={(e) => { void adicionar(e.target.files); e.target.value = ""; }} /></label>
      </div>}
      {aPreparar && <span className="muted" role="status">A preparar a fotografia…</span>}
      {erro && <div className="errbox" role="alert">{erro}</div>}
      <small className="muted">{fotos.length}/{max} fotografias{cheio ? " (máximo)" : ""}</small>
    </div>
  );
}
