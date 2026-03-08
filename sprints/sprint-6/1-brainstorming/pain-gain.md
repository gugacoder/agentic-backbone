# Pain-Gain Analysis — Agentic Backbone Hub

**Sprint:** 6 | **Wave:** 6 | **Data:** 2026-03-07

---

## Legenda

- **Tipo:** `pain` = dor / `gain` = ganho
- **Perfis:** P1=Empreendedor PME, P2=Dev/Tecnico, P3=Gestor Operacoes, P4=Consultor/Agencia
- **Score:** 1 (baixo impacto) a 10 (critico)
- **Implementado?:** `sim` = ja existe no produto, `parcial` = existe parcialmente, `nao` = nao implementado

---

## Discoveries do Sprint 1 (reclassificadas no Sprint 6)

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

## Discoveries do Sprint 2 (reclassificadas no Sprint 6)

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

## Discoveries do Sprint 3 (reclassificadas no Sprint 6)

| ID | Tipo | Perfil | Descricao | Score (1-10) | Sprint | Implementado? |
|----|------|--------|-----------|--------------|--------|---------------|
| D-024 | pain | P1, P2, P3 | Sem gestao de knowledge base — agente depende de edicao manual de SOUL.md/MEMORY.md, sem upload de docs/PDFs para alimentar RAG | 9 | 3 | sim |
| D-025 | pain | P1, P3, P4 | Sem aprovacao humana para acoes criticas — agente executa acoes impactantes sem checkpoint; controle limitado a on/off | 8 | 3 | sim |
| D-026 | pain | P4 | Sem multi-tenancy para agencias — instancia unica, sem isolamento por cliente, sem branding customizavel | 6 | 3 | nao |
| D-027 | pain | P3, P4 | Sem exportacao de relatorios — dashboard real-time mas sem PDF/CSV para compartilhar metricas com stakeholders | 7 | 3 | nao |
| D-028 | pain | P1, P3 | Sem takeover de conversa — operador nao consegue assumir conversa do agente em tempo real quando necessario | 8 | 3 | sim |
| D-029 | pain | P2, P4 | Sem versionamento de config — edicoes em SOUL.md/HEARTBEAT.md sobrescrevem sem historico, diff ou rollback | 7 | 3 | sim |
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

## Discoveries do Sprint 4 (reclassificadas no Sprint 6)

| ID | Tipo | Perfil | Descricao | Score (1-10) | Sprint | Implementado? |
|----|------|--------|-----------|--------------|--------|---------------|
| D-034 | pain | P1, P2, P3, P4 | Sem avaliacao sistematica de qualidade — mudancas em instrucoes podem degradar agente sem que operador perceba; nao ha golden sets, LLM-as-judge ou regressao de qualidade | 9 | 4 | sim |
| D-035 | pain | P2, P3, P4 | Sem protecao contra prompt injection — agente manipulavel por usuarios mal-intencionados que podem vazar dados internos, ignorar instrucoes ou acionar tools indevidamente | 8 | 4 | sim |
| D-036 | pain | P1, P2, P4 | Sem GUI para gerenciar adaptadores — criar/editar conectores (MySQL, Postgres, APIs) exige edicao manual de YAML no filesystem; inacessivel para P1 nao-tecnico | 8 | 4 | sim |
| D-037 | pain | P1, P2, P3 | Sem feedback de usuarios sobre respostas — agente nao tem sinal de qualidade percebida; operador nao sabe quais respostas foram ruins ou identificar padroes de falha | 8 | 4 | nao |
| D-038 | pain | P2, P3, P4 | Sem sandbox de agente — mudancas em SOUL.md, instrucoes e ferramentas vao direto para producao sem ambiente de teste isolado; inibe experimentacao e aumenta risco | 7 | 4 | sim |
| D-039 | pain | P1, P2, P3 | Sem integracao nativa com ferramentas de produtividade (Google Calendar, Google Sheets, Notion) — agente nao acessa dados do negocio em tempo real; operador copia dados manualmente | 7 | 4 | nao |
| D-040 | pain | P1, P3, P4 | Fragmentacao de canais — conversas de WhatsApp, chat web e voz gerenciadas em paginas separadas; sem visao panoramica de todas as conversas ativas de todos os canais | 7 | 4 | sim |
| G-035 | gain | P2, P3, P4 | Avaliacao automatica de agentes — golden sets configuravel + LLM-as-judge + score historico + comparacao de versoes de instrucoes antes de publicar | 9 | 4 | sim |
| G-036 | gain | P2, P3, P4 | Monitoramento de seguranca — deteccao de prompt injection, baseline de comportamento (UEBA), alertas de anomalia, dashboard de eventos bloqueados | 8 | 4 | sim |
| G-037 | gain | P1, P2, P4 | GUI de adaptadores — pagina /adapters com CRUD visual de conectores, campos dinamicos por tipo, test de conexao, mascaramento automatico de credenciais sensiveis | 8 | 4 | sim |
| G-038 | gain | P1, P2, P3 | Feedback loop — thumbs up/down em mensagens do agente + motivo opcional + dashboard de qualidade por agente + export de baixo-avaliados para golden sets | 8 | 4 | nao |
| G-039 | gain | P2, P3, P4 | Sandbox de agente — clonar agente como rascunho isolado, testar via chat sem afetar producao, comparar resposta atual vs. rascunho side-by-side, publicar com versionamento | 7 | 4 | sim |
| G-040 | gain | P1, P2, P3 | Integracao Google Calendar — adaptador OAuth2, agente consulta/cria eventos, cron jobs baseados em eventos de calendario, configuracao via GUI | 7 | 4 | nao |
| G-041 | gain | P1, P3, P4 | Hub unificado de mensagens (/inbox) — todas as conversas ativas de todos os canais, filtros por canal/agente/status, metricas consolidadas, SSE em tempo real | 7 | 4 | sim |

