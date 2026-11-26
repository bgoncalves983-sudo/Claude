import { useState } from "react";
import type { Eu, Veiculo } from "../api";
import { Carregar, ChipEstado, eur, Foto, fdata, Matricula, TIPOS, useApi } from "../ui";

const sn = (b: boolean | null | undefined) => (b ? "Sim" : "Não");
const D = ({ k, v }: { k: string; v: React.ReactNode }) => <div><small>{k}</small><b>{v === null || v === undefined || v === "" ? "—" : v}</b></div>;

export function Ficha({ id, eu }: { id: string; eu: Eu }) {
  const { dados: v, erro } = useApi<Veiculo>(`/veiculos/${id}`);
  const [tab, setTab] = useState<"resumo" | "dados">("resumo");
  const gestao = eu.perfil !== "instrutor";
  return (
    <>
      <div><a href="#/veiculos" className="muted">← Veículos</a></div>
      <Carregar erro={erro} dados={v}>
        {v && <>
          <div className="hero">
            <Foto tipo={v.tipo} />
            <div className="info">
              <div className="vmeta"><span className="plate" style={{ fontSize: 16 }}>{v.matricula}</span><ChipEstado e={v.estado} />{v.proprietario && <span className="chip">{v.proprietario}</span>}</div>
              <h2>{[v.marca, v.modelo].filter(Boolean).join(" ") || v.matricula}</h2>
              <div className="facts">
                <D k="Tipo / categoria" v={`${TIPOS[v.tipo] ?? v.tipo}${v.categoria ? ` · ${v.categoria}` : ""}`} />
                <D k={v.usaHoras ? "Horas" : "Quilómetros"} v={v.usaHoras ? (v.horasAtuais != null ? `${v.horasAtuais.toLocaleString("pt-PT")} h` : null) : (v.kmAtuais != null ? `${v.kmAtuais.toLocaleString("pt-PT")} km` : null)} />
                <D k="Combustível" v={v.combustivel} /><D k="Cor" v={v.cor} />
              </div>
              {v.conjuntoAtivo && <div className="note">Faz conjunto com um reboque.</div>}
            </div>
          </div>
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "resumo"} onClick={() => setTab("resumo")}>Resumo</button>
            <button role="tab" aria-selected={tab === "dados"} onClick={() => setTab("dados")}>Dados</button>
          </div>
          {tab === "resumo" && <div className="card"><h3>Identificação</h3><div className="dl">
            <D k="Matrícula" v={v.matricula} /><D k="Data da matrícula" v={fdata(v.dataMatricula)} /><D k="N.º de quadro (VIN)" v={v.vin} /><D k="Localização" v={v.localizacao} />
          </div></div>}
          {tab === "dados" && <>
            <div className="card"><h3>Características técnicas</h3><div className="dl">
              <D k="Categoria de ensino" v={v.categoria} /><D k="Comando duplo" v={sn(v.comandoDuplo)} /><D k="Cilindrada" v={v.cilindrada && `${v.cilindrada} cc`} />
              <D k="Potência" v={v.potenciaKw && `${v.potenciaKw} kW`} /><D k="Peso bruto" v={v.pesoBruto && `${v.pesoBruto} kg`} /><D k="Tara" v={v.tara && `${v.tara} kg`} />
              <D k="Lugares" v={v.lugares} /><D k="Pneus" v={v.pneus} /><D k="Tacógrafo" v={sn(v.tacografo)} />
            </div></div>
            {gestao && <div className="card"><h3>Gestão</h3><div className="dl">
              <D k="Adquirido em" v={fdata(v.dataAquisicao)} /><D k="Fornecedor" v={v.fornecedor} /><D k="Valor de aquisição" v={v.valorAquisicao != null ? eur(v.valorAquisicao) : null} />
              <D k="Cartão de combustível" v={v.cartaoCombustivel} /><D k="IUC aplicável" v={sn(v.iucAplicavel)} /><D k="IPO (meses)" v={v.ipoPeriodicidadeMeses} />
              <D k="Notas" v={v.notas} />
            </div></div>}
          </>}
        </>}
      </Carregar>
    </>
  );
}
