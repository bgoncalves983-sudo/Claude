import { useCallback, useEffect, useState } from "react";
import { api, ErroApi } from "../api";
import { Carregar, fdata, useApi } from "../ui";

interface Linha { id: number; criadoEm: string; acao: string; entidade: string; entidadeId: number | null; detalhe: string | null; quem: string | null }
interface Pagina { linhas: Linha[]; temMais: boolean }

const ACOES: Record<string, string> = {
  criar: "Criou", editar: "Alterou", apagar: "Apagou", login: "Entrou", "mudar-senha": "Mudou a palavra-passe", "repor-senha": "Repôs a palavra-passe",
  "terminar-sessoes": "Terminou sessões", desativar: "Desativou", associar: "Associou", terminar: "Terminou", trocar: "Trocou", abater: "Abateu", reativar: "Reativou",
  "editar-lote": "Editou em lote", importar: "Importou", entrada: "Entrada de gasóleo", saida: "Saída de gasóleo", contagem: "Contagem física", anular: "Anulou",
  foto: "Alterou a foto", "foto-avaria": "Anexou foto a avaria", backup: "Criou cópia de segurança", "descarregar-backup": "Descarregou cópia de segurança", carregar: "Carregou documento",
};
const ENTIDADES: Record<string, string> = { veiculo: "Veículo", utilizador: "Utilizador", conjunto: "Conjunto", deposito: "Depósito", avaria: "Avaria", documento: "Documento", sistema: "Sistema", seguros: "Seguro", iuc: "IUC", inspecoes: "Inspeção", manutencoes: "Manutenção", abastecimentos: "Abastecimento", avarias: "Avaria", verificacoes: "Verificação", sinistros: "Sinistro", multas: "Multa" };

function resumo(d: string | null): string {
  if (!d) return "";
  try {
    const o = JSON.parse(d) as Record<string, unknown>;
    return Object.entries(o).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ").slice(0, 160);
  } catch { return d.slice(0, 160); }
}

export function Auditoria() {
  const filtros = useApi<{ entidades: string[]; acoes: string[] }>("/auditoria/filtros");
  const [entidade, setEntidade] = useState("");
  const [so, setSo] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [temMais, setTemMais] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);

  const carregar = useCallback(async (antes?: number) => {
    const q = new URLSearchParams({ limite: "50" });
    if (entidade) q.set("entidade", entidade); if (so) q.set("naoAssociado", "1"); if (antes) q.set("antes", String(antes));
    try {
      const r = await api<Pagina>(`/auditoria?${q}`);
      setLinhas((x) => (antes ? [...x, ...r.linhas] : r.linhas)); setTemMais(r.temMais); setCarregado(true); setErro(null);
    } catch (e) { setErro(e as ErroApi); }
  }, [entidade, so]);
  useEffect(() => { setCarregado(false); void carregar(); }, [carregar]);

  return (
    <>
      <div className="note">Registo de quem fez o quê e quando. Só os administradores o veem.</div>
      <div className="chips">
        <label className="f" style={{ minWidth: 190 }}><span style={{ position: "absolute", left: -9999 }}>Tipo de registo</span>
          <select aria-label="Tipo de registo" value={entidade} onChange={(e) => setEntidade(e.target.value)} style={{ minHeight: 44, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", padding: "0 12px", color: "var(--ink)" }}>
            <option value="">Todos os registos</option>{filtros.dados?.entidades.map((e) => <option key={e} value={e}>{ENTIDADES[e] ?? e}</option>)}
          </select></label>
        <button aria-pressed={so} onClick={() => setSo((x) => !x)}>Só em veículos não atribuídos</button>
      </div>
      <Carregar erro={erro} dados={carregado ? linhas : null}>
        {linhas.length === 0 && <div className="card">Sem registos para este filtro.</div>}
        <div className="card"><div className="rows">{linhas.map((l) => (
          <div className="row" key={l.id}>
            <div><b>{l.quem ?? "Sistema"} · {ACOES[l.acao] ?? l.acao} · {ENTIDADES[l.entidade] ?? l.entidade}{l.entidadeId ? ` #${l.entidadeId}` : ""}</b>
              {l.detalhe && <small style={{ overflowWrap: "anywhere" }}>{resumo(l.detalhe)}</small>}</div>
            <div className="right muted" style={{ fontSize: 12 }}>{fdata(l.criadoEm)}<br />{l.criadoEm.slice(11, 16)}</div>
          </div>))}</div>
          {temMais && <div style={{ marginTop: 12 }}><button className="btn" onClick={() => void carregar(linhas.at(-1)?.id)}>Carregar mais</button></div>}</div>
      </Carregar>
    </>
  );
}
