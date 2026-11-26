import type { Eu, Veiculo } from "../api";
import { Carregar, ChipEstado, Foto, Matricula, useApi } from "../ui";

/** Inicio do instrutor: o seu veiculo. (Abastecimento, avaria e verificacao diaria chegam a seguir.) */
export function Inicio({ eu }: { eu: Eu }) {
  const { dados, erro } = useApi<Veiculo[]>("/veiculos");
  return (
    <Carregar erro={erro} dados={dados}>
      {dados?.length === 0 && <div className="card"><h3>Olá, {eu.nome.split(" ")[0]}</h3><p className="muted" style={{ margin: 0 }}>Ainda não tem um veículo atribuído. Fale com o responsável de frota.</p></div>}
      {dados?.map((v) => (
        <a key={v.id} href={`#/veiculos/${v.id}`} className="vcard" style={{ maxWidth: 520 }}>
          <Foto tipo={v.tipo} />
          <div className="vbody"><div className="vmeta"><Matricula m={v.matricula} /><ChipEstado e={v.estado} /></div><b>{[v.marca, v.modelo].filter(Boolean).join(" ")}</b>
            <span className="muted">{v.usaHoras ? `${v.horasAtuais ?? "—"} h` : `${v.kmAtuais?.toLocaleString("pt-PT") ?? "—"} km`} · {v.combustivel ?? "—"}</span></div>
        </a>))}
    </Carregar>
  );
}
