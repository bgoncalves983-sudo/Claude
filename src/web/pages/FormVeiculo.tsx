import { useEffect, useState, type FormEvent } from "react";
import { api, ErroApi, type UtilizadorLinha, type Veiculo } from "../api";
import { Campo, Interruptor, num, Secao, vazio } from "../form";
import { Carregar, TIPOS, useApi } from "../ui";

type F = Record<string, string>; type B = Record<string, boolean>;
const CATEGORIAS = ["AM", "A1", "A2", "A", "B", "BE", "C1", "C", "CE", "D1", "D", "DE", "Trator"];
const COMBUSTIVEIS = ["Gasolina", "Gasóleo", "Elétrico", "Híbrido", "GPL", "Outro"];
const ESCOLAS = ["Escola Radical", "Escola Patria"];

const textos = ["matricula", "tipo", "categoria", "proprietario", "marca", "modelo", "cor", "vin", "combustivel", "dataMatricula", "pneus", "localizacao", "cartaoCombustivel", "fornecedor", "dataAquisicao", "estado", "notas", "instrutorId"] as const;
const numeros = ["pesoBruto", "tara", "lugares", "cilindrada", "potenciaKw", "kmAtuais", "horasAtuais", "ipoPeriodicidadeMeses", "valorAquisicao"] as const;
const bools = ["comandoDuplo", "tacografo", "ensino", "usaHoras", "iucAplicavel", "seguroCobertoPeloTrator"] as const;

