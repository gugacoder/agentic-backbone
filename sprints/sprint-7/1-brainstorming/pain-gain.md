# Pain-Gain Analysis — Agentic Backbone Hub

**Sprint:** 7 | **Wave:** 7 | **Data:** 2026-03-08

---

## Legenda

- **Tipo:** `pain` = dor / `gain` = ganho
- **Perfis:** P1=Empreendedor PME, P2=Dev/Tecnico, P3=Gestor Operacoes, P4=Consultor/Agencia
- **Score:** 1 (baixo impacto) a 10 (critico)
- **Implementado?:** `sim` = ja existe no produto, `parcial` = existe parcialmente, `nao` = nao implementado

---

## Discoveries do Sprint 1 (reclassificadas no Sprint 7)

| ID | Tipo | Perfil | Descricao | Score (1-10) | Sprint | Implementado? |
|----|------|--------|-----------|--------------|--------|---------------|
| D-001 | pain | P1, P2, P3 | Falta de visibilidade sobre o que o agente esta fazendo — opera como "caixa preta", gerando desconfianca | 10 | 1 | sim |
| D-002 | pain | P1, P3 | Complexidade tecnica para configurar agentes — plataformas existentes exigem codigo (Python, YAML) | 9 | 1 | sim |
| D-003 | pain | P1, P2, P4 | Dificuldade de integrar agentes com WhatsApp — canal dominante no Brasil mas integracao tecnica e cara | 9 | 1 | sim |
| D-004 | pain | P1, P3, P4 | Ausencia de governanca sobre respostas autonomas — risco de respostas inadequadas ou vazamento de dados | 8 | 1 | parcial |
| D-005 | pain | P2, P3, P4 | Fragmentacao de ferramentas — multiplos dashboards, logs e planilhas para operar agentes, sem visao unificada | 8 | 1 | sim |
| D-006 | pain | P1, P4 | Custo e complexidade de infraestrutura cloud — APIs de LLM, bancos vetoriais, provedores fragmentados | 6 | 1 | sim |
| D-007 | pain | P1, P3 | Agendamento de tarefas recorrentes exige cron expressions ou ferramentas de workflow externas | 7 | 1 | sim |
| D-008 | pain | P1, P2 | Memoria e contexto perdidos entre interacoes — chatbots repetem perguntas, frustram usuarios | 8 | 1 | sim |
| D-009 | pain | P3, P4 | Impossibilidade de auditar historico completo das acoes autonomas do agente para compliance | 8 | 1 | parcial |
| D-010 | pain | P1 | Dependencia de consultores externos para qualquer ajuste em agentes — custo recorrente e lentidao | 7 | 1 | sim |
| D-011 | pain | P1, P3 | Incapacidade de definir horarios de funcionamento do agente — opera fora de horario ou nao opera quando deveria | 7 | 1 | sim |
| D-012 | pain | P2, P4 | Falta de gestao multi-agente unificada — cada agente em silo, sem visao de conjunto | 7 | 1 | sim |
| D-013 | pain | P1, P2 | Chatbots tradicionais nao aprendem — respostas estaticas que nao melhoram com o tempo | 8 | 1 | sim |
| G-001 | gain | P1, P3 | Atendimento ao cliente 24/7 sem custo de equipe — agente responde a qualquer hora | 9 | 1 | sim |
| G-002 | gain | P2, P3 | Produtividade amplificada — agentes autonomos (heartbeat) liberam humanos para trabalho estrategico | 7 | 1 | sim |
| G-003 | gain | P2, P3, P4 | Visao unificada e controle centralizado de todos os agentes num unico painel | 10 | 1 | sim |
| G-004 | gain | P1, P2, P4 | Personalizacao da identidade do agente — personalidade, tom e limites definidos pela marca | 7 | 1 | sim |
| G-005 | gain | P1, P3 | Integracao nativa com WhatsApp sem provedores terceiros caros | 9 | 1 | sim |
| G-006 | gain | P1, P2 | Memoria semantica que evolui — agente aprende com o tempo e melhora respostas | 8 | 1 | sim |
| G-007 | gain | P1, P3 | Independencia tecnica — criar e operar agentes sem tocar em codigo, YAML ou terminal | 9 | 1 | sim |
| G-008 | gain | P3, P4 | Auditabilidade completa — historico de tudo que o agente fez, quando e por que | 8 | 1 | parcial |
| G-009 | gain | P1 | Calendario visual de tarefas do agente — agendar sem cron expressions | 7 | 1 | sim |
| G-010 | gain | P2, P4 | Self-hosted sem vendor lock-in — controle total dos dados e custos previsiveis | 6 | 1 | sim |
| G-011 | gain | P1, P3 | Interface em portugues brasileiro — sistema feito para o mercado local | 7 | 1 | sim |
| G-012 | gain | P1 | Onboarding rapido — do zero ao primeiro agente operando em minutos, nao semanas | 8 | 1 | sim |
| G-013 | gain | P3, P4 | Controle de active hours — agente opera apenas em horarios definidos, com flexibilidade | 7 | 1 | sim |

