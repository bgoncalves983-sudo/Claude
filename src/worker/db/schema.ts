import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Datas guardadas como texto ISO (AAAA-MM-DD); timestamps como AAAA-MM-DDTHH:MM:SSZ.
const agora = sql`(strftime('%Y-%m-%dT%H:%M:%SZ','now'))`;

export const utilizador = sqliteTable("utilizador", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  nome: text("nome").notNull(),
  perfil: text("perfil", { enum: ["admin", "gestor", "instrutor", "consulta"] }).notNull(),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  cartaValidade: text("carta_validade"),
  licencaInstrutorValidade: text("licenca_instrutor_validade"),
  criadoEm: text("criado_em").notNull().default(agora),
});

export const veiculo = sqliteTable(
  "veiculo",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    matricula: text("matricula").notNull().unique(),
    tipo: text("tipo", { enum: ["mota", "ligeiro", "pesado", "reboque", "trator_maquina"] }).notNull(),
    // Categoria de ensino (AM, A1, A2, A, B, BE, C, CE, D, ...). Lista exata a validar.
    categoria: text("categoria"),
    marca: text("marca"),
    modelo: text("modelo"),
    vin: text("vin"),
    combustivel: text("combustivel"),
    dataMatricula: text("data_matricula"),
    dataAquisicao: text("data_aquisicao"),
    estado: text("estado", { enum: ["ativo", "oficina", "imobilizado", "abatido"] })
      .notNull()
      .default("ativo"),
    // Ensino
    ensino: integer("ensino", { mode: "boolean" }).notNull().default(true),
    comandoDuplo: integer("comando_duplo", { mode: "boolean" }).notNull().default(false),
    // Caracteristicas por tipo
    pesoBruto: integer("peso_bruto"),
    lugares: integer("lugares"),
    cilindrada: integer("cilindrada"),
    // Contadores
    usaHoras: integer("usa_horas", { mode: "boolean" }).notNull().default(false),
    kmAtuais: integer("km_atuais"),
    horasAtuais: real("horas_atuais"),
    // Regras configuraveis por veiculo
    iucAplicavel: integer("iuc_aplicavel", { mode: "boolean" }).notNull().default(true),
    ipoPeriodicidadeMeses: integer("ipo_periodicidade_meses"),
    seguroCobertoPeloTrator: integer("seguro_coberto_pelo_trator", { mode: "boolean" })
      .notNull()
      .default(false),
    instrutorId: integer("instrutor_id").references(() => utilizador.id),
    notas: text("notas"),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [index("veiculo_tipo_idx").on(t.tipo), index("veiculo_instrutor_idx").on(t.instrutorId)],
);

// Reboque associado a um trator por periodo (data_fim nulo = associacao ativa).
export const associacaoConjunto = sqliteTable(
  "associacao_conjunto",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tratorId: integer("trator_id").notNull().references(() => veiculo.id),
    reboqueId: integer("reboque_id").notNull().references(() => veiculo.id),
    dataInicio: text("data_inicio").notNull(),
    dataFim: text("data_fim"),
    motivo: text("motivo"),
    criadoPor: integer("criado_por").references(() => utilizador.id),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [
    // No maximo uma associacao ativa por reboque e por trator.
    uniqueIndex("conjunto_reboque_ativo").on(t.reboqueId).where(sql`${t.dataFim} IS NULL`),
    uniqueIndex("conjunto_trator_ativo").on(t.tratorId).where(sql`${t.dataFim} IS NULL`),
  ],
);

export const seguro = sqliteTable(
  "seguro",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    veiculoId: integer("veiculo_id").notNull().references(() => veiculo.id),
    seguradora: text("seguradora").notNull(),
    apolice: text("apolice").notNull(),
    cobertura: text("cobertura"),
    premio: real("premio"),
    periodicidade: text("periodicidade"),
    dataInicio: text("data_inicio").notNull(),
    dataFim: text("data_fim").notNull(),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [index("seguro_veiculo_idx").on(t.veiculoId)],
);

