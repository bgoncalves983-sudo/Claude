# Análise de interface, segurança e fluidez

Revisão feita antes de iniciar a construção, sobre o código atual (API, base de dados, PWA) e os mockups (versão 4).
Prioridade: **A** = antes de dar acesso aos instrutores, **B** = durante a construção, **C** = depois.

## 1. Segurança

| # | Gravidade | Prio. | Problema | Correção |
|---|---|---|---|---|
| S1 | Alta | feito | `drizzle-orm` com vulnerabilidade de injeção SQL em identificadores (GHSA-gpj5-g38j-94v9). A app não passa identificadores vindos do utilizador, mas a versão estava afetada. | Atualizado para 0.45.4. `npm audit --omit=dev` devolve 0 vulnerabilidades. As restantes (vitest, esbuild, tinypool) são só de desenvolvimento e não vão para produção. |
| S2 | Alta | A | A API devolve **todas as colunas** do veículo a qualquer perfil (`select()` sem filtro). Com os campos novos (valor de aquisição, fornecedor, cartão de combustível) e os custos, o instrutor veria no browser dados que o ecrã esconde. Esconder no ecrã não é segurança. | Respostas por perfil (lista explícita de campos permitidos). Custos, seguros, IPO com valores, multas e sinistros só para gestão e consulta. Testes automáticos por perfil. |
| S3 | Média | A | Sem verificação de `Origin` nos pedidos que alteram dados. O upload (multipart) é um "pedido simples" que um site externo poderia tentar disparar com a sessão do utilizador. | Middleware que recusa POST, PATCH e DELETE sem `Origin` igual ao da aplicação. |
| S4 | Média | A | Sem cabeçalhos de segurança (CSP, `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`). | `public/_headers` e middleware na API. CSP restrita: scripts só do próprio site, imagens `self`/`data:`/`blob:`. |
| S5 | Média | A | O upload confia no tipo de ficheiro declarado pelo cliente. | Verificar os primeiros bytes (PDF, JPEG, PNG, WEBP), servir PDFs com `Content-Security-Policy: sandbox`, e reduzir as fotos no telemóvel (remove também a localização GPS das fotos). |
| S6 | Média | A | Se a Cloudflare rodar a chave do Access, a aplicação rejeita todos os pedidos até 1 hora (cache das chaves). | Se o `kid` não for conhecido, voltar a obter as chaves uma vez antes de recusar. |
| S7 | Média | A | O endereço `workers.dev` continua ativo. A API recusa-o (valida o token), mas é superfície a mais. | `workers_dev: false` e `preview_urls: false`. |
| S8 | Média | A | Administrador partilhado (`it@eradical.pt`): sem rasto de quem fez o quê. A conta Cloudflare é de serviço. | Uma conta de administrador por pessoa. 2FA na caixa partilhada e na conta Cloudflare, com pelo menos duas pessoas com recuperação. |
| S9 | Média | A | Saída de pessoas: hoje exige alterar o Access **e** a tabela de utilizadores. Esquecer um dos dois deixa acesso ou barra alguém. | Access com regra "emails `@eradical.pt`" e a aplicação decide quem entra (tabela). Sessão: 12–24 h para gestão, 7 dias para instrutores. Desativar uma pessoa = `ativo = 0`. |
| S10 | Média | B | Backups: o histórico da base de dados da Cloudflare é limitado e o R2 não guarda versões, por isso apagar um documento seria definitivo. | Apagar = marcar como apagado (recuperável). Exportação semanal da base de dados para o R2 (cron) e cópia mensal fora da Cloudflare. |
| S11 | Média | B | RGPD: carta e licença de instrutor, identificação de condutores em multas. | Acesso só à gestão, registo de quem consulta dados sensíveis, prazo de retenção para ex-instrutores, informação aos instrutores. Validar com quem trata da proteção de dados na escola. |
| S12 | Baixa | B | Datas calculadas em UTC: entre as 00:00 e as 01:00 no verão, "hoje" é ontem. | Usar o fuso `Europe/Lisbon`. |
| S13 | Baixa | B | A auditoria existe mas não tem ecrã nem prazo de retenção. | Separador "Histórico" na ficha e ecrã de auditoria para administradores. |
| S14 | Baixa | C | Sem limite de pedidos nos pontos mais pesados (upload, importação). | Regra de limite na Cloudflare. |
| S15 | Info | — | O protótipo usa `innerHTML`. | Nunca portar para a aplicação real. Lá usa-se React (escapa por defeito) e proíbe-se `dangerouslySetInnerHTML`. |

Pontos que já estão bem: JWT do Access validado (assinatura, audiência, emissor, validade), segunda barreira na própria API, SQL parametrizado, validação dos dados com Zod, ficheiros nunca públicos, regras de reboque garantidas pela base de dados (índices únicos), mensagens de erro genéricas.

## 2. Integridade dos dados