## Discoveries do Sprint 2 (reclassificadas no Sprint 7)

| ID | Tipo | Perfil | Descricao | Score (1-10) | Sprint | Implementado? |
|----|------|--------|-----------|--------------|--------|---------------|
| D-014 | pain | P1, P2, P3, P4 | Falta de visibilidade sobre custos e consumo de tokens LLM — surpresas na fatura bloqueiam adocao | 9 | 2 | sim |
| D-015 | pain | P1, P3, P4 | Ausencia de dashboard com visao geral do sistema — gestor navega multiplas paginas para entender saude | 10 | 2 | sim |
| D-016 | pain | P3, P4 | Ausencia de gestao de usuarios e permissoes — apenas sysuser, sem acesso segmentado por equipe | 9 | 2 | sim |
| D-017 | pain | P1, P4 | Onboarding lento — novo agente comeca do zero sem templates; PMEs perdem tempo configurando basico | 7 | 2 | sim |
| D-018 | pain | P1, P3 | Falhas e eventos criticos passam despercebidos — sem notificacoes push; horas sem atendimento possiveis | 9 | 2 | sim |
| D-019 | pain | P2, P3 | Jobs de longa duracao sem visibilidade — processos rodam sem UI, exigem acesso a logs do servidor | 8 | 2 | sim |
| D-020 | pain | P2, P3 | Raciocinio do agente eh opaco — ve saidas mas nao tool calls, decisoes intermediarias ou "por que" | 7 | 2 | sim |
| D-021 | pain | P2 | Configuracao de LLM requer edicao manual de llm.json — inacessivel para quem nao tem acesso ao servidor | 8 | 2 | sim |
| D-022 | pain | P3, P4 | Sem metricas de efetividade dos agentes ao longo do tempo — decisoes baseadas em intuicao, nao dados | 8 | 2 | sim |
| D-023 | pain | P2, P4 | Agentes operam em silos — sem colaboracao, delegacao ou handoff entre agentes para cenarios complexos | 6 | 2 | sim |
| G-014 | gain | P1, P2, P3, P4 | Dashboard de custos com breakdown por agente/tarefa, budget alerts e comparacao de planos LLM | 9 | 2 | sim |
| G-015 | gain | P1, P3, P4 | Dashboard de sistema — home page com visao panoramica de saude, atividade recente e alertas | 10 | 2 | sim |
| G-016 | gain | P3, P4 | Gestao de equipe com roles (admin/operador/viewer) e controle de acesso segmentado | 9 | 2 | sim |
| G-017 | gain | P1, P4 | Templates de agente para onboarding instantaneo — galeria de configs pre-prontas para casos comuns | 7 | 2 | sim |
| G-018 | gain | P1, P3 | Notificacoes push (PWA) + central de alertas para falhas, completions e limites de custo | 9 | 2 | sim |
| G-019 | gain | P2, P3 | Supervisor de jobs — UI com lista, stdout streaming, metricas CPU/mem e cancelamento | 8 | 2 | sim |
| G-020 | gain | P2 | Selector de plano LLM pela interface — trocar modelo/plano sem editar arquivos de config | 8 | 2 | sim |
| G-021 | gain | P3, P4 | Analytics e metricas de performance — graficos de tendencia, ROI, filtros por agente/periodo | 8 | 2 | sim |
| G-022 | gain | P2, P3 | Transparencia de raciocinio — trace timeline com tool calls e decisoes dentro de heartbeats/conversas | 7 | 2 | sim |
| G-023 | gain | P1, P3 | Voice channels Twilio — setup, gerenciamento de chamadas, transcricoes via interface | 6 | 2 | nao |

