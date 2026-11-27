import { LIMIARES_ALERTA } from "../../shared/dominio";

export type TipoAlerta = "seguro" | "iuc" | "ipo" | "carta" | "licenca_instrutor" | "documento" | "revisao" | "multa";

export interface ItemPrazo {
  tipo: TipoAlerta;
  entidadeId: number;
  veiculoId?: number | null;
  rotulo: string; // ex.: "Seguro 12-AB-34 (Fidelidade)"
  data: string; // AAAA-MM-DD, prazo
}

export interface Alerta extends ItemPrazo {
  dias: number; // negativo = ja caducado
  limiar: number; // 0 = caducado
  chave: string; // identifica o aviso para nao o repetir
}

const MS_DIA = 86_400_000;

export function diasAte(hoje: string, data: string): number {
  const a = Date.parse(`${hoje}T00:00:00Z`);
  const b = Date.parse(`${data}T00:00:00Z`);
  return Math.round((b - a) / MS_DIA);
}

/** Devolve os avisos devidos hoje: o limiar mais apertado que ja foi atingido. */
export function calcularAlertas(
  hoje: string,
  itens: ItemPrazo[],
  limiares: readonly number[] = LIMIARES_ALERTA,
): Alerta[] {
  const ordenados = [...limiares].sort((x, y) => x - y);
  const out: Alerta[] = [];
  for (const item of itens) {
    const dias = diasAte(hoje, item.data);
    let limiar: number | undefined;
    if (dias < 0) limiar = 0;
    else limiar = ordenados.find((l) => dias <= l);
    if (limiar === undefined) continue;
    // A data entra na chave: ao renovar (nova data) os avisos recomecam.
    out.push({ ...item, dias, limiar, chave: `${item.tipo}:${item.entidadeId}:${item.data}:${limiar}` });
  }
  return out.sort((x, y) => x.dias - y.dias);
}
