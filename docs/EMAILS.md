# Emails de alerta (Resend)

A aplicação envia emails à gestão para:
- **Avaria reportada** (assim que o instrutor a envia, ou marca um problema na verificação);
- **Avarias por tratar há mais de 24 horas** (lembrete diário);
- **Prazos a caducar** (seguro, IUC, IPO, multas, cartas e licenças, a 60, 30, 15 e 7 dias);
- **Gasóleo do depósito abaixo do mínimo** (no máximo uma vez por semana).

Os destinatários são os gestores e administradores ativos (os que entram por código no email).

## Configurar (uma vez)

1. **Conta:** criar em resend.com, com um email partilhado da escola. Plano gratuito chega (3 000 emails por mês).
2. **Domínio:** no Resend → **Domains** → **Add Domain** → `frotaradical.pt` (região da Europa, se perguntar).
3. **Registos DNS:** o Resend mostra 3 ou 4 registos (SPF, DKIM e, às vezes, MX). Na Cloudflare → `frotaradical.pt` → **DNS** → **Records**, acrescentar cada um **tal e qual**, com a nuvem **cinzenta** (“DNS only”). Voltar ao Resend e carregar em **Verify**. Pode demorar alguns minutos.
4. **Chave:** no Resend → **API Keys** → **Create API Key** → permissão **Sending access**, só para o domínio `frotaradical.pt`. Copiar a chave (começa por `re_`); só aparece uma vez.
5. **Registar na Cloudflare** (no PowerShell, na pasta do projeto; colar a chave quando pedir, sem a partilhar):
   ```powershell
   npx wrangler secret put RESEND_API_KEY
   ```
6. **Testar:** na aplicação, **Sistema → Emails e notificações → Enviar email de teste para mim**. Se falhar, a mensagem diz porquê (por exemplo, domínio por verificar).

## Notas
- O remetente é `alertas@frotaradical.pt` (configurável em `ALERT_FROM`, no `wrangler.jsonc`). Só funciona depois de o domínio estar verificado no Resend.
- Os emails nunca bloqueiam o trabalho dos instrutores: se o envio falhar, o registo da avaria fica na mesma.
- Cada aviso de prazo é enviado uma única vez por limiar. Se a data for renovada, os avisos recomeçam.
- Em caso de dúvida sobre o que foi enviado: o Resend tem um registo de todos os emails.
