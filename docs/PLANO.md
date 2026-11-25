# Plano – Aplicação de Gestão da Frota da Escola

## 1. Objetivo
Aplicação web, alojada na Cloudflare, para centralizar a gestão dos veículos da escola: estado, seguros, IUC, inspeções, avarias, combustível, custos de manutenção e um repositório de documentos digitalizados. O ponto principal é **nunca deixar caducar** um prazo (seguro, IPO, IUC), por isso os alertas são o núcleo da aplicação.

## 2. Utilizadores e perfis
| Perfil | Pode |
|---|---|
| Administrador | Tudo, incluindo utilizadores e configurações |
| Gestor da frota | Criar/editar veículos, documentos, custos, manutenções |
| Instrutor/condutor | Registar abastecimentos, reportar avarias (com foto), ver o seu veículo |
| Consulta | Só leitura (direção, contabilidade) |

## 2.1 Especificidades de escola de condução (a validar com a direção/IMT)
- **Categorias de veículo:** ligeiros (B), motociclos (A1/A2/A), pesados (C/D) e reboques; cada veículo associado à(s) categoria(s) de ensino.
- **Veículo de ensino:** comando duplo (pedais), identificação/dístico de ensino e averbamento no DUA. Campos próprios na ficha.
- **Inspeção (IPO):** veículos de ensino costumam ter periodicidade própria (tipicamente mais curta); configurável por veículo, a confirmar.
- **Seguro:** apólice específica de ensino (cobre aluno/instrutor); campo para tipo de cobertura.
- **Instrutores:** licença/certificado de instrutor com validade, veículo(s) habituais; alerta de caducidade.
- **Alvará/licença da escola** e documentos da escola no repositório (não só dos veículos).
- **Uso por veículo:** horas/km de aulas por veículo e instrutor (fase 2), útil para planear revisões e desgaste (pneus, embraiagem, travões).
- **Condutor = instrutor + alunos:** o registo de abastecimentos/avarias é feito por instrutores; os alunos não têm acesso.

## 3. Módulos e funcionalidades

### 3.1 Veículos
- Ficha: matrícula, marca/modelo, VIN, combustível, data de matrícula, data de aquisição, km atuais, categoria (ensino/serviço), foto.
- Estado: Ativo, Em oficina, Imobilizado, Abatido/vendido.
- Histórico completo por veículo (linha temporal de tudo o que aconteceu).

### 3.2 Seguros
- Apólice, seguradora, tipo de cobertura, prémio, periodicidade, datas de início/fim, contacto de sinistros.
- Anexos: apólice, recibos, carta verde.

### 3.3 IUC
- Mês de vencimento (aniversário da matrícula), valor, estado (pago/por pagar), comprovativo.

### 3.4 Inspeções (IPO)
- Data, resultado, km, centro, custo, próxima data calculada automaticamente pela periodicidade aplicável ao tipo de veículo (**a confirmar**, em especial regras de veículos de ensino).
- Anexo: ficha de inspeção.

### 3.5 Avarias e ocorrências
- Reporte rápido (telemóvel, com fotos) por instrutores.
- Fluxo: Reportada → Em análise → Em reparação → Resolvida.
- Ligação à manutenção/custo que a resolveu. Sinistros/acidentes como tipo de ocorrência.

### 3.6 Manutenção
- Preventiva (revisões por km ou por data, com alerta) e corretiva.
- Oficina, descrição, peças, mão de obra, custo, fatura anexa, km.

### 3.7 Combustível
- Abastecimento: data, litros, valor, km, posto, condutor.
- Cálculo automático de consumo médio (l/100 km) e alerta para valores anómalos.

### 3.8 Custos e relatórios
- Custo total por veículo, por categoria (seguro, IUC, combustível, manutenção, IPO), por mês/ano e custo por km.
- Exportação para Excel/CSV e PDF.
- Painel inicial: veículos com prazos a caducar, avarias abertas, custos do mês.

### 3.9 Repositório de documentos
- Upload de PDF/imagens, ligado ao veículo e ao tipo (DUA, apólice, IPO, fatura, IUC, foto de dano…).
- Versões, data de validade do documento, pesquisa.

### 3.10 Alertas
- Aviso a 60/30/15/7 dias (configurável) para seguro, IPO, IUC, revisões.
- Canais: email (fase 1), painel na app; opcional notificação push/WhatsApp mais tarde.
- Resumo semanal por email ao gestor.

### 3.11 Instrutores (fase 2)
- Instrutores, validade de carta e licença de instrutor, atribuição de veículo habitual, alertas de caducidade.

