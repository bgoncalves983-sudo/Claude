import { useEffect, useState } from "react";
import { ativarPush, desativarPush, estadoPush, type EstadoPush } from "../lib/push";
import { Icon } from "../ui";

/** Cartao para a gestao receber avisos de avarias neste dispositivo, mesmo com a aplicacao fechada. */
export function Notificacoes() {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aTrabalhar, setATrabalhar] = useState(false);
  useEffect(() => { void estadoPush().then(setEstado); }, []);
  if (!estado || estado === "nao-suportado") return null;

  const correr = async (f: () => Promise<void>) => { setATrabalhar(true); setErro(null); try { await f(); } catch (e) { setErro((e as Error).message); } finally { setEstado(await estadoPush()); setATrabalhar(false); } };

  if (estado === "ativo") return <div className="note" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><span style={{ flex: 1 }}><Icon n="check" s={14} /> Notificações de avarias ativas neste dispositivo.</span><button className="btn ghost" style={{ minHeight: 36 }} disabled={aTrabalhar} onClick={() => void correr(desativarPush)}>Desativar</button></div>;
  if (estado === "bloqueado") return <div className="warnbox">As notificações estão bloqueadas neste browser. Para as receber, permita-as nas definições do site (cadeado junto ao endereço).</div>;
  return (
    <div className="card" style={{ display: "grid", gap: 10 }}>
      <b>Seja avisado logo que há uma avaria</b>
      <span className="muted">Receba uma notificação neste dispositivo, mesmo com a aplicação fechada. No iPhone, instale primeiro a aplicação no ecrã inicial.</span>
      {erro && <div className="errbox" role="alert">{erro}</div>}
      <div className="actions"><button className="btn primary" disabled={aTrabalhar} onClick={() => void correr(ativarPush)}>🔔 Ativar notificações</button></div>
    </div>
  );
}