## Discoveries do Sprint 5 (reclassificadas no Sprint 6)

| ID | Tipo | Perfil | Descricao | Score (1-10) | Sprint | Implementado? |
|----|------|--------|-----------|--------------|--------|---------------|
| D-041 | pain | P1, P2, P3, P4 | WhatsApp via Evolution API: risco de banimento — Meta bane numeros nao-oficiais; Cloud API oficial aberta para Brasil em marco 2026 mas migracao nao existe no Hub | 9 | 5 | sim |
| D-042 | pain | P3, P4 | Conformidade LGPD sem ferramentas — ANPD priorizou AI para fiscalizacao 2026-2027; operadores nao sabem quais dados pessoais o agente processa, nao tem DPIA nem canal de direitos de titular | 9 | 5 | parcial |
| D-043 | pain | P2, P3, P4 | Sem triggers externos por webhook — agentes so reagem a heartbeat (intervalo fixo) ou mensagem de usuario; nao podem ser ativados por eventos externos de SaaS (ticket, pagamento, commit, lead) | 8 | 5 | sim |
| D-044 | pain | P2, P3, P4 | Orquestracao multi-agente inexistente — 50% dos agentes em producao operam em silos (Salesforce 2026); workflows complexos com handoff e supervisor pattern requerem codigo customizado | 8 | 5 | sim |
| D-045 | pain | P1, P2, P3 | Sem controles de rate limiting e quotas por agente — agente mal configurado consome tokens sem limite, gerando custos explosivos; sem throttle, pausa automatica ou alerta proativo | 8 | 5 | sim |
| D-046 | pain | P1, P3, P4 | Sem canais enterprise (Slack, Teams, Email) — WhatsApp atende consumidor final, mas P3/P4 precisam de agentes em Slack, Microsoft Teams e Email para casos enterprise e B2B | 7 | 5 | parcial |
| D-047 | pain | P2, P3, P4 | Telemetria nao exportavel para stacks externas — sem endpoint OTLP; times com Datadog/Grafana/Langfuse nao conseguem integrar dados do backbone; silos de observabilidade | 6 | 5 | nao |
| D-048 | pain | P2, P4 | Sem sandbox de agente (D-038 reafirmado) — experimentacao inibida porque mudancas vao direto para producao; comparacao before/after impossivel sem filesystem access | 7 | 5 | sim |
| D-049 | pain | P2, P4 | Sem versionamento de config de agente (D-029 reafirmado) — regressoes de qualidade impossiveis de rastrear; rollback exige SSH ao servidor | 7 | 5 | sim |
| D-050 | pain | P3, P4 | Sem exportacao de relatorios (D-027 reafirmado) — operadores capturam screenshots para reunioes de cliente; impossibilita demonstrar ROI com dados formais | 7 | 5 | nao |
| G-042 | gain | P1, P2, P3, P4 | WhatsApp Cloud API oficial — migracao guiada para API oficial da Meta, eliminando risco de banimento e abrindo acesso a recursos premium (botoes, flows, Business Calling) | 9 | 5 | sim |
| G-043 | gain | P3, P4 | LGPD Compliance Dashboard — mapa de dados pessoais por agente, DPIA assistido, canal de direitos de titular (acesso/correcao/exclusao), log de consentimentos, relatorio exportavel para ANPD | 9 | 5 | parcial |
| G-044 | gain | P2, P3, P4 | Webhook Inbound Triggers — endpoint HTTP por agente para receber eventos externos; configuracao de filtros, autenticacao HMAC, mapeamento de payload; reacao imediata a eventos de SaaS | 9 | 5 | sim |
| G-045 | gain | P2, P3, P4 | Orquestracao Multi-Agente — supervisor-agent pattern via GUI; handoff de tarefas; roteamento por intencao detectada; passagem de contexto; historico unificado de conversa multi-agente | 8 | 5 | sim |
| G-046 | gain | P2, P3, P4 | Rate Limiting e Quotas por Agente — configurar limite de tokens/hora, max heartbeats/dia, timeout de tool call; pausa automatica ao atingir limite com notificacao; dashboard de consumo vs. quota | 8 | 5 | sim |
| G-047 | gain | P1, P3, P4 | Conectores Slack, Teams e Email — novos conectores nativos; agente como bot de Slack, assistente de Teams ou resposta automatica de email; GUI de configuracao no Hub | 7 | 5 | parcial |
| G-048 | gain | P2, P3, P4 | Agent Sandbox — clonar agente como rascunho isolado; chat de teste sem afetar producao; comparar resposta rascunho vs. producao side-by-side; publicar com versao registrada | 7 | 5 | sim |
| G-049 | gain | P2, P4 | Config Versioning com Diff e Rollback — historico de mudancas em SOUL.md/HEARTBEAT.md/CONVERSATION.md; diff visual linha a linha; rollback one-click; associar versao a eval score | 7 | 5 | sim |
| G-050 | gain | P3, P4 | Export de Relatorios PDF/CSV — historico de conversas, metricas de custo, analytics e eval scores; templates formatados para reunioes de cliente e auditorias internas | 7 | 5 | nao |
| G-051 | gain | P2, P3 | OpenTelemetry Export — endpoint OTLP compativel com Datadog, Grafana, Langfuse; exportar traces, metricas de token, latencia e erros em formato padrao; configuracao no Settings | 6 | 5 | nao |

