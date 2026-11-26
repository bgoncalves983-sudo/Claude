import type { Perfil } from "../shared/dominio";

export interface Env {
  DB: D1Database;
  DOCS: R2Bucket;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  CF_ACCESS_TEAM_DOMAIN: string; // ex.: "escola.cloudflareaccess.com"
  CF_ACCESS_AUD: string;
  ALERT_FROM: string;
  APP_URL: string;
  GESTAO_HOST?: string; // por omissao gestao.frotaradical.pt (protegido pelo Cloudflare Access)
  INSTRUTOR_HOST?: string; // por omissao frotaradical.pt (login proprio dos instrutores)
  SENHA_PEPPER?: string; // segredo: wrangler secret put SENHA_PEPPER
  RESEND_API_KEY?: string;
}

export interface Utilizador {
  id: number;
  email: string;
  nome: string;
  perfil: Perfil;
  metodo: "access" | "senha";
  deveMudarSenha: boolean;
  username: string | null;
}

export type AppEnv = { Bindings: Env; Variables: { user: Utilizador } };
