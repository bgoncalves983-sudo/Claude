import { useState, type FormEvent } from "react";
import { api, ErroApi } from "../api";
import { Logo } from "../ui";

/** Entrada dos instrutores: utilizador e palavra-passe dados pela escola. */
export function Login({ aoEntrar }: { aoEntrar: (senhaTemporaria: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setAEnviar(true); setErro(null);
    try {
      await api("/auth/login", { metodo: "POST", corpo: { username, password } });
      aoEntrar(password);
    } catch (x) {
      const er = x as ErroApi;
      setErro(er.estado === 429
        ? "Demasiadas tentativas. Aguarde alguns minutos ou fale com o responsável de frota."
        : er.dados?.tentativasRestantes !== undefined
          ? `${er.message} Restam ${er.dados.tentativasRestantes} tentativas.`
          : er.message);
    } finally { setAEnviar(false); }
  }

  return (
    <div className="full"><div className="lcard">
      <Logo vertical />
      <h1>Entrar</h1>
      <p>Utilizador e palavra-passe dados pela escola.</p>
      <form onSubmit={enviar}>
        <label className="f" htmlFor="u">Utilizador
          <input id="u" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required autoFocus />
        </label>
        <label className="f" htmlFor="p">Palavra-passe
          <input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {erro && <div className="errbox" role="alert">{erro}</div>}
        <button className="btn primary big" disabled={aEnviar}>{aEnviar ? "A entrar…" : "Entrar"}</button>
      </form>
      <small className="muted">Esqueceu-se da palavra-passe? Fale com o responsável de frota.</small>
    </div></div>
  );
}

function forca(s: string): number {
  let p = Math.min(s.length, 20) * 4;
  if (new Set(s).size > 6) p += 10;
  if (/[0-9]/.test(s) && /[a-zA-Z]/.test(s)) p += 10;
  return Math.min(100, p);
}

/** Primeiro acesso (ou depois de uma reposicao): obriga a escolher a palavra-passe pessoal. */
export function MudarSenha({ senhaAtual, aoConcluir }: { senhaAtual: string; aoConcluir: () => void }) {
  const [atual, setAtual] = useState(senhaAtual);
  const [nova, setNova] = useState("");
  const [rep, setRep] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (nova !== rep) return setErro("As duas palavras-passe não são iguais.");
    setAEnviar(true); setErro(null);
    try { await api("/auth/mudar-senha", { metodo: "POST", corpo: { atual, nova } }); aoConcluir(); }
    catch (x) { setErro((x as ErroApi).message); } finally { setAEnviar(false); }
  }

  return (
    <div className="full"><div className="lcard">
      <Logo vertical />
      <h1>Escolha a sua palavra-passe</h1>
      <p>Só você a vai saber. Use pelo menos 10 caracteres.</p>
      <form onSubmit={enviar}>
        {!senhaAtual && <label className="f" htmlFor="a">Palavra-passe temporária<input id="a" type="password" value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" required /></label>}
        <label className="f" htmlFor="n">Nova palavra-passe<input id="n" type="password" value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" required autoFocus /></label>
        <label className="f" htmlFor="r">Repetir<input id="r" type="password" value={rep} onChange={(e) => setRep(e.target.value)} autoComplete="new-password" required /></label>
        <div><div className="gauge" role="img" aria-label="Força da palavra-passe"><i style={{ width: `${forca(nova)}%` }} /></div></div>
        <div className="note">Dica: três palavras e um número é fácil de lembrar e difícil de adivinhar.</div>
        {erro && <div className="errbox" role="alert">{erro}</div>}
        <button className="btn primary big" disabled={aEnviar}>{aEnviar ? "A guardar…" : "Guardar e entrar"}</button>
      </form>
    </div></div>
  );
}

/** A gestao entra pelo Cloudflare Access; se a sessao expirar basta recarregar. */
export function SessaoExpirada() {
  return (
    <div className="full"><div className="lcard">
      <Logo vertical /><h1>Sessão terminada</h1>
      <p>Volte a entrar com o código enviado para o seu email.</p>
      <button className="btn primary big" onClick={() => location.reload()}>Entrar</button>
    </div></div>
  );
}
