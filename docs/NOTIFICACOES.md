# Notificações push (avarias)

A gestão recebe uma notificação no telemóvel ou no PC, mesmo com a aplicação fechada, quando um instrutor reporta uma avaria ou marca um problema na verificação.

## Ativar (uma vez)

1. Gerar o par de chaves (no PowerShell, na pasta do projeto):
   ```powershell
   node scripts/gerar-vapid.mjs
   ```
   Mostra duas linhas: a chave pública e a chave privada. **Não partilhe a privada com ninguém.**
2. Registar as duas na Cloudflare (colar o valor quando o Wrangler pedir; não aparece no ecrã):
   ```powershell
   npx wrangler secret put VAPID_PUBLIC_KEY
   npx wrangler secret put VAPID_PRIVATE_KEY
   ```
3. Publicar: `npm run deploy`.
4. Em cada dispositivo da gestão: abrir **Painel** (ou **Avarias**) e carregar em **Ativar notificações**; aceitar o pedido do browser.

## Notas
- **Android:** funciona no Chrome, de preferência com a aplicação instalada no ecrã inicial.
- **iPhone:** só funciona com a aplicação instalada no ecrã inicial (iOS 16.4 ou superior).
- **PC:** Chrome, Edge ou Firefox, com o browser aberto (pode estar em segundo plano).
- Se as chaves mudarem, os dispositivos têm de voltar a ativar as notificações.
- A mensagem vai cifrada: o serviço de push (Google, Mozilla, Apple) não consegue lê-la.
- Um dispositivo desinstalado ou com a permissão retirada é removido sozinho da lista.
