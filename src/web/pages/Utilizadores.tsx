import { useState, type FormEvent } from "react";
import { api, ErroApi, type Eu, type UtilizadorLinha } from "../api";
import { Carregar, fdata, Icon, useApi } from "../ui";

const PERFIL: Record<string, string> = { admin: "Administrador", gestor: "Gestor", consulta: "Consulta", instrutor: "Instrutor" };
const iniciais = (n: string) => n.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

/** Mostra a palavra-passe temporaria uma unica vez. */
function Segredo({ utilizador, senha, expira, fechar }: { utilizador: string | null; senha: string; expira: string; fechar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="card" role="status">
      <h3><Icon n="shield" s={18} />Palavra-passe temporária</h3>
      <div className="calc">
        {utilizador && <div><span>Utilizador</span><b>{utilizador}</b></div>}
        <div><span>Palavra-passe</span><b className="secret">{senha}</b></div>
        <div><span>Válida até</span><b>{fdata(expira)}</b></div>
      </div>
      <div className="warnbox" style={{ margin: "12px 0" }}>Só é mostrada agora, uma vez. Ao entrar pela primeira vez, a pessoa tem de escolher a dela.</div>
      <div className="actions">
        <button className="btn" onClick={async () => { await navigator.clipboard?.writeText(`${utilizador ?? ""}\n${senha}`).catch(() => {}); setCopiado(true); }}><Icon n="copy" s={16} />{copiado ? "Copiado" : "Copiar"}</button>
        <button className="btn primary" onClick={fechar}>Já guardei</button>
      </div>
    </div>
  );
}

