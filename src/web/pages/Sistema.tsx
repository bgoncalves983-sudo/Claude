import { useState } from "react";
import { api, ErroApi } from "../api";
import { Carregar, fdata, useApi } from "../ui";

interface Copia { nome: string; tamanho: number; data: string }

interface EstadoSistema { email: { configurado: boolean; de: string; destinatarios: number }; push: { configurado: boolean } }

function Ligacoes() {
  const { dados } = useApi<EstadoSistema>("/sistema/estado");
  const [r, setR] = useState<{ ok: boolean; detalhe: string } | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  async function testar() {
    setAEnviar(true); setR(null);
    try { setR(await api<{ ok: boolean; detalhe: string }>("/sistema/email-teste", { metodo: "POST" })); }
    catch (e) { const x = e as ErroApi; setR({ ok: false, detalhe: (x.dados?.detalhe as string) ?? x.message }); }
    finally { setAEnviar(false); }
  }
  if (!dados) return null;
  return (
    <div className="card"><h3>Emails e notificações</h3>
      <div className="rows">
        <div className="row"><div><b>Envio de emails</b><small>{dados.email.configurado ? `Remetente: ${dados.email.de} · ${dados.email.destinatarios} destinatário(s) na gestão` : "Ainda não configurado (falta a chave do Resend)."}</small></div><span className={`chip ${dados.email.configurado ? "ok" : "warn"}`}>{dados.email.configurado ? "Configurado" : "Por configurar"}</span></div>
        <div className="row"><div><b>Notificações no telemóvel/PC</b><small>Cada pessoa da gestão ativa-as no seu dispositivo, no Painel.</small></div><span className={`chip ${dados.push.configurado ? "ok" : "warn"}`}>{dados.push.configurado ? "Configuradas" : "Por configurar"}</span></div>
      </div>
      <div className="actions" style={{ marginTop: 12 }}><button className="btn" disabled={aEnviar} onClick={() => void testar()}>{aEnviar ? "A enviar…" : "Enviar email de teste para mim"}</button></div>
      {r && <div className={r.ok ? "note" : "errbox"} style={{ marginTop: 12 }} role="status">{r.detalhe}</div>}
    </div>
  );
}

export function Sistema() {
  const { dados, erro, recarregar } = useApi<Copia[]>("/backups");
  const [msg, setMsg] = useState<string | null>(null);
  const [aCriar, setACriar] = useState(false);
  return (
    <Carregar erro={erro} dados={dados}>
      <Ligacoes />
      <div className="card"><h3>Cópias de segurança<span className="sp">
        <button className="btn primary" disabled={aCriar} onClick={async () => { setACriar(true); setMsg(null); try { await api("/backups", { metodo: "POST" }); setMsg("Cópia criada."); recarregar(); } catch (e) { setMsg((e as ErroApi).message); } finally { setACriar(false); } }}>{aCriar ? "A criar…" : "Criar cópia agora"}</button></span></h3>
        {msg && <div className="note" style={{ marginBottom: 12 }} role="status">{msg}</div>}
        <p className="muted" style={{ marginTop: 0 }}>Todas as segundas-feiras a aplicação guarda uma cópia automática (as últimas 12). Não incluem palavras-passe. Descarregue uma cópia para a guardar fora da Cloudflare.</p>
        <div className="rows">{dados?.length === 0 && <span className="muted">Ainda não há cópias. A primeira é criada na próxima segunda-feira, ou agora com o botão acima.</span>}
          {dados?.map((c) => (
            <div className="row" key={c.nome}><div><b>{c.nome}</b><small>{fdata(c.data)} · {(c.tamanho / 1024).toFixed(0)} KB</small></div><a className="btn" href={`/api/backups/${encodeURIComponent(c.nome)}`} download>Descarregar</a></div>))}</div>
      </div>
    </Carregar>
  );
}