## Discoveries do Sprint 6 (novas)

| ID | Tipo | Perfil | Descricao | Score (1-10) | Sprint | Implementado? |
|----|------|--------|-----------|--------------|--------|---------------|
| D-051 | pain | P1, P2, P3 | Sem feedback loop de qualidade com rating de usuario — LLM-as-judge interno nao captura satisfacao real do usuario final; padroes de falha invisíveis sem sinal humano; impossível melhoria contínua baseada em experiencia percebida | 8 | 6 | nao |
| D-052 | pain | P1, P3, P4 | Conector Email (IMAP/SMTP) ausente — Slack e Teams implementados no Sprint 5 mas Email permanece pendente (F-118); canal dominante para comunicacao B2B formal; agencias nao conseguem automatizar inbox de clientes via Hub | 8 | 6 | nao |
| D-053 | pain | P3, P4 | Export de relatorios PDF/CSV bloqueado (F-126-128 pending) — gestores tiram screenshots do dashboard para reunioes; insustentavel para compliance e auditoria; impossivel demonstrar ROI formalmente a stakeholders | 7 | 6 | nao |
| D-054 | pain | P2, P4 | Sem suporte a MCP (Model Context Protocol) — padrao universal com 97M downloads/mes em 2026 e 1200+ servidores; devs e agencias nao conseguem conectar agentes do Backbone ao ecossistema MCP sem codigo customizado; sistema de adaptadores proprietario nao interopera | 9 | 6 | nao |
| D-055 | pain | P1, P4 | Sem marketplace de templates de agente compartilhaveis — templates existem por instancia mas nao sao exportaveis/importaveis; agencias recriam configs similares para cada cliente; PMEs nao descobrem configuracoes otimizadas para seus casos de uso | 7 | 6 | nao |
| D-056 | pain | P1, P2, P3 | Sem otimizacao inteligente de custos LLM por complexidade — task simples (heartbeat, FAQ) usa mesmo modelo que task complexa (analise, codigo); cost-per-task poderia cair 60-80% com model routing; nenhuma regra de roteamento configuravel existe | 8 | 6 | nao |
| D-057 | pain | P1, P3 | Sem suporte a WhatsApp Business Calling — canal de voz via WhatsApp aberto para Brasil em marco 2026 com Cloud API; agentes nao recebem chamadas de voz WhatsApp; Twilio connector so suporta telefonia tradicional; PMEs de atendimento perdem canal de alto valor | 7 | 6 | nao |
| D-058 | pain | P1, P3, P4 | Sem visual workflow builder para orquestracao de agentes — handoffs implementados mas exigem edicao de YAML; P1 nao-tecnico nao consegue desenhar fluxos entre agentes sem programar; concorrentes (n8n, Make) oferecem canvas visual; gap critico para adocao mainstream | 8 | 6 | nao |
| D-059 | pain | P1, P3 | Sem integracao Google Workspace (Calendar + Sheets + Drive) — identificado Sprint 4 (D-039), persistente ate Sprint 6; agentes nao acessam dados do negocio em tempo real; operadores copiam dados manualmente; Google Workspace dominante entre PMEs brasileiras | 7 | 6 | nao |
| D-060 | pain | P4 | Sem multi-tenancy para agencias — identificado Sprint 3 (D-026), persistente; instancia unica sem isolamento de dados por cliente; sem branding customizavel; risco de vazamento entre clientes; bloqueia modelo de negocio de agencia/reseller | 7 | 6 | nao |
| D-061 | pain | P2, P3 | OpenTelemetry nao exportavel (F-129-131 bloqueado) — times com Datadog/Grafana/Langfuse nao integram dados do Backbone; silos de observabilidade; debugging em producao exige acesso direto ao servidor | 6 | 6 | nao |
| G-052 | gain | P1, P2, P3 | Feedback loop de qualidade com rating de usuario — thumbs up/down em mensagens do agente + motivo opcional + dashboard de aprovacao por agente/periodo + export de baixo-avaliados para golden sets de eval; fecha ciclo LLM-as-judge + sinal humano real | 8 | 6 | nao |
| G-053 | gain | P1, P3, P4 | Email connector (IMAP/SMTP) nativo com GUI no Hub — agente como inbox de email; resposta automatica com personalidade e contexto; config via GUI (servidor, filtros, assinatura); channel-adapter para conversas SSE; tools reply/forward/create_draft | 8 | 6 | nao |
| G-054 | gain | P3, P4 | Export de relatorios PDF/CSV formatados — relatorios de conversas, custos, metricas de eval e historico de auditoria; templates para reunioes de cliente e auditorias internas; filtros por agente/periodo/canal; download direto pela UI | 7 | 6 | nao |
| G-055 | gain | P2, P4 | Suporte MCP (Model Context Protocol) como cliente e servidor — agentes conectam a qualquer servidor MCP (Notion, GitHub, Jira, Postgres, Drive) via Hub; agentes expostos como servidores MCP para Claude Desktop, Cursor, etc.; UI de descoberta e configuracao de MCP servers | 9 | 6 | nao |
| G-056 | gain | P1, P2, P3 | Model routing inteligente por complexidade — configurar regras: heartbeat simples → modelo economico (Haiku/Flash), conversas complexas → modelo avancado (Sonnet); economia mensuravel no dashboard; config visual por agente; potencial de 60-80% de reducao de custo | 8 | 6 | nao |
| G-057 | gain | P1, P3 | WhatsApp Business Calling — agente atende chamadas de voz via WhatsApp Cloud API; transcricao em tempo real; resposta por voz sintetizada; log de chamadas com transcricao no Hub; sem numero Twilio adicional | 7 | 6 | nao |
| G-058 | gain | P1, P3, P4 | Visual Workflow Builder para orquestracao multi-agent — canvas drag-and-drop; nos sao agentes; arestas sao condicoes de handoff; config visual de criterios (intencao, palavras-chave, horario); gera frontmatter YAML automaticamente; preview com simulacao | 8 | 6 | nao |
| G-059 | gain | P1, P3 | Integracao Google Workspace (Calendar, Sheets, Drive) via OAuth2 — adaptador OAuth2 para Google; tools: consultar/criar eventos, ler/escrever Sheets, listar/ler Drive; cron jobs baseados em eventos do Calendar; config via GUI com OAuth flow integrado | 7 | 6 | nao |
| G-060 | gain | P4 | Multi-tenancy para agencias — tenants isolados com dados segregados; branding customizavel (logo, cores, nome); billing separado por tenant; URL por tenant (subdominio ou path prefix); painel de agencia com visao consolidada cross-tenant | 7 | 6 | nao |
| G-061 | gain | P2, P3 | Agent Performance Benchmarking automatico — ao publicar nova versao de instrucoes, rodar golden sets e comparar score vs. versao anterior; dashboard de tendencia de qualidade por versao; alerta de regressao; integrado com config versioning | 7 | 6 | nao |