## Discoveries do Sprint 3 (reclassificadas no Sprint 7)

| ID | Tipo | Perfil | Descricao | Score (1-10) | Sprint | Implementado? |
|----|------|--------|-----------|--------------|--------|---------------|
| D-024 | pain | P1, P2, P3 | Sem gestao de knowledge base — agente depende de edicao manual de SOUL.md/MEMORY.md, sem upload de docs/PDFs para alimentar RAG | 9 | 3 | sim |
| D-025 | pain | P1, P3, P4 | Sem aprovacao humana para acoes criticas — agente executa acoes impactantes sem checkpoint | 8 | 3 | sim |
| D-026 | pain | P4 | Sem multi-tenancy para agencias — instancia unica, sem isolamento por cliente, sem branding customizavel | 6 | 3 | nao |
| D-027 | pain | P3, P4 | Sem exportacao de relatorios — dashboard real-time mas sem PDF/CSV para compartilhar metricas com stakeholders | 7 | 3 | nao |
| D-028 | pain | P1, P3 | Sem takeover de conversa — operador nao consegue assumir conversa do agente em tempo real | 8 | 3 | sim |
| D-029 | pain | P2, P4 | Sem versionamento de config — edicoes em SOUL.md/HEARTBEAT.md sobrescrevem sem historico ou rollback | 7 | 3 | sim |
| D-030 | pain | P1, P2, P3, P4 | Sem metricas de custo por agente — dashboard mostra total do dia mas nao detalha por agente/operacao/periodo | 10 | 3 | sim |
| D-031 | pain | P3, P4 | Sem analytics de tendencia — nao ha graficos de evolucao temporal; impossivel responder "o agente melhora?" | 9 | 3 | sim |
| D-032 | pain | P2, P3 | Raciocinio do agente opaco — sem trace de tool calls e decisoes; debugging requer acesso a spawn.jsonl no servidor | 9 | 3 | sim |
| D-033 | pain | P2, P4 | Agentes operam em silos — sem handoff, delegacao ou compartilhamento de contexto entre agentes | 8 | 3 | sim |
| G-024 | gain | P1, P2, P3 | Knowledge base com upload de docs — alimentar agente com PDFs, FAQs, procedimentos via RAG indexado automaticamente | 9 | 3 | sim |
| G-025 | gain | P1, P3, P4 | Workflows de aprovacao humana — checkpoint configuravel antes de acoes criticas, com notificacao e timeout | 8 | 3 | sim |
| G-026 | gain | P4 | Multi-tenancy com branding — cada cliente da agencia como tenant isolado com logo, cores e dados separados | 6 | 3 | nao |
| G-027 | gain | P3, P4 | Exportacao de relatorios PDF/CSV — metricas, custos e historico exportaveis e compartilhaveis | 7 | 3 | nao |
| G-028 | gain | P1, P3 | Takeover de conversa — operador assume do agente em tempo real, agente retoma quando operador finaliza | 8 | 3 | sim |
| G-029 | gain | P2, P4 | Versionamento de config — historico de mudancas com diff visual e rollback one-click para configs de agente | 7 | 3 | sim |
| G-030 | gain | P1, P2, P3, P4 | Dashboard de custos granular — breakdown por agente/operacao, tendencias, budget alerts, comparador de planos LLM | 10 | 3 | sim |
| G-031 | gain | P3, P4 | Analytics com graficos de tendencia — conversas/dia, custo/semana, taxa de erro temporal, anomaly detection | 9 | 3 | sim |
| G-032 | gain | P2, P3 | Trace timeline — arvore de decisoes com tool calls, tokens por step, tempo de cada etapa, replay visual | 9 | 3 | sim |
| G-033 | gain | P1, P4 | Templates de agente + wizard — galeria pre-configurada para onboarding em 2 minutos, SOUL.md pre-pronto | 7 | 3 | sim |
| G-034 | gain | P2, P4 | Orquestracao multi-agente — handoff por regras, roteamento de conversas, contexto compartilhado | 8 | 3 | sim |

## Discoveries do Sprint 4 (reclassificadas no Sprint 7)