| # | Prio. | Tema | Regra |
|---|---|---|---|
| D1 | A | Depósito de gasóleo | Movimentos só se acrescentam (nunca se editam). O nível é **calculado** (entradas − saídas ± ajustes), não guardado. Cada abastecimento "do depósito" cria a saída na mesma transação. Correção = novo movimento (ajuste ou anulação), com autor e motivo. Saldo negativo: aviso e confirmação do gestor. Aviso de duplicados (mesmo veículo, litros iguais, poucos minutos). |
| D2 | B | Odómetro | O valor tem de ser ≥ ao último registo; aviso para saltos anormais; horas para tratores. Mostrar sempre o valor anterior. |
| D3 | B | Edição simultânea | Dois gestores a editar o mesmo veículo: a última gravação ganhava. Passa a haver versão e o segundo recebe "alterado entretanto". |
| D4 | B | Importação Excel | Pré-visualização, tudo-ou-nada numa transação, atualiza pela matrícula, relatório de erros. |
| D5 | A | Instrutor e custos | O custo do abastecimento do depósito vem do custo médio do gasóleo, não do instrutor. |

## 3. Interface (a partir dos mockups)

| # | Prio. | Observação | Proposta |
|---|---|---|---|
| U1 | A | No telemóvel a pesquisa está escondida, e procurar por matrícula é a tarefa mais frequente. | Barra ou ícone de pesquisa sempre visível. |
| U2 | A | Os filtros e separadores têm menos de 44 px de altura no telemóvel. | Alvos tácteis de pelo menos 44 px. |
| U3 | B | A ficha do gestor tem 10 separadores. | Reduzir para 6: Resumo, Prazos (seguro, IUC, IPO), Custos (manutenção, combustível), Ocorrências (avarias, sinistros, multas), Documentos, Dados. |
| U4 | B | O vermelho da marca é também a ação principal e o estado "caducado". | Manter o vermelho da marca, mas o estado crítico sempre com ícone e texto, e testar com daltónicos. Alternativa: botões principais em grafite. **Decisão vossa.** |
| U5 | B | Falta escolher a escola (Radical, Pátria, Todas) de forma global. | Seletor no topo, lembrado entre sessões. |
| U6 | B | Para gerir 76 ou mais veículos no PC, os cartões são lentos. | Vista de tabela densa: ordenar, escolher colunas, guardar filtros. |
| U7 | A | Não há estados vazios, de erro, de carregamento, offline ou sem permissão. | Desenhar todos antes de construir (skeletons em vez de "A carregar…"). |
| U8 | A | Formulários do instrutor. | Teclado numérico, último valor pré-preenchido, rascunho guardado, botão de gravar fixo, erros junto ao campo. |
| U9 | B | O gestor não tem um sítio com "o que tenho de fazer hoje". | Sino de notificações e lista de tarefas no painel. |
| U10 | B | Acessibilidade. | Vermelho `#E00838` sobre branco dá 4,6:1: serve para texto grande e botões, não para texto pequeno. Não depender só da cor. Respeitar o tamanho de letra do sistema. |
| U11 | A | Os documentos a bordo (DUA, apólice) têm de abrir sem rede, para mostrar às autoridades. | Guardar esses PDFs offline no telemóvel do instrutor. |
| U12 | B | O código por email pode demorar ou ir para o spam. | Alternativa com conta Google ou Microsoft. |

## 4. Fluidez

| # | Prio. | Problema | Solução |
|---|---|---|---|
| F1 | A | 76 fotos numa grelha: se cada uma tiver ~1 MB, o ecrã descarrega ~76 MB. | Miniatura (~400 px, ~30 KB) e imagem grande (1600 px) criadas no telemóvel ao carregar; `loading="lazy"`; cache longo com versão no endereço. |
| F2 | A | Os instrutores trabalham no parque, com rede fraca. | Registos (abastecimento, avaria, verificação) guardados no telemóvel e enviados quando houver rede; identificador gerado no cliente para nunca duplicar; estado "por enviar" visível. |
| F3 | B | Vários pedidos por ecrã. | Um pedido agregado por ecrã (painel, ficha) e listas paginadas (50 por página). |
| F4 | B | Resposta lenta aparente. | Atualização imediata no ecrã, skeletons, transições curtas. |
| F5 | B | O painel de prazos faz ~7 consultas de cada vez que se abre. | Guardar o resultado 5 minutos. O volume é pequeno, mas o custo é quase nulo. |
| F6 | B | Tamanho da aplicação. | Hoje 71 KB comprimidos. Manter abaixo de 150 KB, dividir por ecrãs, gráficos em SVG próprio. |
| F7 | B | O service worker só guarda a página inicial. | Pré-cache versionado e aviso "Nova versão disponível". |
| F8 | B | Fotos tiradas no telemóvel têm 3–8 MB. | Reduzir para 200–400 KB no telemóvel antes do envio, com barra de progresso. |
| F9 | C | Relatórios grandes. | Gerar em segundo plano e avisar quando estiver pronto. |

A base de dados está numa região europeia (WEUR), perto de Portugal, e as tabelas têm índices: a latência não é uma preocupação com este volume.
