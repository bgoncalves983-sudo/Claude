import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, ErroApi } from "./api";

export const TIPOS: Record<string, string> = { mota: "Mota", ligeiro: "Ligeiro", pesado: "Pesado", reboque: "Reboque", trator_maquina: "Trator/Máquina" };
export const ESTADOS: Record<string, string> = { ativo: "Ativo", oficina: "Em oficina", imobilizado: "Imobilizado", abatido: "Abatido" };

const IC: Record<string, string> = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  car: "M5 16l1.5-5a2 2 0 011.9-1.4h7.2a2 2 0 011.9 1.4L19 16M4 16h16v3H4zM7.5 19v1.5M16.5 19v1.5",
  users: "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2 20c0-3.5 3-6 7-6s7 2.5 7 6M17 5a3 3 0 010 6M22 20c0-2.5-1.5-4.5-4-5.3",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4",
  plus: "M12 5v14M5 12h14", clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2", logout: "M10 17l5-5-5-5M15 12H3M21 4v16",
  fuel: "M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16M3 21h12M14 9h3a2 2 0 012 2v5a1.5 1.5 0 003 0V9l-3-3", alert: "M12 3l10 18H2L12 3zM12 10v5M12 18v.5", camera: "M4 8h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 100-8 4 4 0 000 8z", file: "M6 3h8l5 5v13H6zM14 3v5h5M9 13h7M9 17h7", link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5", check: "M5 13l4 4L19 7", copy: "M9 9h11v11H9zM5 15V5h10",
};
export function Icon({ n, s = 20 }: { n: keyof typeof IC | string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={IC[n]} /></svg>;
}

export function Logo({ vertical = false }: { vertical?: boolean }) {
  return vertical
    ? <img className="lg" src="/brand/logo-v-color.webp" alt="Escola de Condução Radical" />
    : <><img className="lg lg-l" src="/brand/logo-h-black.webp" alt="Escola de Condução Radical" /><img className="lg lg-d" src="/brand/logo-h-white.webp" alt="" /></>;
}

const SIL: Record<string, string> = {
  ligeiro: '<path d="M8 40l5-14c1-3 3-5 7-5h24c4 0 6 2 8 5l8 9c4 1 6 3 6 7v5H4v-6c0-1 1-1 4-1z" fill="currentColor"/><circle cx="22" cy="50" r="7" fill="#0003" stroke="currentColor" stroke-width="3"/><circle cx="62" cy="50" r="7" fill="#0003" stroke="currentColor" stroke-width="3"/>',
  mota: '<circle cx="18" cy="46" r="10" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="66" cy="46" r="10" fill="none" stroke="currentColor" stroke-width="4"/><path d="M18 46l14-18h18l16 18M32 28l-4-8h-8M50 28l6-10h8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  pesado: '<path d="M2 18h46v28H2zM48 26h16l10 12v8H48z" fill="currentColor"/><circle cx="16" cy="50" r="7" fill="#0003" stroke="currentColor" stroke-width="3"/><circle cx="34" cy="50" r="7" fill="#0003" stroke="currentColor" stroke-width="3"/><circle cx="62" cy="50" r="7" fill="#0003" stroke="currentColor" stroke-width="3"/>',
  reboque: '<path d="M2 16h72v30H2z" fill="currentColor"/><circle cx="24" cy="50" r="7" fill="#0003" stroke="currentColor" stroke-width="3"/><circle cx="42" cy="50" r="7" fill="#0003" stroke="currentColor" stroke-width="3"/><circle cx="60" cy="50" r="7" fill="#0003" stroke="currentColor" stroke-width="3"/>',
  trator_maquina: '<path d="M30 14h20l4 14h12v16H30z" fill="currentColor"/><circle cx="20" cy="42" r="13" fill="#0003" stroke="currentColor" stroke-width="4"/><circle cx="64" cy="48" r="8" fill="#0003" stroke="currentColor" stroke-width="3"/>',
};
/** Silhueta enquanto o veiculo nao tem fotografia. */
export function Foto({ tipo, tag, v, grande }: { tipo: string; tag?: boolean; v?: { id: number; temFoto: boolean; fotoVersao?: string | null }; grande?: boolean }) {
  return (
    <div className="photo">
      {v?.temFoto
        ? <img src={`/api/veiculos/${v.id}/foto?${grande ? "" : "tam=mini&"}v=${encodeURIComponent(v.fotoVersao ?? "")}`} alt="" loading="lazy" decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        : <svg viewBox="0 0 80 60" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SIL[tipo] ?? SIL.ligeiro }} />}
      {tag && <span className="tag chip">{TIPOS[tipo] ?? tipo}</span>}
    </div>
  );
}

export const Matricula = ({ m }: { m: string }) => <span className="plate">{m}</span>;
export const ChipEstado = ({ e }: { e: string }) => <span className={`chip ${e === "ativo" ? "ok" : e === "oficina" ? "warn" : ""}`}>{ESTADOS[e] ?? e}</span>;

export function ChipDias({ dias }: { dias: number }) {
  if (dias < 0) return <span className="chip crit">⚠ Caducado há {-dias} d</span>;
  if (dias === 0) return <span className="chip crit">⚠ Caduca hoje</span>;
  if (dias <= 15) return <span className="chip crit">⚠ {dias} dias</span>;
  if (dias <= 60) return <span className="chip warn">{dias} dias</span>;
  return <span className="chip ok">{dias} dias</span>;
}

export const fdata = (d: string | null | undefined) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
export const eur = (n: number) => n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

/** Carrega dados da API com estados de carregamento e erro. */
export function useApi<T>(caminho: string | null) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!caminho) return;
    let vivo = true;
    setErro(null);
    api<T>(caminho).then((d) => vivo && setDados(d), (e: ErroApi) => vivo && setErro(e));
    return () => { vivo = false; };
  }, [caminho, n]);
  const recarregar = useCallback(() => setN((x) => x + 1), []);
  return { dados, erro, recarregar };
}

export function Carregar({ erro, dados, children }: { erro: ErroApi | null; dados: unknown; children: ReactNode }) {
  if (erro) return <div className="errbox" role="alert">{erro.message}</div>;
  if (dados === null) return <div className="grid" aria-busy="true"><div className="skel" style={{ height: 90 }} /><div className="skel" style={{ height: 160 }} /></div>;
  return <>{children}</>;
}