| ID | Tipo | Perfil | Descricao | Score (1-10) | Sprint | Implementado? |
|----|------|--------|-----------|--------------|--------|---------------|
| D-034 | pain | P1, P2, P3, P4 | Sem avaliacao sistematica de qualidade — mudancas em instrucoes podem degradar agente sem que operador perceba | 9 | 4 | sim |
| D-035 | pain | P2, P3, P4 | Sem protecao contra prompt injection — agente manipulavel por usuarios mal-intencionados | 8 | 4 | sim |
| D-036 | pain | P1, P2, P4 | Sem GUI para gerenciar adaptadores — criar/editar conectores exige edicao manual de YAML no filesystem | 8 | 4 | sim |
| D-037 | pain | P1, P2, P3 | Sem feedback de usuarios sobre respostas — agente nao tem sinal de qualidade percebida | 8 | 4 | sim |
| D-038 | pain | P2, P3, P4 | Sem sandbox de agente — mudancas vao direto para producao sem ambiente de teste isolado | 7 | 4 | sim |
| D-039 | pain | P1, P2, P3 | Sem integracao nativa com Google Calendar/Sheets/Notion — agente nao acessa dados do negocio em tempo real | 7 | 4 | nao |
| D-040 | pain | P1, P3, P4 | Fragmentacao de canais — conversas de WhatsApp, chat web e voz gerenciadas em paginas separadas | 7 | 4 | sim |
| G-035 | gain | P2, P3, P4 | Avaliacao automatica de agentes — golden sets + LLM-as-judge + score historico + comparacao de versoes | 9 | 4 | sim |
| G-036 | gain | P2, P3, P4 | Monitoramento de seguranca — deteccao de prompt injection, baseline de comportamento, alertas de anomalia | 8 | 4 | sim |
| G-037 | gain | P1, P2, P4 | GUI de adaptadores — pagina /adapters com CRUD visual de conectores e test de conexao | 8 | 4 | sim |
| G-038 | gain | P1, P2, P3 | Feedback loop — thumbs up/down em mensagens + motivo + dashboard de qualidade + export para golden sets | 8 | 4 | sim |
| G-039 | gain | P2, P3, P4 | Sandbox de agente — clonar agente como rascunho isolado, testar via chat, comparar vs. producao side-by-side | 7 | 4 | sim |
| G-040 | gain | P1, P2, P3 | Integracao Google Calendar — adaptador OAuth2, agente consulta/cria eventos, cron jobs baseados em Calendar | 7 | 4 | nao |
| G-041 | gain | P1, P3, P4 | Hub unificado de mensagens (/inbox) — todas as conversas ativas de todos os canais, SSE em tempo real | 7 | 4 | sim |

## Discoveries do Sprint 5 (reclassificadas no Sprint 7)

