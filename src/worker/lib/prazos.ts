import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { documento, inspecao, iuc, multa, seguro, utilizador, veiculo } from "../db/schema";
import { calcularAlertas, type Alerta, type ItemPrazo } from "./alertas";

/** Reune todos os prazos em aberto e devolve os avisos devidos hoje. */
export async function avisosDoDia(d1: D1Database, hoje: string): Promise<Alerta[]> {
  const db = drizzle(d1);
  const ativos = await db
    .select({ id: veiculo.id, matricula: veiculo.matricula, cobertoPeloTrator: veiculo.seguroCobertoPeloTrator })
    .from(veiculo)
    .where(sql`${veiculo.estado} != 'abatido'`);
  const mat = new Map(ativos.map((v) => [v.id, v.matricula]));
  const coberto = new Set(ativos.filter((v) => v.cobertoPeloTrator).map((v) => v.id));
  const ids = [...mat.keys()];
  const itens: ItemPrazo[] = [];
  if (ids.length > 0) {
    // So o seguro mais recente de cada veiculo conta (os antigos ja caducaram por substituicao).
    const seguros = await db
      .select()
      .from(seguro)
      .where(and(inArray(seguro.veiculoId, ids), sql`${seguro.dataFim} = (SELECT MAX(s2.data_fim) FROM seguro s2 WHERE s2.veiculo_id = ${seguro.veiculoId})`));
    for (const s of seguros)
      if (!coberto.has(s.veiculoId))
        itens.push({ tipo: "seguro", entidadeId: s.id, veiculoId: s.veiculoId, rotulo: `Seguro ${mat.get(s.veiculoId)} (${s.seguradora})`, data: s.dataFim });

    for (const i of await db.select().from(iuc).where(and(inArray(iuc.veiculoId, ids), eq(iuc.pago, false))))
      itens.push({ tipo: "iuc", entidadeId: i.id, veiculoId: i.veiculoId, rotulo: `IUC ${i.ano} ${mat.get(i.veiculoId)}`, data: i.dataLimite });

    const ipos = await db
      .select()
      .from(inspecao)
      .where(and(inArray(inspecao.veiculoId, ids), sql`${inspecao.proximaData} IS NOT NULL`, sql`${inspecao.data} = (SELECT MAX(i2.data) FROM inspecao i2 WHERE i2.veiculo_id = ${inspecao.veiculoId})`));
    for (const i of ipos)
      itens.push({ tipo: "ipo", entidadeId: i.id, veiculoId: i.veiculoId, rotulo: `IPO ${mat.get(i.veiculoId)}`, data: i.proximaData! });
  }

  for (const m of await db.select().from(multa).where(and(eq(multa.estado, "por_pagar"), sql`${multa.limitePagamento} IS NOT NULL`)))
    itens.push({ tipo: "multa", entidadeId: m.id, veiculoId: m.veiculoId, rotulo: `Multa ${mat.get(m.veiculoId) ?? ""}${m.auto ? ` (auto ${m.auto})` : ""}`, data: m.limitePagamento! });

  for (const u of await db.select().from(utilizador).where(eq(utilizador.ativo, true))) {
    if (u.perfil !== "instrutor") continue;
    if (u.cartaValidade) itens.push({ tipo: "carta", entidadeId: u.id, rotulo: `Carta de conducao de ${u.nome}`, data: u.cartaValidade });
    if (u.licencaInstrutorValidade) itens.push({ tipo: "licenca_instrutor", entidadeId: u.id, rotulo: `Licenca de instrutor de ${u.nome}`, data: u.licencaInstrutorValidade });
  }

  // Documentos com validade propria (so a versao mais recente de cada tipo/veiculo).
  const docs = await db
    .select()
    .from(documento)
    .where(sql`${documento.validade} IS NOT NULL AND ${documento.versao} = (SELECT MAX(d2.versao) FROM documento d2 WHERE d2.tipo = ${documento.tipo} AND d2.veiculo_id IS ${documento.veiculoId})`);
  for (const d of docs)
    itens.push({ tipo: "documento", entidadeId: d.id, veiculoId: d.veiculoId, rotulo: `${d.tipo}: ${d.nomeFicheiro}${d.veiculoId ? ` (${mat.get(d.veiculoId) ?? ""})` : ""}`, data: d.validade! });

  return calcularAlertas(hoje, itens);
}
