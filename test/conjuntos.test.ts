import { describe, expect, it } from "vitest";
import { validarAssociacao, type VeiculoConjunto } from "../src/worker/lib/conjuntos";

const v = (o: Partial<VeiculoConjunto>): VeiculoConjunto => ({
  id: 1, matricula: "AA-00-AA", tipo: "pesado", categoria: "C", estado: "ativo", ...o,
});
const pesado = v({ id: 1, matricula: "11-AA-11" });
const reboque = v({ id: 2, matricula: "22-BB-22", tipo: "reboque", categoria: "CE" });

describe("validarAssociacao", () => {
  it("aceita C + CE", () => expect(validarAssociacao(pesado, reboque, [])).toEqual({ ok: true }));
  it("recusa D + DE (nao lecionada)", () => {
    const r = validarAssociacao(v({ categoria: "D" }), v({ id: 2, tipo: "reboque", categoria: "DE" }), []);
    expect(r.ok).toBe(false);
  });
  it("recusa reboque ja associado", () => {
    const r = validarAssociacao(v({ id: 3 }), reboque, [{ tratorId: 1, reboqueId: 2 }]);
    expect(r.ok).toBe(false);
  });
  it("recusa trator que ja tem reboque", () => {
    const r = validarAssociacao(pesado, v({ id: 4, tipo: "reboque", categoria: "CE" }), [{ tratorId: 1, reboqueId: 2 }]);
    expect(r.ok).toBe(false);
  });
  it("recusa quem nao e reboque, abatidos e sem categoria", () => {
    expect(validarAssociacao(pesado, v({ id: 5 }), []).ok).toBe(false);
    expect(validarAssociacao(pesado, { ...reboque, estado: "abatido" }, []).ok).toBe(false);
    expect(validarAssociacao(pesado, { ...reboque, categoria: null }, []).ok).toBe(false);
  });
});