| ID | Tipo | Perfil | Descricao | Score (1-10) | Sprint | Implementado? |
|----|------|--------|-----------|--------------|--------|---------------|
| D-041 | pain | P1, P2, P3, P4 | WhatsApp via Evolution API: risco de banimento — migracao para Cloud API oficial necessaria | 9 | 5 | sim |
| D-042 | pain | P3, P4 | Conformidade LGPD sem ferramentas — ANPD priorizou AI para fiscalizacao 2026-2027 | 9 | 5 | parcial |
| D-043 | pain | P2, P3, P4 | Sem triggers externos por webhook — agentes so reagem a heartbeat ou mensagem de usuario | 8 | 5 | sim |
| D-044 | pain | P2, P3, P4 | Orquestracao multi-agente inexistente — workflows complexos com handoff requerem codigo customizado | 8 | 5 | sim |
| D-045 | pain | P1, P2, P3 | Sem controles de rate limiting e quotas por agente — agente mal configurado consome tokens sem limite | 8 | 5 | sim |
| D-046 | pain | P1, P3, P4 | Sem canais enterprise (Slack, Teams, Email) — WhatsApp atende consumidor final mas B2B precisa mais | 7 | 5 | sim |
| D-047 | pain | P2, P3, P4 | Telemetria nao exportavel para stacks externas — sem endpoint OTLP; silos de observabilidade | 6 | 5 | nao |
| D-048 | pain | P2, P4 | Sem sandbox de agente (D-038 reafirmado) — experimentacao inibida porque mudancas vao para producao | 7 | 5 | sim |
| D-049 | pain | P2, P4 | Sem versionamento de config de agente (D-029 reafirmado) — rollback exige SSH ao servidor | 7 | 5 | sim |
| D-050 | pain | P3, P4 | Sem exportacao de relatorios (D-027 reafirmado) — capturam screenshots para reunioes de cliente | 7 | 5 | nao |
| G-042 | gain | P1, P2, P3, P4 | WhatsApp Cloud API oficial — migracao guiada para API oficial da Meta, eliminando risco de banimento | 9 | 5 | sim |
| G-043 | gain | P3, P4 | LGPD Compliance Dashboard — mapa de dados pessoais, DPIA assistido, canal de direitos de titular | 9 | 5 | parcial |
| G-044 | gain | P2, P3, P4 | Webhook Inbound Triggers — endpoint HTTP por agente para receber eventos externos; filtros, HMAC | 9 | 5 | sim |
| G-045 | gain | P2, P3, P4 | Orquestracao Multi-Agente — supervisor-agent pattern via GUI; handoff de tarefas; roteamento por intencao | 8 | 5 | sim |
| G-046 | gain | P2, P3, P4 | Rate Limiting e Quotas por Agente — limite de tokens/hora, max heartbeats/dia, pausa automatica | 8 | 5 | sim |
| G-047 | gain | P1, P3, P4 | Conectores Slack, Teams e Email — novos conectores nativos; agente como bot de Slack/Teams/email | 7 | 5 | sim |
| G-048 | gain | P2, P3, P4 | Agent Sandbox — clonar agente como rascunho isolado; comparar rascunho vs. producao side-by-side | 7 | 5 | sim |
| G-049 | gain | P2, P4 | Config Versioning com Diff e Rollback — historico de mudancas; diff visual; rollback one-click | 7 | 5 | sim |
| G-050 | gain | P3, P4 | Export de Relatorios PDF/CSV — historico de conversas, metricas de custo, analytics, eval scores | 7 | 5 | nao |
| G-051 | gain | P2, P3 | OpenTelemetry Export — endpoint OTLP compativel com Datadog, Grafana, Langfuse; configuracao no Settings | 6 | 5 | nao |

## Discoveries do Sprint 6 (reclassificadas no Sprint 7)

| ID | Tipo | Perfil | Descricao | Score (1-10) | Sprint | Implementado? |
|----|------|--------|-----------|--------------|--------|---------------|
| D-051 | pain | P1, P2, P3 | Sem feedback loop de qualidade com rating de usuario — LLM-as-judge nao captura satisfacao real | 8 | 6 | sim |
| D-052 | pain | P1, P3, P4 | Conector Email (IMAP/SMTP) ausente — canal dominante para comunicacao B2B formal | 8 | 6 | sim |
| D-053 | pain | P3, P4 | Export de relatorios PDF/CSV bloqueado — gestores tiram screenshots; impossivel demonstrar ROI formalmente | 7 | 6 | nao |
| D-054 | pain | P2, P4 | Sem suporte a MCP (Model Context Protocol) — padrao universal com 97M downloads/mes; 1200+ servidores | 9 | 6 | sim |
| D-055 | pain | P1, P4 | Sem marketplace de templates de agente compartilhaveis — agencias recriam configs para cada cliente | 7 | 6 | nao |
| D-056 | pain | P1, P2, P3 | Sem otimizacao inteligente de custos LLM — task simples usa mesmo modelo que task complexa | 8 | 6 | sim |
| D-057 | pain | P1, P3 | Sem suporte a WhatsApp Business Calling — canal de voz via WhatsApp aberto para Brasil em marco 2026 | 7 | 6 | nao |
| D-058 | pain | P1, P3, P4 | Sem visual workflow builder para orquestracao — handoffs exigem edicao de YAML; P1 nao consegue usar | 8 | 6 | sim |
| D-059 | pain | P1, P3 | Sem integracao Google Workspace (Calendar + Sheets + Drive) — agentes desconectados de dados do negocio | 7 | 6 | nao |
| D-060 | pain | P4 | Sem multi-tenancy para agencias — instancia unica sem isolamento de dados por cliente | 7 | 6 | nao |
| D-061 | pain | P2, P3 | OpenTelemetry nao exportavel (D-047 reafirmado) — times com Datadog/Grafana nao integram Backbone | 6 | 6 | nao |
| G-052 | gain | P1, P2, P3 | Feedback loop com rating de usuario — thumbs up/down + dashboard de aprovacao + export para golden sets | 8 | 6 | sim |
| G-053 | gain | P1, P3, P4 | Email connector (IMAP/SMTP) nativo com GUI no Hub — agente como inbox de email com tools reply/forward | 8 | 6 | sim |
| G-054 | gain | P3, P4 | Export de relatorios PDF/CSV formatados — filtros por agente/periodo/canal; download direto pela UI | 7 | 6 | nao |
| G-055 | gain | P2, P4 | Suporte MCP como cliente e servidor — agentes conectam a 1200+ ferramentas MCP; expostos como servidor MCP | 9 | 6 | sim |
| G-056 | gain | P1, P2, P3 | Model Routing inteligente por complexidade — heartbeat simples -> modelo economico; economia ate 80% | 8 | 6 | sim |
| G-057 | gain | P1, P3 | WhatsApp Business Calling — agente atende chamadas de voz via WhatsApp; transcricao em tempo real | 7 | 6 | nao |
| G-058 | gain | P1, P3, P4 | Visual Workflow Builder — canvas drag-and-drop para orquestracao multi-agent; gera YAML automaticamente | 8 | 6 | sim |
| G-059 | gain | P1, P3 | Integracao Google Workspace (Calendar, Sheets, Drive) via OAuth2 — config via GUI com OAuth flow | 7 | 6 | nao |
| G-060 | gain | P4 | Multi-tenancy para agencias — tenants isolados com branding customizavel e billing separado | 7 | 6 | nao |
| G-061 | gain | P2, P3 | Agent Performance Benchmarking automatico — comparar score vs. versao anterior ao publicar instrucoes | 7 | 6 | sim |