---

## Resumo por Score (acumulado Sprint 1 ao Sprint 6)

| Score | Items |
|-------|-------|
| 10 | D-001, D-015, D-030, G-003, G-015, G-030 |
| 9 | D-002, D-003, D-014, D-016, D-018, D-024, D-031, D-032, D-034, D-041, D-042, D-054, G-001, G-005, G-007, G-014, G-016, G-018, G-024, G-031, G-032, G-035, G-042, G-043, G-044, G-055 |
| 8 | D-004, D-005, D-008, D-009, D-013, D-019, D-021, D-022, D-025, D-028, D-033, D-035, D-036, D-037, D-043, D-044, D-045, D-051, D-052, D-056, D-058, G-006, G-008, G-012, G-019, G-020, G-021, G-025, G-028, G-034, G-036, G-037, G-038, G-045, G-046, G-052, G-053, G-056, G-058 |
| 7 | D-007, D-010, D-011, D-012, D-017, D-020, D-023, D-026, D-027, D-029, D-038, D-039, D-040, D-046, D-048, D-049, D-050, D-053, D-055, D-057, D-059, D-060, G-002, G-004, G-009, G-011, G-013, G-017, G-022, G-026, G-027, G-029, G-033, G-039, G-040, G-041, G-047, G-048, G-049, G-050, G-054, G-057, G-059, G-060, G-061 |
| 6 | D-006, D-023, D-047, D-061, G-010, G-023, G-051 |

