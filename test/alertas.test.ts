import { describe, expect, it } from "vitest";
import { calcularAlertas, diasAte } from "../src/worker/lib/alertas";

const base = { tipo: "seguro" as const, entidadeId: 1, rotulo: "Seguro" };

describe("calcularAlertas", () => {
  it("conta dias corretamente", () => {
    expect(diasAte("2026-11-26", "2026-12-26")).toBe(30);
    expect(diasAte("2026-11-26", "2026-11-25")).toBe(-1);
  });
  it("usa o limiar mais apertado atingido", () => {
    expect(calcularAlertas("2026-11-26", [{ ...base, data: "2026-12-16" }])[0].limiar).toBe(30); // 20 dias
    expect(calcularAlertas("2026-11-26", [{ ...base, data: "2026-12-03" }])[0].limiar).toBe(7); // 7 dias
    expect(calcularAlertas("2026-11-26", [{ ...base, data: "2026-11-26" }])[0].limiar).toBe(7); // hoje
  });
  it("ignora prazos distantes e marca os caducados", () => {
    expect(calcularAlertas("2026-11-26", [{ ...base, data: "2027-06-01" }])).toHaveLength(0);
    const a = calcularAlertas("2026-11-26", [{ ...base, data: "2026-11-20" }])[0];
    expect(a.limiar).toBe(0);
    expect(a.dias).toBe(-6);
  });
  it("a chave muda quando o prazo e renovado", () => {
    const antes = calcularAlertas("2026-11-26", [{ ...base, data: "2026-12-01" }])[0].chave;
    const depois = calcularAlertas("2027-11-26", [{ ...base, data: "2027-12-01" }])[0].chave;
    expect(antes).not.toBe(depois);
  });
  it("ordena do mais urgente", () => {
    const r = calcularAlertas("2026-11-26", [
      { ...base, entidadeId: 1, data: "2026-12-20" },
      { ...base, entidadeId: 2, data: "2026-11-30" },
    ]);
    expect(r.map((x) => x.entidadeId)).toEqual([2, 1]);
  });
});
