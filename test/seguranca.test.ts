import { describe, expect, it } from "vitest";
import { veiculoParaPerfil } from "../src/worker/lib/dto";
import { criarHash, gerarSenhaTemporaria, sugerirUsername, validarSenha, verificarSenha } from "../src/worker/lib/senha";
import { calcularBloqueio } from "../src/worker/lib/sessao";
import { hojeLisboa, pedidoPermitido } from "../src/worker/lib/seguranca";

describe("palavras-passe", () => {
  it("aceita a correta e recusa a errada", async () => {
    const h = await criarHash("cavalo-azul-lua-42", "segredo");
    expect(await verificarSenha("cavalo-azul-lua-42", h, "segredo")).toBe(true);
    expect(await verificarSenha("cavalo-azul-lua-43", h, "segredo")).toBe(false);
  });
  it("o segredo da aplicacao conta: outro segredo nao valida", async () => {
    const h = await criarHash("cavalo-azul-lua-42", "segredo");
    expect(await verificarSenha("cavalo-azul-lua-42", h, "outro")).toBe(false);
  });
  it("sem conta nunca valida (mas gasta o mesmo tempo)", async () => {
    expect(await verificarSenha("qualquer-coisa-123", null, "segredo")).toBe(false);
  });
  it("o mesmo texto da hashes diferentes (sal)", async () => {
    expect(await criarHash("cavalo-azul-lua-42", "s")).not.toBe(await criarHash("cavalo-azul-lua-42", "s"));
  });
  it("politica: tamanho, utilizador, escola e comuns", () => {
    expect(validarSenha("curta", "marta.silva")).toMatch(/10/);
    expect(validarSenha("xxmarta.silvaxx12", "marta.silva")).toMatch(/utilizador/);
    expect(validarSenha("escolaradical99", "marta.silva")).toMatch(/escola/);
    expect(validarSenha("1234567890", "x")).toMatch(/comum/);
    expect(validarSenha("aaaaaaaaaaaa", "x")).toMatch(/previsivel/);
    expect(validarSenha("cavalo-azul-lua-42", "marta.silva")).toBeNull();
  });
  it("temporaria: formato XXXX-XXXX-XXXX sem caracteres ambiguos e diferente de cada vez", () => {
    const a = gerarSenhaTemporaria(), b = gerarSenhaTemporaria();
    expect(a).toMatch(/^[A-HJKMNP-Za-hjkmnp-z2-9]{4}-[A-HJKMNP-Za-hjkmnp-z2-9]{4}-[A-HJKMNP-Za-hjkmnp-z2-9]{4}$/);
    expect(a).not.toBe(b);
  });
  it("sugere o utilizador a partir de primeiro e ultimo nome", () => {
    expect(sugerirUsername("Marta Silva")).toBe("marta.silva");
    expect(sugerirUsername("João Pedro da Conceição")).toBe("joao.conceicao");
    expect(sugerirUsername("Tiago")).toBe("tiago");
  });
});

describe("bloqueio por tentativas", () => {
  const agora = Date.parse("2026-11-26T12:00:00Z");
  it("4 falhas ainda nao bloqueiam", () => expect(calcularBloqueio(4, "2026-11-26T11:59:00Z", agora).bloqueado).toBe(false));
  it("5 falhas bloqueiam 15 min a contar da ultima", () => {
    const b = calcularBloqueio(5, "2026-11-26T11:55:00Z", agora);
    expect(b.bloqueado).toBe(true); expect(b.segundos).toBe(600);
  });
  it("passados 15 min desbloqueia", () => expect(calcularBloqueio(5, "2026-11-26T11:40:00Z", agora).bloqueado).toBe(false));
  it("10 falhas bloqueiam 60 min", () => expect(calcularBloqueio(10, "2026-11-26T11:30:00Z", agora).bloqueado).toBe(true));
});

describe("pedidos de outros sites (CSRF)", () => {
  it("leituras passam sempre", () => expect(pedidoPermitido("GET", "frotaradical.pt", null, null)).toBe(true));
  it("alteracao sem o cabecalho da app e recusada", () => expect(pedidoPermitido("POST", "frotaradical.pt", null, null)).toBe(false));
  it("alteracao com cabecalho e Origin certa passa", () => expect(pedidoPermitido("POST", "frotaradical.pt", "https://frotaradical.pt", "frota")).toBe(true));
  it("Origin de outro site e recusada mesmo com o cabecalho", () => expect(pedidoPermitido("POST", "frotaradical.pt", "https://mau.example", "frota")).toBe(false));
});

describe("campos por perfil", () => {
  const linha = { id: 1, matricula: "AA-00-AA", tipo: "ligeiro", valorAquisicao: 18900, fornecedor: "X", cartaoCombustivel: "4471", notas: "interno", fotoKey: "fotos/1/a.jpg", fotoAtualizadaEm: "2026-11-26" };
  it("o instrutor nao recebe dados financeiros nem a chave interna da foto", () => {
    const v = veiculoParaPerfil(linha, "instrutor");
    expect(v).not.toHaveProperty("valorAquisicao"); expect(v).not.toHaveProperty("fornecedor");
    expect(v).not.toHaveProperty("cartaoCombustivel"); expect(v).not.toHaveProperty("notas"); expect(v).not.toHaveProperty("fotoKey");
    expect(v.temFoto).toBe(true);
  });
  it("a gestao recebe-os", () => {
    const v = veiculoParaPerfil(linha, "gestor");
    expect(v.valorAquisicao).toBe(18900); expect(v.cartaoCombustivel).toBe("4471");
  });
});

describe("data de Lisboa", () => {
  it("meia-noite e meia em Lisboa no verao ja e o dia seguinte (UTC ainda e o anterior)", () => {
    expect(hojeLisboa(new Date("2026-07-14T23:30:00Z"))).toBe("2026-07-15");
  });
});