---

## Notas sobre Implementacao (Sprint 6)

### Implementadas no Sprint 5 — atualizadas para `sim`

- **D-041/G-042** (WhatsApp Cloud API) — conector `whatsapp-cloud/` existe no codebase → `sim`
- **D-043/G-044** (Webhook inbound) — F-097-100 passing, rotas e UI implementadas → `sim`
- **D-044/G-045** (Multi-agent handoffs) — F-108-111 passing → `sim`
- **D-045/G-046** (Rate limiting) — F-112-115 passing → `sim`
- **D-046/G-047** (Slack/Teams connectors) — F-116-117 passing; Email (F-118) pending → `parcial`
- **D-048/G-048** (Agent Sandbox) — F-120-122 passing → `sim`
- **D-049/G-049** (Config Versioning) — F-123-125 passing → `sim`
- **D-042/G-043** (LGPD) — F-101-102 passing, F-103 in_progress → `parcial`

### Nao implementadas — backlog para Sprint 6

**Score 9 (critico):**
- D-054/G-055: MCP support (nova discovery Sprint 6)

**Score 8 (alta prioridade):**
- D-037/G-038: Feedback loop de qualidade com rating de usuario (Sprint 4, persistente)
- D-051/G-052: Feedback loop — reafirmado Sprint 6 com mais evidencia
- D-052/G-053: Email connector (F-118 pending desde Sprint 5)
- D-056/G-056: Model routing inteligente (nova discovery Sprint 6)
- D-058/G-058: Visual workflow builder (nova discovery Sprint 6)

**Score 7 (media prioridade):**
- D-047/G-051: OpenTelemetry (F-129-131 blocked)
- D-050/G-050: Export relatorios (F-126-128 blocked)
- D-053/G-054: Export relatorios — reafirmado Sprint 6
- D-055/G-055: Marketplace de templates (nova)
- D-057/G-057: WhatsApp Business Calling (nova)
- D-059/G-059: Google Workspace (Sprint 4, persistente)
- D-060/G-060: Multi-tenancy (Sprint 3, persistente)
- G-061: Agent Performance Benchmarking (nova)

**Score 6 (baixa prioridade):**
- D-023/G-023: Voice Twilio (Sprint 2, persistente)
- D-026/G-026: Multi-tenancy basico (Sprint 3, persistente — substituido por D-060)
- D-061: OpenTelemetry (reafirmado)
