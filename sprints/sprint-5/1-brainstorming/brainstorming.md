# Brainstorming — Sprint 5 | Wave 5

**Data:** 2026-03-07
**Researcher:** Researcher Agent (wave-5, step-01)

---

## Contexto do Produto

O Agentic Backbone Hub e uma plataforma self-hosted para criar e operar agentes de IA autonomos em pt-BR. Apos 4 sprints, o produto possui:

- Gestao completa de agentes (AGENT.md, heartbeat, active hours, cron)
- Dashboard, Analytics, Custos, Trace timeline
- Knowledge base com RAG, Memory semantica
- GUI de Adapters (MySQL, Postgres, Evolution/WhatsApp, Twilio)
- Security dashboard (prompt injection detection, UEBA)
- Inbox unificado multi-canal com SSE
- Approvals (HITL) para acoes criticas
- Avaliacao de agentes com eval-runs
- Notificacoes push (PWA)
- Gestao de usuarios e permissoes
- Jobs, Channels, Skills, Tools

**Ainda nao implementado (backlog):**
- Multi-agent orchestration (D-033/G-034)
- Agent sandbox (D-038/G-039)
- Config versioning (D-029/G-029)
- Export de relatorios (D-027/G-027)
- Voice channels Twilio (D-023/G-023)
- Multi-tenancy/agencias (D-026/G-026)

---

## Perfis-Alvo

- **P1** — Empreendedor PME (nao-tecnico, quer resultados rapidos)
- **P2** — Dev/Tecnico (construtor, integrador, experimentador)
- **P3** — Gestor de Operacoes (visibilidade, controle, compliance)
- **P4** — Consultor/Agencia (escala, multi-cliente, entregaveis)

---

## Pesquisa de Mercado

### Fontes Consultadas

1. Deloitte Tech Trends 2026 — Agentic AI Strategy
2. Salesforce Connectivity Report 2026 — Multi-agent adoption up 67%
3. Gravitee State of AI Agent Security 2026 — 88% de orgs relataram incidentes
4. TechCrunch Mar 2026 — WhatsApp permite chatbots de terceiros no Brasil
5. ANPD 2026-2027 — Prioridades de fiscalizacao: AI e biometria
6. Gartner/IDC 2026 — 40% de projetos agenticos serao descartados
7. CSA Agentic Trust Framework 2026 — Zero trust para agentes
8. NIST AI Agent Standards Initiative 2026
9. Fast.io/Everworker 2026 — Webhook event-driven para agentes

### Dados Criticos do Mercado

- **67%** de crescimento esperado em adocao multi-agente ate 2027 (Salesforce)
- **50%** dos agentes em producao ainda operam em silos sem orquestracao
- **40%** de projetos agenticos serao abandonados por dificuldade de operacionalizar (Gartner)
- **88%** das organizacoes relatam incidentes de seguranca com agentes IA
- **24%** dos times tem visibilidade de quais agentes interagem entre si
- Meta liberou chatbots de terceiros no WhatsApp Brasil em **marco 2026** — oportunidade imediata
- ANPD priorizou AI para fiscalizacao **2026-2027** — risco regulatorio crescente
- Mercado brasileiro de IA agentica: **USD 3.4bi** em 2026, crescendo 31%/ano (IDC)

---

## Dores

### D-041 | WhatsApp via Evolution API: risco de banimento
Operadores usam Evolution API (integracao nao-oficial com WhatsApp). Meta bane numeros que violam ToS. Em marco 2026, Meta liberou oficialmente APIs de terceiros para chatbots no Brasil — a janela para migrar para a Cloud API oficial esta aberta. Continuar na Evolution expos negocio a suspensao sem aviso previo.

**Evidencia:** TechCrunch (06/03/2026) — "After Europe, WhatsApp will let rival AI companies offer chatbots in Brazil"

### D-042 | Conformidade LGPD sem ferramentas
Plataforma de agentes IA processa dados pessoais de usuarios finais (conversas, memoria semantica). ANPD priorizou AI para fiscalizacao em 2026-2027. Operadores PME nao sabem: quais dados o agente coleta, como exercer direitos de titular, como documentar o DPIA, como demonstrar conformidade para clientes.

**Evidencia:** ANPD — "Enforcement roadmap 2026-2027 prioriza AI e biometria"

