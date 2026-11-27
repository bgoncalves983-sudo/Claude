import { afterEach, describe, expect, it, vi } from "vitest";
import { emailConfigurado, enviarTeste } from "../src/worker/lib/notificar";

const env = (x: object) => ({ ALERT_FROM: "Frota Radical <alertas@frotaradical.pt>", ...x }) as never;

describe("envio de emails (Resend)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sem chave: diz que falta configurar e nao tenta enviar", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(emailConfigurado(env({}))).toBe(false);
    const r = await enviarTeste(env({}), "it@eradical.pt");
    expect(r.ok).toBe(false);
    expect(r.detalhe).toMatch(/RESEND_API_KEY/);
    expect(f).not.toHaveBeenCalled();
  });

  it("com chave: envia para o destinatario, com o remetente e a chave certos", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "abc" }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const r = await enviarTeste(env({ RESEND_API_KEY: "re_teste" }), "it@eradical.pt");
    expect(r).toEqual({ ok: true, detalhe: "Email enviado para it@eradical.pt." });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.authorization).toBe("Bearer re_teste");
    const corpo = JSON.parse(init.body);
    expect(corpo.from).toBe("Frota Radical <alertas@frotaradical.pt>");
    expect(corpo.to).toEqual(["it@eradical.pt"]);
  });

  it("dominio por verificar: devolve o motivo do Resend para o administrador perceber", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "The frotaradical.pt domain is not verified." }), { status: 403 })));
    const r = await enviarTeste(env({ RESEND_API_KEY: "re_teste" }), "it@eradical.pt");
    expect(r.ok).toBe(false);
    expect(r.detalhe).toMatch(/403/);
    expect(r.detalhe).toMatch(/not verified/);
  });

  it("falha de rede: nao rebenta, explica", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const r = await enviarTeste(env({ RESEND_API_KEY: "re_teste" }), "it@eradical.pt");
    expect(r.ok).toBe(false);
    expect(r.detalhe).toMatch(/Não foi possível contactar/);
  });
});