export function Utilizadores({ eu }: { eu: Eu }) {
  const { dados, erro, recarregar } = useApi<UtilizadorLinha[]>("/utilizadores");
  const [segredo, setSegredo] = useState<{ utilizador: string | null; senha: string; expira: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [aCriar, setACriar] = useState(false);
  const [nome, setNome] = useState(""); const [escola, setEscola] = useState("Escola Radical");
  const [carta, setCarta] = useState(""); const [licenca, setLicenca] = useState("");
  const [gNome, setGNome] = useState(""); const [gEmail, setGEmail] = useState(""); const [gPerfil, setGPerfil] = useState("gestor");

  async function acao(fn: () => Promise<void>, ok: string) {
    setMsg(null);
    try { await fn(); setMsg(ok); recarregar(); } catch (e) { setMsg((e as ErroApi).message); }
  }
  async function criarInstrutor(e: FormEvent) {
    e.preventDefault();
    await acao(async () => {
      const r = await api<{ username: string; senhaTemporaria: string; senhaTemporariaExpira: string }>("/utilizadores", { metodo: "POST", corpo: { nome, perfil: "instrutor", escola, cartaValidade: carta || null, licencaInstrutorValidade: licenca || null } });
      setSegredo({ utilizador: r.username, senha: r.senhaTemporaria, expira: r.senhaTemporariaExpira });
      setNome(""); setCarta(""); setLicenca(""); setACriar(false);
    }, "Instrutor criado.");
  }
  async function criarGestao(e: FormEvent) {
    e.preventDefault();
    await acao(async () => { await api("/utilizadores", { metodo: "POST", corpo: { nome: gNome, perfil: gPerfil, email: gEmail } }); setGNome(""); setGEmail(""); }, "Utilizador criado. Entra com o código enviado para o email.");
  }

  const inst = (dados ?? []).filter((u) => u.metodo === "senha");
  const gest = (dados ?? []).filter((u) => u.metodo === "access");
  return (
    <Carregar erro={erro} dados={dados}>
      {msg && <div className="note" role="status">{msg}</div>}
      {segredo && <Segredo utilizador={segredo.utilizador} senha={segredo.senha} expira={segredo.expira} fechar={() => setSegredo(null)} />}

      <div className="card"><h3><Icon n="users" s={18} />Instrutores<span className="sp"><button className="btn primary" onClick={() => setACriar((x) => !x)}><Icon n="plus" s={16} />Criar instrutor</button></span></h3>
        {aCriar && <form className="form" onSubmit={criarInstrutor} style={{ marginBottom: 16 }}>
          <div className="fields">
            <label className="f" htmlFor="in">Nome<input id="in" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} /></label>
            <label className="f" htmlFor="ie">Escola<select id="ie" value={escola} onChange={(e) => setEscola(e.target.value)}><option>Escola Radical</option><option>Escola Patria</option></select></label>
            <label className="f" htmlFor="ic">Validade da carta<input id="ic" type="date" value={carta} onChange={(e) => setCarta(e.target.value)} /></label>
            <label className="f" htmlFor="il">Validade da licença de instrutor<input id="il" type="date" value={licenca} onChange={(e) => setLicenca(e.target.value)} /></label>
          </div>
          <div className="note">O utilizador é gerado a partir do nome (por exemplo <b>marta.silva</b>). Não precisa de email.</div>
          <button className="btn primary big">Criar e gerar palavra-passe</button>
        </form>}
        <div className="rows">{inst.length === 0 && <span className="muted">Ainda não há instrutores.</span>}
          {inst.map((u) => (
            <div className="row" key={u.id} style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}>
              <span className="avatar">{iniciais(u.nome)}</span>
              <div><b>{u.nome}</b><small>{u.username} · {u.escola ?? "—"} · último acesso {u.ultimoAcesso ? fdata(u.ultimoAcesso) : "nunca"}</small>
                <div className="actions" style={{ marginTop: 8 }}>
                  <button className="btn" onClick={() => acao(async () => { const r = await api<{ senhaTemporaria: string; senhaTemporariaExpira: string }>(`/utilizadores/${u.id}/repor-senha`, { metodo: "POST" }); setSegredo({ utilizador: u.username, senha: r.senhaTemporaria, expira: r.senhaTemporariaExpira }); }, "Palavra-passe reposta.")}>Repor palavra-passe</button>
                  <button className="btn" onClick={() => acao(() => api(`/utilizadores/${u.id}/terminar-sessoes`, { metodo: "POST" }), "Sessões terminadas.")}>Terminar sessões</button>
                  <button className="btn ghost" onClick={() => acao(() => api(`/utilizadores/${u.id}`, { metodo: "PATCH", corpo: { ativo: !u.ativo } }), u.ativo ? "Conta desativada." : "Conta reativada.")}>{u.ativo ? "Desativar" : "Reativar"}</button>
                </div></div>
              <span className={`chip ${!u.ativo ? "" : u.bloqueado ? "crit" : u.deveMudarSenha ? "warn" : "ok"}`}>{!u.ativo ? "Desativado" : u.bloqueado ? "Bloqueado" : u.deveMudarSenha ? "Aguarda primeiro acesso" : "Ativo"}</span>
            </div>))}
        </div>
        <p className="muted" style={{ margin: "12px 0 0" }}>Só o responsável de frota repõe palavras-passe. Tudo fica registado na auditoria.</p>
      </div>

      <div className="card"><h3><Icon n="users" s={18} />Gestão</h3>
        <div className="rows">{gest.map((u) => (
          <div className="row" key={u.id} style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}>
            <span className="avatar">{iniciais(u.nome)}</span><div><b>{u.nome}</b><small>{u.email} · código por email</small></div><span className="chip">{PERFIL[u.perfil]}</span>
          </div>))}</div>
        {eu.perfil === "admin" && <form className="form" onSubmit={criarGestao} style={{ marginTop: 16 }}>
          <div className="fields">
            <label className="f" htmlFor="gn">Nome<input id="gn" value={gNome} onChange={(e) => setGNome(e.target.value)} required minLength={2} /></label>
            <label className="f" htmlFor="ge">Email<input id="ge" type="email" value={gEmail} onChange={(e) => setGEmail(e.target.value)} required /></label>
            <label className="f" htmlFor="gp">Perfil<select id="gp" value={gPerfil} onChange={(e) => setGPerfil(e.target.value)}><option value="gestor">Gestor</option><option value="consulta">Consulta</option><option value="admin">Administrador</option></select></label>
          </div>
          <button className="btn">Acrescentar à gestão</button>
        </form>}
      </div>
    </Carregar>
  );
}
