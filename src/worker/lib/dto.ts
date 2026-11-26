import type { Perfil } from "../../shared/dominio";

// Campos que cada perfil pode ver. O servidor e que filtra: esconder no ecra nao e seguranca.
const BASE = [
  "id", "matricula", "tipo", "categoria", "marca", "modelo", "cor", "combustivel", "dataMatricula", "estado",
  "ensino", "comandoDuplo", "pesoBruto", "tara", "lugares", "cilindrada", "potenciaKw", "pneus", "tacografo",
  "usaHoras", "kmAtuais", "horasAtuais", "localizacao", "instrutorId", "proprietario", "vin",
] as const;
const GESTAO = [
  ...BASE, "dataAquisicao", "valorAquisicao", "fornecedor", "cartaoCombustivel", "iucAplicavel",
  "ipoPeriodicidadeMeses", "seguroCobertoPeloTrator", "dataAbate", "notas", "versao", "criadoEm",
] as const;

type Linha = Record<string, unknown> & { fotoKey?: string | null; fotoAtualizadaEm?: string | null };

export function veiculoParaPerfil(linha: Linha, perfil: Perfil) {
  const campos = perfil === "instrutor" ? BASE : GESTAO;
  const out: Record<string, unknown> = {};
  for (const c of campos) out[c] = linha[c] ?? null;
  // A chave interna do ficheiro nunca sai da API: o ecra so precisa de saber se ha foto e de que versao.
  out.temFoto = !!linha.fotoKey;
  out.fotoVersao = linha.fotoAtualizadaEm ?? null;
  return out;
}
