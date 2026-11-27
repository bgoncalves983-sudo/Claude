# Frota Radical

Aplicação web (PWA) para gerir a frota da Escola de Condução Radical. Corre na Cloudflare:
Workers (API + site), D1 (base de dados), R2 (documentos), Cloudflare Access (login) e Cron Triggers (alertas).
O plano completo está em [`docs/PLANO.md`](docs/PLANO.md).

## Estado

| Área | Estado |
|---|---|
| Esquema da base de dados e migrações (0000 a 0004) | feito |
| Login da gestão (Cloudflare Access) e dos instrutores (utilizador e palavra-passe, sessões, bloqueio, primeiro acesso) | feito |
| Campos por perfil, proteção contra pedidos de outros sites, cabeçalhos de segurança, verificação real dos ficheiros | feito |
| Veículos: criar, editar, duplicar, edição em lote, abater e reativar, importar CSV, etiquetas QR | feito |
| Fotografia do veículo (reduzida no telemóvel, miniaturas, cache longa) | feito |
| Conjuntos pesado + reboque (regras, histórico) | API feita; falta o ecrã de gestão |
| Seguros, IUC, IPO, manutenção, combustível, avarias, sinistros, multas | feito (API e ecrãs) |
| Depósito de gasóleo (entradas, contagem física, anulações, custo médio, autonomia) | feito |
| Instrutor: início, abastecimento, avaria, verificação diária, com envio sem rede | feito |
| Fotografias nas avarias e nos problemas da verificação (tirar ou escolher no telemóvel, até 5, também sem rede) | feito |
| Instrutor com 0 ou 1 veículo atribuído pode registar noutro veículo; com 2 ou mais só nos seus | feito |
| Documentos por veículo (PDF e imagens, versões, validade) | feito |
| Alertas de prazos (incluindo multas) e painel | feito; falta ligar o envio de emails (Resend) |
| Cópias de segurança semanais | feito |
| Documentos a bordo disponíveis sem rede no telemóvel | por fazer |
| Ecrã de auditoria | por fazer |

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

`npm run typecheck` e `npm test` validam o código. Com `wrangler dev` a correr, `node scripts/teste-integracao.mjs` testa os fluxos de acesso e permissões ponta a ponta. Em `ENVIRONMENT=dev` o cabeçalho `x-dev-user`
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
6b. Segredo das palavras-passe dos instrutores: `npx wrangler secret put SENHA_PEPPER` (ver `docs/MIGRACAO-ACESSO.md`, que também descreve os dois endereços).
7. Envio de emails: conta Resend com o domínio validado e `npx wrangler secret put RESEND_API_KEY`.
8. Ligar o domínio: Workers → frota-radical → Settings → Domains & Routes → `frotaradical.pt`.
9. `npm run deploy`

## Cópias de segurança

Todas as segundas-feiras às 07:00 (UTC) a aplicação guarda uma cópia de todas as tabelas no armazenamento privado (`backups/`), mantendo as últimas 12. Não incluem palavras-passe, sessões nem tentativas de login. Só os administradores as veem: `GET /api/backups` lista, `POST /api/backups` cria uma já, `GET /api/backups/<nome>` descarrega (ficheiro `.json.gz`). Os documentos e as fotos já estão no R2 e não fazem parte do ficheiro.

## Segurança

- Todas as rotas `/api/*` (exceto `/api/saude`) exigem utilizador autenticado e ativo na tabela `utilizador`.
- O JWT do Access é validado (assinatura, audiência, emissor, validade); a lista de utilizadores é a fonte de permissões.
- Os documentos nunca são públicos: só se descarregam pela API, com verificação de perfil.
- Instrutores só veem os veículos que lhes estão atribuídos (e o reboque do seu trator).
- Alterações importantes ficam na tabela `auditoria`.