### D-043 | Agentes so reagem a schedule, nao a eventos externos
Heartbeat funciona em intervalos fixos. Agente nao pode ser ativado quando um ticket e criado no Zendesk, pagamento e processado no Stripe, lead e adicionado ao CRM, ou commit e feito no GitHub. Operadores criam gambiarras com n8n/Zapier para "acordar" o agente via conversa simulada — fragil e caro.

**Evidencia:** Fast.io/Everworker 2026 — event-driven architecture e o padrao emergente para agentes reativos

### D-044 | Orquestracao multi-agente inexistente
50% dos agentes em producao operam em silos. Workflows complexos — triagem de suporte, handoff para especialista, validacao por segundo agente — exigem codigo customizado fora do Hub. Nao existe supervisor-agent pattern, roteamento por intencao ou passagem de contexto entre agentes.

**Evidencia:** Salesforce Connectivity Report 2026 — 86% dos lideres de TI temem complexidade sem integracao inter-agente

### D-045 | Mudancas em producao sem sandbox
Toda alteracao em SOUL.md, instrucoes, skills ou ferramentas vai direto para producao. P2/P4 evitam experimentar porque regressoes impactam usuarios reais imediatamente. Comparar comportamento antes/depois de uma mudanca e impossivel sem acesso ao filesystem.

### D-046 | Sem exportacao de relatorios para stakeholders
Dashboard mostra dados em tempo real mas nao gera PDF/CSV exportavel. P3/P4 precisam de relatorios para reunioes com clientes, auditorias internas e compliance. Solucao atual: screenshots manuais.

### D-047 | Sem historico de versoes de configuracao
Edicoes em SOUL.md/HEARTBEAT.md sobrescrevem sem registro. Quando o agente piora, nao ha como identificar qual mudanca causou a regressao. Rollback exige acesso SSH ao servidor — inacessivel para P1/P3.

### D-048 | Telemetria nao exportavel para stacks externas
Times com Datadog, Grafana ou Langfuse nao conseguem integrar dados do backbone. Nao ha endpoint OTLP, sem exportacao de traces em formato padrao. Silos de observabilidade forcam escolha entre backbone e ferramentas existentes.

### D-049 | Sem rate limiting e quotas por agente
Agente mal configurado (heartbeat muito frequente, loop recursivo em tool calls) pode consumir tokens sem limite. Nao existe throttle por agente, limite de tokens por hora, ou pausa automatica ao atingir quota — risco de custos explosivos.

### D-050 | Sem canais enterprise (Slack, Teams, Email)
WhatsApp e o canal dominante para consumidor final, mas P3/P4 precisam de agentes em Slack (suporte interno de TI, duvidas de RH), Microsoft Teams (enterprise B2B), e Email (atendimento assicrono). Esses canais nao existem como conectores nativos.

---

## Ganhos

### G-042 | WhatsApp Cloud API oficial sem risco de banimento
Migracao para Cloud API oficial garante SLA da Meta, acesso a recursos premium (botoes interativos, lista de produtos, flows verificados, Business Calling) e elimina dependencia de Evolution API nao-oficial.

### G-043 | LGPD Compliance Assistant no Hub
Dashboard de conformidade: mapa de dados pessoais processados por agente, DPIA assistido por AI, canal de exercicio de direitos de titulares (acesso, correcao, exclusao), log de consentimentos e relatorio exportavel para ANPD.

### G-044 | Webhook Inbound Triggers
Endpoint HTTP publico por agente para receber eventos externos. Agente reage imediatamente a: novo ticket, pagamento processado, commit pushado, lead capturado. Configuracao de filtros, autenticacao (HMAC), mapeamento de payload para contexto do agente.

### G-045 | Orquestracao Multi-Agente
Supervisor-agent pattern: agente coordenador delega subtarefas a agentes especialistas. GUI de criacao de workflows de handoff. Roteamento por intencao detectada. Passagem de contexto entre agentes. Historico unificado de conversa multi-agente.

### G-046 | Agent Sandbox
Clonar agente como rascunho isolado. Chat de teste sem afetar producao. Comparar resposta do rascunho vs. producao side-by-side. Publicar com versao registrada no historico.

### G-047 | Export de Relatorios PDF/CSV
Exportar: historico de conversas, metricas de custo por agente/periodo, analytics de tendencia, eval scores. Templates formatados para reunioes de cliente e auditorias.

