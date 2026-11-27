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
  if (trator.id === reboque.id) return { ok: false, erro: "Um veículo não pode ser associado a si próprio." };
  if (reboque.tipo !== "reboque") return { ok: false, erro: `${reboque.matricula} não é um reboque.` };
  if (!["pesado", "ligeiro", "trator_maquina"].includes(trator.tipo))
    return { ok: false, erro: `${trator.matricula} não pode puxar reboque.` };
  if (trator.estado === "abatido" || reboque.estado === "abatido")
    return { ok: false, erro: "Veículos abatidos não podem ser associados." };

  const reboqueOcupado = ativas.find((a) => a.reboqueId === reboque.id);
  if (reboqueOcupado)
    return { ok: false, erro: `${reboque.matricula} já está associado a outro veículo. Termine essa associação primeiro.` };
  const tratorOcupado = ativas.find((a) => a.tratorId === trator.id);
  if (tratorOcupado)
    return { ok: false, erro: `${trator.matricula} já tem um reboque associado. Termine essa associação primeiro.` };

  if (!trator.categoria || !reboque.categoria)
    return { ok: false, erro: "Defina a categoria do trator e do reboque antes de os associar." };
  const compativel = combinacoes.some((c) => c.trator === trator.categoria && c.reboque === reboque.categoria);
  if (!compativel)
    return { ok: false, erro: `Combinação não permitida: ${trator.categoria} + ${reboque.categoria}.` };
  return { ok: true };
}