## Discoveries do Sprint 7 (novas)

| ID | Tipo | Perfil | Descricao | Score (1-10) | Sprint | Implementado? |
|----|------|--------|-----------|--------------|--------|---------------|
| D-062 | pain | P1, P3, P4 | Falha silenciosa e cascata em agentes autonomos — sem kill-switch por agente; sem circuit-breaker automatico; IBM reportou agente aprovando reembolsos fora de política indefinidamente (CNBC, marco 2026); EU AI Act exige parada de emergencia para sistemas high-risk a partir de agosto 2026 | 9 | 7 | nao |
| D-063 | pain | P3, P4 | EU AI Act aplicavel em agosto 2026 — plataforma sem toolkit de conformidade; exige classificacao de risco, supervisao humana documentada, explicabilidade de decisoes automatizadas; agencias com clientes europeus expostas a multas; janela de conformidade se fechando | 9 | 7 | nao |
| D-064 | pain | P3, P4 | Gestao de frota de agentes em escala — sem Fleet Dashboard consolidado; habilitacao individual por tela nao escala para 20-50+ agentes; sem operacoes em lote; Gartner preve 40% dos apps enterprise com agentes por tarefa (dezenas de agentes por org) | 8 | 7 | nao |
| D-065 | pain | P2, P3 | OpenTelemetry nao exportavel (D-047/D-061 reafirmados — 3 sprints) — 70% dos deployments enterprise de AI em 2026 usam OTel; New Relic lancou ferramentas AI OTel em fev/2026; P2/P3 com Datadog/Grafana/Langfuse nao conseguem integrar dados do Backbone | 8 | 7 | nao |
| D-066 | pain | P4 | Sem billing e invoicing por cliente para agencias — sem breakdown de consumo por tenant; calculo de custo para repasse e manual e impreciso; bloqueia modelo de negocio de reseller/SaaS; sem geracao de invoice ou relatorio de faturamento por cliente | 8 | 7 | nao |
| D-067 | pain | P1, P3 | Agentes apenas reativos — sem capacidade de outreach proativo baseado em evento de negocio; nao iniciam conversa por condicao (cliente inativo 30 dias, ticket aberto 24h, lead parado no funil); CRMs com IA proativa reportam 3x mais conversao (2026) | 8 | 7 | nao |
| D-068 | pain | P3, P4 | Export de relatorios PDF/CSV (D-053 reafirmado — 4 sprints) — ANPD publicou Mapa Prioritarios 2026-2027; fiscalizacoes mais tecnicas e profundas; gestores precisam evidencia formal do que agentes processaram; screenshots sao insustentaveis para auditoria | 7 | 7 | nao |
| D-069 | pain | P1, P4 | Sem marketplace de templates de agente (D-055 reafirmado) — agencias recriam configs similares para cada cliente; PMEs nao descobrem configuracoes otimizadas; Relevance AI, n8n, Voiceflow ja tem galerias publicas; sem efeito de rede | 7 | 7 | nao |
| D-070 | pain | P1, P3 | WhatsApp Business Calling sem suporte (D-057 reafirmado) — canal aberto para Brasil em marco 2026; window first-mover se fechando; PMEs aguardam desde Sprint 5; concorrentes lancando suporte | 7 | 7 | nao |
| D-071 | pain | P1, P3 | Google Workspace nao integrado (D-059 reafirmado — 4 sprints) — 65%+ das PMEs brasileiras usam Google Workspace; agentes desconectados de dados reais do negocio; operadores copiam dados manualmente | 7 | 7 | nao |
| G-062 | gain | P1, P3, P4 | Kill-switch e circuit-breaker por agente — botao de parada de emergencia por agente com bloqueio imediato; circuit-breaker automatico (X falhas em Y minutos -> pausa + alerta); limite de acoes por hora/dia; log de acao interrompida com contexto; requisito EU AI Act high-risk | 9 | 7 | nao |
| G-063 | gain | P3, P4 | EU AI Act Compliance Toolkit — checklist de conformidade por agente (classificacao high-risk vs. limited); documentacao de supervisao humana exportavel; explicabilidade de decisoes automatizadas (por que o agente fez X); registro de versao de instrucoes usadas; template DPIA; relatorio para auditorias | 9 | 7 | nao |
| G-064 | gain | P3, P4 | Fleet Management Dashboard — pagina /fleet com grid de todos os agentes: status, saude, consumo, alertas; operacoes em lote (enable/disable/restart/trigger heartbeat de multiplos agentes); filtros por owner/status/saude; SSE em tempo real; cards mobile, grid denso web | 8 | 7 | nao |
| G-065 | gain | P2, P3 | OpenTelemetry Export — endpoint OTLP com GenAI Semantic Conventions 2025; exporta traces de heartbeats, conversas, cron, tool calls, MCP calls; compativel com Datadog, Grafana, Langfuse, New Relic, VictoriaMetrics; configuracao no Settings (endpoint, headers, sampling, filtros por agente) | 8 | 7 | nao |
| G-066 | gain | P4 | Billing e Invoicing por Tenant — relatorio de consumo por tenant (tokens/modelo/agente, custo com markup configuravel); geracao de invoice PDF white-label (logo da agencia); export CSV para ERP/NFS-e; historico mensal; dashboard de rentabilidade (custo infra vs. receita por cliente) | 8 | 7 | nao |
| G-067 | gain | P1, P3 | Outreach Proativo por Agente — agente inicia conversa baseado em trigger configuravel (webhook com payload especifico, schedule com condicao de memoria avaliada, status de job); destinatario (usuario, canal WhatsApp/Slack/Teams); limite de frequencia; historico de outreach com status de entrega | 8 | 7 | nao |
| G-068 | gain | P3, P4 | Export de Relatorios PDF/CSV — historico de conversas, custos, eval scores, LGPD compliance, audit trail de acoes autonomas; templates formatados para reunioes e auditorias; filtros por agente/canal/periodo; ANPD-ready (relatorio de dados pessoais processados por agente) | 7 | 7 | nao |
| G-069 | gain | P1, P4 | Template Marketplace — galeria de templates com casos de uso pre-configurados (atendimento, vendas, RH, financeiro); import com um clique (cria agente com SOUL.md, CONVERSATION.md, cron jobs, adaptadores pre-configurados); categorias por setor; rating da comunidade; agencias publicam templates privados reutilizaveis entre clientes | 7 | 7 | nao |
| G-070 | gain | P1, P3 | WhatsApp Business Calling — agente atende chamadas de voz recebidas via WhatsApp Cloud API; transcricao em tempo real <1s (Deepgram/Whisper via Groq); resposta sintetizada (TTS); contexto compartilhado com historico de texto do mesmo numero; log de chamadas no Hub; config no adaptador WhatsApp existente | 7 | 7 | nao |
| G-071 | gain | P1, P3 | Google Workspace Integration — adaptador OAuth2 via GUI (OAuth flow integrado, sem API key manual); tools: calendar_list_events, calendar_create_event, sheets_read, sheets_write, drive_list_files, drive_read_file; cron jobs disparados por eventos de Calendar; revogacao de acesso via Hub | 7 | 7 | nao |