### G-048 | Config Versioning com Diff e Rollback
Historico de todas as mudancas em SOUL.md/HEARTBEAT.md/CONVERSATION.md. Diff visual linha a linha. Rollback one-click para qualquer versao anterior. Associar versao a eval score para rastrear impacto.

### G-049 | OpenTelemetry Export
Endpoint OTLP compativel com Datadog, Grafana, Langfuse. Exportar traces, metricas de token, latencia e erros em formato padrao. Header de configuracao no Settings.

### G-050 | Rate Limiting e Quotas por Agente
Configurar por agente: limite de tokens/hora, max heartbeats/dia, timeout de tool call. Dashboard de consumo vs. quota. Alertas proxativos. Pausa automatica ao atingir limite com notificacao.

### G-051 | Conectores Slack, Teams e Email
Novos conectores nativos: Slack (canal por workspace), Microsoft Teams (webhook de incoming), Email (IMAP/SMTP com triagem por agente). GUI de configuracao no Hub. Agente como bot de Slack, assistente de Teams ou resposta automatica de email.

---

## Alivios de Dores

| Dor | Produto Atual | Alivia com Sprint 5 |
|-----|--------------|---------------------|
| Risco de banimento WhatsApp | Evolution API nao-oficial | Migracao guiada para Cloud API oficial |
| LGPD sem ferramentas | Nenhuma | LGPD dashboard + DPIA assistido |
| Agentes so reagem a schedule | Heartbeat + Cron | Webhook inbound triggers |
| Silos entre agentes | Nenhum handoff | Supervisor pattern + roteamento |
| Mudancas vao direto para prod | Nenhum | Sandbox + versioning |
| Relatorios manuais | Dashboard sem export | PDF/CSV export |
| Stack de obs fragmentada | Traces internos apenas | OTLP export |
| Custos descontrolados | Alert basico | Quotas + pausa automatica |
| Canais enterprise ausentes | Somente WA + voz | Slack, Teams, Email |

---

## Criadores de Ganho

| Ganho Desejado | Como o Produto Entrega |
|----------------|------------------------|
| Confiabilidade em producao | Sandbox + versioning evitam regressoes cegas |
| Compliance para clientes enterprise | LGPD dashboard + export eliminam bloqueios legais |
| Automacao orientada a eventos | Webhook triggers conectam agentes ao ecossistema de SaaS |
| Escala com menos risco | Rate limiting + quotas garantem previsibilidade de custo |
| Expansao de mercado | Slack/Teams abrem segmento enterprise/B2B |
| Integracao com observabilidade existente | OTLP elimina silos de monitoramento |

---

## Priorizacao — Score 1-10 com Justificativa

| Oportunidade | Score | Justificativa |
|-------------|-------|---------------|
| G-044 Webhook Inbound Triggers | 9 | Desbloqueia automacao orientada a eventos — padrao de mercado 2026; P2/P4 bloqueados sem isso |
| D-042/G-043 LGPD Compliance | 9 | ANPD fiscalizando AI em 2026-2027; risco regulatorio elimina vendas enterprise |
| D-041/G-042 WhatsApp Cloud API | 9 | Risco critico de banimento para usuarios atuais; janela regulatory abriu em marco 2026 |
| D-044/G-045 Multi-agent Orchestration | 8 | Mercado crescendo 67%, ja mapeado como gap desde sprint 3; workflows complexos bloqueados |
| D-049/G-050 Rate Limiting/Quotas | 8 | Sem isso, custos explosivos afastam P1; barreira critica para adocao por PMEs |
| D-050/G-051 Slack/Teams/Email | 7 | Canais enterprise sao requisito de entrada no segmento B2B; diferencial competitivo |
| D-045/G-046 Agent Sandbox | 7 | Inibe experimentacao e inovacao; P2 nao evolui agentes por medo de impacto prod |
| D-047/G-048 Config Versioning | 7 | Debugging de regressao impossivel sem historico; risco operacional crescente com mais agentes |
| D-046/G-047 Export Relatorios | 7 | Bloqueador para P3/P4 venderem valor para stakeholders; compliance |
| D-048/G-049 OpenTelemetry Export | 6 | Importante para P2/P4 com stacks de obs existentes; nao e critico para P1 |
