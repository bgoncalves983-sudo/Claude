# Migração do acesso: gestão no Access, instrutores com login próprio

**Não executar antes de a nova interface (ecrãs de entrada) estar publicada.** Hoje `frotaradical.pt` está protegido pelo Access e a gestão entra por aí. Depois desta migração:

| Endereço | Quem | Como entra |
|---|---|---|
| `gestao.frotaradical.pt` | gestão, administradores, consulta | código por email (Cloudflare Access) |
| `frotaradical.pt` | instrutores | utilizador e palavra-passe (login próprio) |

Uma conta de um tipo nunca vale no endereço do outro.

## Passos (por esta ordem)

1. **Atualizar o código e a base de dados** (seguro a qualquer momento: só acrescenta colunas e tabelas)
   ```powershell
   git pull
   npm install
   npm run db:migrate:remote
   ```
2. **Criar o segredo das palavras-passe.** Gere um texto aleatório e guarde-o num gestor de palavras-passe: **se se perder, todas as palavras-passe dos instrutores deixam de funcionar** (têm de ser repostas).
   ```powershell
   $b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
   npx wrangler secret put SENHA_PEPPER
   ```
   (cole o texto gerado quando o Wrangler pedir)
3. **Atualizar o `wrangler.jsonc`** (o seu ficheiro local):
   - acrescentar `"workers_dev": false, "preview_urls": false,`
   - substituir `"routes"` por
     ```jsonc
     "routes": [
       { "pattern": "frotaradical.pt", "custom_domain": true },
       { "pattern": "gestao.frotaradical.pt", "custom_domain": true }
     ],
     ```
4. **Publicar:** `npm run deploy`. O endereço `gestao.frotaradical.pt` passa a existir. Ainda sem Access, a API recusa tudo (não há token), por isso é seguro.
5. **Mover o Access para o endereço da gestão:** Zero Trust → Access → Applications → `frotaradical.pt` → Edit → trocar o hostname para `gestao.frotaradical.pt` → Save. O AUD tag não muda.
6. **Testar a gestão:** abrir `https://gestao.frotaradical.pt`, entrar com o código por email.
7. **Criar o primeiro instrutor** em Utilizadores → Criar instrutor, e testar no telemóvel em `https://frotaradical.pt` com o utilizador e a palavra-passe temporária.

## Se algo correr mal
- A gestão não entra em `gestao.frotaradical.pt`: confirmar o passo 5 e que o email existe em Utilizadores (perfil gestor ou administrador).
- Voltar atrás: repor o hostname do Access para `frotaradical.pt` e publicar a versão anterior (`git checkout` do commit anterior e `npm run deploy`).