---

## Resumo por Score (acumulado Sprint 1 ao Sprint 7)

| Score | Items |
|-------|-------|
| 10 | D-001, D-015, D-030, G-003, G-015, G-030 |
| 9 | D-002, D-003, D-014, D-016, D-018, D-024, D-031, D-032, D-034, D-041, D-042, D-054, D-062, D-063, G-001, G-005, G-007, G-014, G-016, G-018, G-024, G-031, G-032, G-035, G-042, G-043, G-044, G-055, G-062, G-063 |
| 8 | D-004, D-005, D-008, D-009, D-013, D-019, D-021, D-022, D-025, D-028, D-033, D-035, D-036, D-037, D-043, D-044, D-045, D-051, D-052, D-056, D-058, D-064, D-065, D-066, D-067, G-006, G-008, G-012, G-019, G-020, G-021, G-025, G-028, G-034, G-036, G-037, G-038, G-045, G-046, G-052, G-053, G-056, G-058, G-064, G-065, G-066, G-067 |
| 7 | D-007, D-010, D-011, D-012, D-017, D-020, D-023, D-026, D-027, D-029, D-038, D-039, D-040, D-046, D-048, D-049, D-050, D-053, D-055, D-057, D-059, D-060, D-068, D-069, D-070, D-071, G-002, G-004, G-009, G-011, G-013, G-017, G-022, G-026, G-027, G-029, G-033, G-039, G-040, G-041, G-047, G-048, G-049, G-050, G-054, G-057, G-059, G-060, G-061, G-068, G-069, G-070, G-071 |
| 6 | D-006, D-023, D-047, D-061, G-010, G-023, G-051 |

