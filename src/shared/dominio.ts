// Constantes partilhadas entre API e frontend.
export const PERFIS = ["admin", "gestor", "instrutor", "consulta"] as const;
export type Perfil = (typeof PERFIS)[number];

export const TIPOS_VEICULO = ["mota", "ligeiro", "pesado", "reboque", "trator_maquina"] as const;
export type TipoVeiculo = (typeof TIPOS_VEICULO)[number];

export const ESTADOS_VEICULO = ["ativo", "oficina", "imobilizado", "abatido"] as const;
export type EstadoVeiculo = (typeof ESTADOS_VEICULO)[number];

export const ESTADOS_AVARIA = ["reportada", "em_analise", "em_reparacao", "resolvida"] as const;

export const TIPOS_DOCUMENTO = [
  "dua", "apolice", "recibo_seguro", "iuc", "ipo", "fatura", "foto", "alvara", "outro",
] as const;

/** Limiares de aviso, em dias antes do prazo. */
export const LIMIARES_ALERTA = [60, 30, 15, 7] as const;

/**
 * Combinacoes trator+reboque permitidas (categoria do pesado -> categoria do reboque).
 * Configuravel: D+E nao e lecionada. A validar com a direcao.
 */
export const COMBINACOES_CONJUNTO: ReadonlyArray<{ trator: string; reboque: string }> = [
  { trator: "C", reboque: "CE" },
  { trator: "B", reboque: "BE" },
];
