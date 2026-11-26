# Frota Radical

Aplicação web (PWA) para gerir a frota da Escola de Condução Radical. Corre na Cloudflare:
Workers (API + site), D1 (base de dados), R2 (documentos), Cloudflare Access (login) e Cron Triggers (alertas).
O plano completo está em [`docs/PLANO.md`](docs/PLANO.md).

## Estado

| Área | Estado |
|---|---|
| Esquema da base de dados (D1) e migrações | feito |
| Autenticação (Cloudflare Access) e perfis | feito |
| Veículos (listar, filtrar, criar, editar) | feito |
| Conjuntos pesado + reboque (regras, histórico, auditoria) | feito |
| Documentos em R2 (upload, versões, download autenticado) | feito |
| Alertas de prazos e email diário (cron) | feito (falta configurar o envio de email) |
| PWA: painel de prazos, lista e ficha de veículo | primeira versão |
| Seguros, IUC, IPO, avarias, manutenção, combustível (API e ecrãs) | por fazer (as tabelas já existem) |
| Importação dos 80 veículos por Excel | por fazer |

## Desenvolvimento local

```bash
npm install
cp .dev.vars.example .dev.vars           # ENVIRONMENT=dev ativa o login de teste
npm run build                            # o Worker serve o frontend compilado
npm run db:migrate:local
npx wrangler d1 execute frota --local --command \
  "INSERT INTO utilizador(email,nome,perfil) VALUES ('eu@exemplo.pt','Eu','admin');"
npm run dev:api                          # http://localhost:8787
curl -H 'x-dev-user: eu@exemplo.pt' localhost:8787/api/me
```

`npm run typecheck` e `npm test` validam o código. Em `ENVIRONMENT=dev` o cabeçalho `x-dev-user`
substitui o login; em produção só o JWT do Cloudflare Access é aceite.

## Publicar na Cloudflare (uma vez)

1. `npx wrangler login`
2. `npx wrangler d1 create frota` e colar o `database_id` em `wrangler.jsonc`.
3. `npx wrangler r2 bucket create frota-documentos`
4. `npm run db:migrate:remote`
5. Criar o primeiro administrador:
   `npx wrangler d1 execute frota --remote --command "INSERT INTO utilizador(email,nome,perfil) VALUES ('...','...','admin');"`
6. Cloudflare Zero Trust → Access → Applications: criar uma aplicação para o domínio da app, com política
   restrita aos emails da escola. Copiar o *Application Audience (AUD) tag* e o *team domain* para
   `CF_ACCESS_AUD` e `CF_ACCESS_TEAM_DOMAIN` em `wrangler.jsonc`.
7. Envio de emails: conta Resend com o domínio validado e `npx wrangler secret put RESEND_API_KEY`.
8. Ligar o domínio: Workers → frota-radical → Settings → Domains & Routes → `frotaradical.pt`.
9. `npm run deploy`

## Segurança

- Todas as rotas `/api/*` (exceto `/api/saude`) exigem utilizador autenticado e ativo na tabela `utilizador`.
- O JWT do Access é validado (assinatura, audiência, emissor, validade); a lista de utilizadores é a fonte de permissões.
- Os documentos nunca são públicos: só se descarregam pela API, com verificação de perfil.
- Instrutores só veem os veículos que lhes estão atribuídos (e o reboque do seu trator).
- Alterações importantes ficam na tabela `auditoria`.