## 4. Arquitetura proposta (Cloudflare)
| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite (PWA, mobile-first), alojado em **Cloudflare Pages/Workers** |
| API | **Cloudflare Workers** com Hono (TypeScript) |
| Base de dados | **Cloudflare D1** (SQLite) + Drizzle ORM e migrações |
| Ficheiros | **Cloudflare R2** (privado; downloads por URL assinado temporário) |
| Autenticação | **Cloudflare Access** (Zero Trust, gratuito até 50 utilizadores; login por email/Google/Microsoft) ou alternativa com Lucia/Better-Auth se quiserem login próprio |
| Alertas | **Cron Triggers** diários → verifica prazos → envia email (Resend ou MailChannels) |
| Backups | Exportação periódica de D1 (Time Travel) + cópia mensal de R2 |

Custo estimado: para uma frota escolar, praticamente dentro dos planos gratuitos/baixos da Cloudflare (poucos euros por mês no máximo; só o domínio e o email transacional podem ter custo).

Alternativa: se preferirem uma BD relacional "clássica" (Postgres), usar Cloudflare Workers + Neon/Supabase. D1 é suficiente para este volume.

## 4.1 Acesso e dispositivos (decisão: PWA)
Em vez de apps nativas, a aplicação é uma **PWA** (site instalável), com um só código para Android, iOS e Windows. Sem lojas de apps, sem taxas e com atualizações imediatas.

| Plataforma | Acesso |
|---|---|
| Windows (secretaria/gestor) | Chrome/Edge, com opção "Instalar" como app |
| Android (instrutores) | Chrome → "Adicionar ao ecrã inicial" |
| iPhone/iPad | Safari → Partilhar → "Adicionar ao ecrã principal" |
| Mac/Linux | Qualquer browser moderno |

- Endereço próprio, por exemplo `frota.nomedaescola.pt`.
- Login por email (código de uso único) ou conta Google/Microsoft, via Cloudflare Access; sem palavras-passe a gerir.
- Câmara para fotos de avarias e faturas; notificações push (no iPhone só após instalar no ecrã principal, iOS 16.4+).
- Modo offline limitado: abastecimentos e avarias guardados localmente e sincronizados quando houver rede.
- Dois layouts: painel completo para ecrã grande (secretaria) e botões grandes para uso com uma mão (instrutores: "Abastecimento", "Reportar avaria", "Os meus documentos").
- Guia de 3 passos para instalação no iPhone.
- Se for preciso mais tarde (lojas, GPS contínuo), a PWA pode ser empacotada como app nativa.

## 5. Modelo de dados (resumo)
`utilizador`, `veiculo`, `condutor`, `seguro`, `iuc`, `inspecao`, `avaria`, `manutencao`, `abastecimento`, `custo` (genérico/consolidado), `documento` (tipo, veiculo_id, r2_key, validade, versao), `alerta_config`, `alerta_log`, `auditoria` (quem alterou o quê e quando).

Relações: tudo ligado a `veiculo`; `documento` pode estar ligado a qualquer registo (seguro, inspeção, manutenção…).

## 6. Segurança e RGPD
- Acesso só autenticado; ficheiros R2 nunca públicos.
- Perfis com permissões mínimas; registo de auditoria.
- Dados pessoais de condutores reduzidos ao necessário; definir prazo de retenção.
- HTTPS obrigatório, backups testados.

## 7. Fases de desenvolvimento
**Fase 0 – Levantamento (1 semana):** inventariar veículos e documentos existentes, confirmar regras (IPO de veículos de ensino, IUC, seguros), definir quem usa e como.

**Fase 1 – MVP (3–4 semanas):** autenticação e perfis, veículos, documentos (upload/consulta), seguros, IUC, IPO, **alertas por email**, painel inicial. Já resolve o maior risco (prazos).

**Fase 2 (3 semanas):** avarias com fotos (PWA), manutenção, combustível, custos por veículo, relatórios e exportação.

**Fase 3 (2–3 semanas):** condutores, revisões preventivas por km, consumos/anomalias, auditoria detalhada, notificações extra.

**Fase 4:** importação inicial de dados via Excel, formação dos utilizadores, afinação.

## 8. Riscos
- Dados históricos dispersos/em papel → prever tempo para digitalizar e carregar.
- Adesão dos instrutores ao registo → manter o reporte muito simples (2–3 toques no telemóvel).
- Regras legais variam por tipo de veículo → validar com a direção/contabilidade.

## 9. Questões em aberto
1. ~~É uma escola de condução?~~ Sim. Confirmar categorias lecionadas (B, A, C/D?) e se há motas/pesados.
2. Quantos veículos e quantos utilizadores?
3. Quem regista abastecimentos e avarias: só administrativos ou também instrutores?
4. Têm domínio próprio e conta Cloudflare?
5. Há dados em Excel/papel para migrar?
6. Preferem login com Google/Microsoft da escola?
6b. Quantos instrutores usarão o telemóvel e é Android ou iPhone?
7. Querem integração com cartões de combustível ou GPS/telemetria no futuro?
