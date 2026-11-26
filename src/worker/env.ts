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
  RESEND_API_KEY?: string;
}

export interface Utilizador {
  id: number;
  email: string;
  nome: string;
  perfil: Perfil;
}

export type AppEnv = { Bindings: Env; Variables: { user: Utilizador } };