export const iuc = sqliteTable(
  "iuc",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    veiculoId: integer("veiculo_id").notNull().references(() => veiculo.id),
    ano: integer("ano").notNull(),
    valor: real("valor"),
    dataLimite: text("data_limite").notNull(),
    pago: integer("pago", { mode: "boolean" }).notNull().default(false),
    dataPagamento: text("data_pagamento"),
  },
  (t) => [uniqueIndex("iuc_veiculo_ano").on(t.veiculoId, t.ano)],
);

export const inspecao = sqliteTable(
  "inspecao",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    veiculoId: integer("veiculo_id").notNull().references(() => veiculo.id),
    data: text("data").notNull(),
    resultado: text("resultado", { enum: ["aprovado", "reprovado", "condicionado"] }).notNull(),
    km: integer("km"),
    centro: text("centro"),
    custo: real("custo"),
    proximaData: text("proxima_data"),
  },
  (t) => [index("inspecao_veiculo_idx").on(t.veiculoId)],
);

export const avaria = sqliteTable(
  "avaria",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    veiculoId: integer("veiculo_id").notNull().references(() => veiculo.id),
    reportadoPor: integer("reportado_por").references(() => utilizador.id),
    descricao: text("descricao").notNull(),
    estado: text("estado", { enum: ["reportada", "em_analise", "em_reparacao", "resolvida"] })
      .notNull()
      .default("reportada"),
    dataReporte: text("data_reporte").notNull().default(agora),
    dataResolucao: text("data_resolucao"),
  },
  (t) => [index("avaria_veiculo_idx").on(t.veiculoId), index("avaria_estado_idx").on(t.estado)],
);

export const manutencao = sqliteTable(
  "manutencao",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    veiculoId: integer("veiculo_id").notNull().references(() => veiculo.id),
    avariaId: integer("avaria_id").references(() => avaria.id),
    tipo: text("tipo", { enum: ["preventiva", "corretiva"] }).notNull(),
    data: text("data").notNull(),
    km: integer("km"),
    horas: real("horas"),
    oficina: text("oficina"),
    descricao: text("descricao"),
    custo: real("custo"),
    // Proxima revisao preventiva (por data e/ou por km/horas).
    proximaData: text("proxima_data"),
    proximoKm: integer("proximo_km"),
    proximasHoras: real("proximas_horas"),
  },
  (t) => [index("manutencao_veiculo_idx").on(t.veiculoId)],
);

export const abastecimento = sqliteTable(
  "abastecimento",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    veiculoId: integer("veiculo_id").notNull().references(() => veiculo.id),
    utilizadorId: integer("utilizador_id").references(() => utilizador.id),
    data: text("data").notNull(),
    litros: real("litros").notNull(),
    valor: real("valor").notNull(),
    km: integer("km"),
    posto: text("posto"),
  },
  (t) => [index("abastecimento_veiculo_idx").on(t.veiculoId)],
);

export const documento = sqliteTable(
  "documento",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Documento de um veiculo, ou da escola (veiculo_id nulo: alvara, etc.).
    veiculoId: integer("veiculo_id").references(() => veiculo.id),
    // Ligacao opcional a um registo (seguro, inspecao, manutencao, ...).
    entidade: text("entidade"),
    entidadeId: integer("entidade_id"),
    tipo: text("tipo").notNull(),
    nomeFicheiro: text("nome_ficheiro").notNull(),
    r2Key: text("r2_key").notNull().unique(),
    contentType: text("content_type").notNull(),
    tamanho: integer("tamanho").notNull(),
    validade: text("validade"),
    versao: integer("versao").notNull().default(1),
    carregadoPor: integer("carregado_por").references(() => utilizador.id),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [index("documento_veiculo_idx").on(t.veiculoId)],
);

// Evita reenviar o mesmo aviso (chave = tipo:entidade:id:data:limiar).
export const alertaLog = sqliteTable("alerta_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chave: text("chave").notNull().unique(),
  enviadoEm: text("enviado_em").notNull().default(agora),
});

export const auditoria = sqliteTable(
  "auditoria",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    utilizadorId: integer("utilizador_id").references(() => utilizador.id),
    acao: text("acao").notNull(),
    entidade: text("entidade").notNull(),
    entidadeId: integer("entidade_id"),
    detalhe: text("detalhe"),
    criadoEm: text("criado_em").notNull().default(agora),
  },
  (t) => [index("auditoria_entidade_idx").on(t.entidade, t.entidadeId)],
);
