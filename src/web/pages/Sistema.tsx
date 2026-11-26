import { useState } from "react";
import { api, ErroApi } from "../api";
import { Carregar, fdata, useApi } from "../ui";

interface Copia { nome: string; tamanho: number; data: string }

export function Sistema() {
  const { dados, erro, recarregar } = useApi<Copia[]>("/backups");
  const [msg, setMsg] = useState<string | null>(null);
  const [aCriar, setACriar] = useState(false);
  return (
    <Carregar erro={erro} dados={dados}>
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
