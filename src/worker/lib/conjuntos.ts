import { COMBINACOES_CONJUNTO } from "../../shared/dominio";

export interface VeiculoConjunto {
  id: number;
  matricula: string;
  tipo: string;
  categoria: string | null;
  estado: string;
}

export interface AssociacaoAtiva {
  tratorId: number;
  reboqueId: number;
}

export type Resultado = { ok: true } | { ok: false; erro: string };

/** Regras para associar um reboque a um trator. */
export function validarAssociacao(
  trator: VeiculoConjunto,
  reboque: VeiculoConjunto,
  ativas: AssociacaoAtiva[],
  combinacoes: ReadonlyArray<{ trator: string; reboque: string }> = COMBINACOES_CONJUNTO,
): Resultado {
  if (trator.id === reboque.id) return { ok: false, erro: "Um veiculo nao pode ser associado a si proprio." };
  if (reboque.tipo !== "reboque") return { ok: false, erro: `${reboque.matricula} nao e um reboque.` };
  if (!["pesado", "ligeiro", "trator_maquina"].includes(trator.tipo))
    return { ok: false, erro: `${trator.matricula} nao pode puxar reboque.` };
  if (trator.estado === "abatido" || reboque.estado === "abatido")
    return { ok: false, erro: "Veiculos abatidos nao podem ser associados." };

  const reboqueOcupado = ativas.find((a) => a.reboqueId === reboque.id);
  if (reboqueOcupado)
    return { ok: false, erro: `${reboque.matricula} ja esta associado a outro veiculo. Termine essa associacao primeiro.` };
  const tratorOcupado = ativas.find((a) => a.tratorId === trator.id);
  if (tratorOcupado)
    return { ok: false, erro: `${trator.matricula} ja tem um reboque associado. Termine essa associacao primeiro.` };

  if (!trator.categoria || !reboque.categoria)
    return { ok: false, erro: "Defina a categoria do trator e do reboque antes de os associar." };
  const compativel = combinacoes.some((c) => c.trator === trator.categoria && c.reboque === reboque.categoria);
  if (!compativel)
    return { ok: false, erro: `Combinacao nao permitida: ${trator.categoria} + ${reboque.categoria}.` };
  return { ok: true };
}
