import type { ReactNode } from "react";

export interface CampoProps {
  id: string; label: string; valor: string; onChange: (v: string) => void;
  tipo?: "text" | "number" | "date" | "email"; opcoes?: [string, string][]; area?: boolean; obrig?: boolean; passo?: string;
  lista?: string[]; necessario?: boolean; ajuda?: string; largo?: boolean;
}
export function Campo(p: CampoProps) {
  const cls = `f${p.necessario ? " need" : ""}`;
  const st = p.largo ? { gridColumn: "1 / -1" } : undefined;
  return (
    <label className={cls} htmlFor={p.id} style={st}>{p.label}{p.obrig ? " *" : ""}
      {p.opcoes ? <select id={p.id} value={p.valor} onChange={(e) => p.onChange(e.target.value)} required={p.obrig}><option value="">—</option>{p.opcoes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        : p.area ? <textarea id={p.id} value={p.valor} onChange={(e) => p.onChange(e.target.value)} rows={3} />
        : <input id={p.id} type={p.tipo ?? "text"} value={p.valor} onChange={(e) => p.onChange(e.target.value)} required={p.obrig}
            step={p.passo ?? (p.tipo === "number" ? "any" : undefined)} inputMode={p.tipo === "number" ? "decimal" : undefined} list={p.lista ? `${p.id}-l` : undefined} />}
      {p.lista && <datalist id={`${p.id}-l`}>{p.lista.map((x) => <option key={x} value={x} />)}</datalist>}
      {p.ajuda && <small className="muted">{p.ajuda}</small>}
    </label>
  );
}
export function Interruptor({ id, label, valor, onChange }: { id: string; label: string; valor: boolean; onChange: (v: boolean) => void }) {
  return <label className="toggle" htmlFor={id}><input id={id} type="checkbox" checked={valor} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
}
export const Secao = ({ titulo, children }: { titulo: string; children: ReactNode }) => <div className="card form"><h3>{titulo}</h3>{children}</div>;
export const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
export const vazio = (s: string) => (s.trim() === "" ? null : s.trim());