/** Criar, editar ou duplicar um veiculo. Na duplicacao copiam-se os dados tecnicos e deixam-se em branco os que sao unicos. */
export function FormVeiculo({ modo, id }: { modo: "novo" | "editar" | "duplicar"; id?: string }) {
  const origem = useApi<Veiculo>(modo === "novo" ? null : `/veiculos/${id}`);
  const utilizadores = useApi<UtilizadorLinha[]>("/utilizadores");
  const [f, setF] = useState<F>({ tipo: "ligeiro", proprietario: "Escola Radical", estado: "ativo" });
  const [b, setB] = useState<B>({ ensino: true, iucAplicavel: true });
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => {
    const v = origem.dados as Record<string, unknown> | null;
    if (!v) return;
    const nf: F = {}; const nb: B = {};
    for (const k of [...textos, ...numeros]) nf[k] = v[k] == null ? "" : String(v[k]);
    for (const k of bools) nb[k] = Boolean(v[k]);
    if (modo === "duplicar") for (const k of ["matricula", "vin", "dataMatricula", "kmAtuais", "horasAtuais", "instrutorId", "dataAquisicao"]) nf[k] = "";
    if (modo === "duplicar") nf.estado = "ativo";
    setF(nf); setB(nb);
  }, [origem.dados, modo]);

  const set = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const nec = (k: string) => modo === "duplicar" && !f[k];
  const instrutores = (utilizadores.dados ?? []).filter((u) => u.perfil === "instrutor" && u.ativo);

  async function guardar(e: FormEvent) {
    e.preventDefault(); setAGuardar(true); setErro(null);
    const corpo: Record<string, unknown> = {};
    for (const k of textos) if (k !== "instrutorId") corpo[k] = k === "matricula" ? f[k]?.trim() : vazio(f[k] ?? "");
    corpo.instrutorId = f.instrutorId ? Number(f.instrutorId) : null;
    for (const k of numeros) corpo[k] = num(f[k] ?? "");
    for (const k of bools) corpo[k] = b[k] ?? false;
    try {
      const r = modo === "editar"
        ? await api<Veiculo>(`/veiculos/${id}`, { metodo: "PATCH", corpo: { ...corpo, versao: origem.dados?.versao } })
        : await api<Veiculo>("/veiculos", { metodo: "POST", corpo });
      location.hash = `#/veiculos/${r.id}`;
    } catch (x) { setErro((x as ErroApi).message); window.scrollTo({ top: 0, behavior: "smooth" }); } finally { setAGuardar(false); }
  }

  const C = (id: string, label: string, extra: Partial<React.ComponentProps<typeof Campo>> = {}) => <Campo id={id} label={label} valor={f[id] ?? ""} onChange={set(id)} necessario={nec(id)} {...extra} />;
  const I = (id: string, label: string) => <Interruptor id={id} label={label} valor={b[id] ?? false} onChange={(v) => setB((x) => ({ ...x, [id]: v }))} />;

  return (
    <Carregar erro={origem.erro} dados={modo === "novo" ? {} : origem.dados}>
      <form className="grid" onSubmit={guardar}>
        {modo === "duplicar" && <div className="note">A duplicar {origem.dados?.matricula}. Copiámos os dados técnicos e de gestão. Preencha o que é único em cada veículo (assinalado a vermelho).</div>}
        {erro && <div className="errbox" role="alert">{erro}</div>}
        <Secao titulo="Identificação"><div className="fields">
          {C("matricula", "Matrícula", { obrig: true })}
          {C("tipo", "Tipo", { opcoes: Object.entries(TIPOS), obrig: true })}
          {C("categoria", "Categoria de ensino", { lista: CATEGORIAS })}
          {C("proprietario", "Escola", { opcoes: ESCOLAS.map((e) => [e, e]) })}
          {C("marca", "Marca")}{C("modelo", "Modelo")}{C("cor", "Cor")}
          {C("vin", "N.º de quadro (VIN)")}
          {C("combustivel", "Combustível", { lista: COMBUSTIVEIS })}
          {C("dataMatricula", "Data da matrícula", { tipo: "date" })}
        </div></Secao>
        <Secao titulo="Características técnicas"><div className="fields">
          {C("pesoBruto", "Peso bruto (kg)", { tipo: "number" })}{C("tara", "Tara (kg)", { tipo: "number" })}{C("lugares", "Lugares", { tipo: "number" })}
          {C("cilindrada", "Cilindrada (cc)", { tipo: "number" })}{C("potenciaKw", "Potência (kW)", { tipo: "number" })}{C("pneus", "Pneus")}
        </div>{I("comandoDuplo", "Comando duplo")}{I("tacografo", "Tacógrafo")}{I("ensino", "Veículo de ensino")}</Secao>
        <Secao titulo="Contadores e regras"><div className="fields">
          {C("kmAtuais", "Quilómetros atuais", { tipo: "number", passo: "1" })}{C("horasAtuais", "Horas de funcionamento", { tipo: "number" })}
          {C("ipoPeriodicidadeMeses", "Periodicidade da IPO (meses)", { tipo: "number", passo: "1", ajuda: "Calcula a próxima IPO ao registar uma inspeção." })}
        </div>{I("usaHoras", "Medir por horas em vez de quilómetros")}{I("iucAplicavel", "IUC aplicável")}{I("seguroCobertoPeloTrator", "Seguro coberto pelo pesado (reboques)")}</Secao>
        <Secao titulo="Gestão"><div className="fields">
          {C("instrutorId", "Instrutor habitual", { opcoes: instrutores.map((u) => [String(u.id), u.nome]) })}
          {C("localizacao", "Localização")}{C("cartaoCombustivel", "Cartão de combustível")}
          {C("valorAquisicao", "Valor de aquisição (€)", { tipo: "number" })}{C("fornecedor", "Fornecedor")}{C("dataAquisicao", "Data de aquisição", { tipo: "date" })}
          {C("estado", "Estado", { opcoes: [["ativo", "Ativo"], ["oficina", "Em oficina"], ["imobilizado", "Imobilizado"]] })}
          {C("notas", "Notas", { area: true, largo: true })}
        </div></Secao>
        <div className="stickybar"><a className="btn" href={modo === "editar" ? `#/veiculos/${id}` : "#/veiculos"}>Cancelar</a><button className="btn primary" disabled={aGuardar}>{aGuardar ? "A guardar…" : "Guardar"}</button></div>
      </form>
    </Carregar>
  );
}