---

## Notas sobre Implementacao (Sprint 7)

### Implementadas no Sprint 6 — atualizadas para `sim`

- **D-051/G-052** (Feedback loop + rating de usuario) — F-127/128/129 passing → `sim`
- **D-052/G-053** (Email connector) — F-133/134/135 passing → `sim`
- **D-054/G-055** (MCP support) — F-123/124/125/126 passing → `sim`
- **D-056/G-056** (Model routing inteligente) — F-130/131/132 passing → `sim`
- **D-058/G-058** (Visual workflow builder) — F-136/137/138 passing → `sim`
- **G-061** (Agent Performance Benchmarking) — F-139/140/141 passing → `sim`
- **D-037/G-038** (Feedback loop de qualidade) — consolidado com D-051/G-052 → `sim`

### Nao implementadas — backlog persistente para Sprint 7+

**Score 9 (critico — novas descobertas Sprint 7):**
- D-062/G-062: Kill-switch + circuit-breaker por agente — risco operacional real (IBM case); EU AI Act
- D-063/G-063: EU AI Act Compliance Toolkit — aplicavel agosto 2026; janela critica

**Score 8 (alta prioridade):**
- D-064/G-064: Fleet Management Dashboard — novo Sprint 7; Gartner 40% apps com agentes
- D-065/G-065: OpenTelemetry (3 sprints pendente) — 70% enterprise AI usa OTel
- D-066/G-066: Billing por Tenant — novo Sprint 7; bloqueia modelo reseller
- D-067/G-067: Outreach Proativo — novo Sprint 7; 3x mais conversao vs. reativo

**Score 7 (media prioridade):**
- D-068/G-068: Export relatorios (4 sprints pendente) — ANPD fiscaliza com mais rigor
- D-069/G-069: Template Marketplace — efeito de rede e onboarding
- D-070/G-070: WA Business Calling — primeiro canal aberto mar/2026; urgente
- D-071/G-071: Google Workspace (4 sprints pendente) — PMEs BR sem acesso a dados reais
- D-060/G-060: Multi-tenancy (4 sprints pendente) — modelo agencia nao escalavel
- D-027/D-050/D-053 (export relatorios): todas convergem para G-068

**Score 6 (baixa prioridade):**
- D-023/G-023: Voice Twilio GUI — conector existe, GUI incompleta
- D-047/D-061: OTel — reafirmado como D-065 com score 8 neste sprint
