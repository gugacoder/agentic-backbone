# Backbone Agent Capabilities — Resource Inventory

Inventário de todas as capabilities que o backbone disponibiliza para agentes.
Cada item é testado pelo probe agent via Conversation API ou Probe Channel SSE.

**Cobertura: 53/53 (100%)**

---

## 1. Identidade e Contexto

| # | Capability | Canal | Prova |
|---|-----------|-------|-------|
| 1.1 | SOUL.md | Conv | Agente responde como QA/diagnóstico (identidade do probe). Conv-1. |
| 1.2 | CONVERSATION.md | Conv | `[PROBE-CONV-OK]` + `diagnostic: conversation-prompt-loaded`. Conv-1. |
| 1.3 | HEARTBEAT.md | Probe | Heartbeat executa probe-cycle (segue instruções redesenhadas). HB-1. |
| 1.4 | AGENT.md | Probe | Heartbeat dispara a cada 60s (intervalMs parsed do frontmatter). HB-1. |
| 1.5 | `<agent_context>` | Conv | Agente reporta agent_id=system.probe e agent_dir real. Conv-2. |

## 2. Skills

| # | Capability | Canal | Prova |
|---|-----------|-------|-------|
| 2.1 | Descoberta por precedência | Conv | 7 skills listadas (5 shared + 2 agent). Conv-2. |
| 2.2 | Listagem no prompt | Conv | Nomes e descrições corretos. Conv-2. |
| 2.3 | Leitura sob demanda | Probe | Heartbeat lê system-digest SKILL.md antes de submeter job. HB-1. |
| 2.4 | Eligibility filter | Conv | system-digest presente (BACKBONE_PORT existe). Conv-2. |

## 3. Tools

| # | Capability | Canal | Prova |
|---|-----------|-------|-------|
| 3.1 | Descoberta por precedência | Conv | 3 tools listadas (2 shared + 1 agent). Conv-2. |
| 3.2 | Listagem no prompt | Conv | Nomes e descrições corretos. Conv-2. |
| 3.3 | Leitura sob demanda | Conv+Probe | Agente lê TOOL.md antes de usar. Conv-3 (emit), HB-1 (digest). |
| 3.4 | Built-in SDK tools | Conv | Read, Write, Bash usados em Conv-4, Conv-5, Conv-6. |

## 4. Adapters + Connectors

| # | Capability | Canal | Prova |
|---|-----------|-------|-------|
| 4.1 | Adapters listados | Conv | 3 adapters na tabela. Conv-2. |
| 4.2 | Connector resolution | Conv | connector_dir do mysql resolvido. Conv-4. |
| 4.3 | Shell interfaces | Conv | `query.sh` retorna dados reais do banco. Conv-4. |
| 4.4 | Políticas de acesso | Conv | Policies corretas (full, readwrite). Conv-2. |

## 5. Memória

| # | Capability | Canal | Prova |
|---|-----------|-------|-------|
| 5.1 | MEMORY.md | Conv | Escreve + lê `CAPABILITY_TEST_TOKEN_2026`. Conv-5. |
| 5.2 | Journal | Conv | Cria `journal/{hoje}/MEMORY.md`, lê de volta. Conv-6. |
| 5.3 | Semantic search | Conv | Após sync (REST), agente "lembra" do token via `<relevant_memories>`. Conv-7. |
| 5.4 | Memory flush | Conv | Após `MEMORY_FLUSH_EVERY=5`, enviar 5 msgs, verificar MEMORY.md atualizado pelo flush. Conv-8. |
| 5.5 | Memory skills | Conv | memory-save (Conv-5), memory-journal (Conv-6), memory-recall (Conv-7). |

## 6. Jobs

| # | Capability | Canal | Prova |
|---|-----------|-------|-------|
| 6.1 | submit_job | Probe | Heartbeat submete probe-cycle.sh via MCP submit_job. HB-1. |
| 6.2 | get_job / list_jobs | Probe | Heartbeat lê output do job completo via MCP. HB-1. |
| 6.3 | kill_job | Conv | Test runner submete job `sleep 300` via REST, depois mata via REST. Verificar status=killed. Conv-9. |
| 6.4 | Wake-on-complete | Probe | Segundo tick dispara pelo job (antes do intervalo 60s). HB-1. |

## 7. Canais e Comunicação

| # | Capability | Canal | Prova |
|---|-----------|-------|-------|
| 7.1 | SSE streaming | Probe | Listener recebe eventos em tempo real. HB-1 + Conv-3. |
| 7.2 | Emit tool | Conv+Probe | Agente emite via `emit.sh` no canal probe. Listener SSE confirma recepção. Conv-3. |
| 7.3 | System channel | System | heartbeat:status visível no system-channel SSE. HB-1. |
| 7.4 | Delivery target | Probe | Output do heartbeat chega no `probe` (AGENT.md delivery). HB-1. |

## 8. Conversas

| # | Capability | Canal | Prova |
|---|-----------|-------|-------|
| 8.1 | Criar sessão | Conv | POST /conversations retorna session_id. Todos os Conv-*. |
| 8.2 | Enviar mensagem | Conv | SSE stream com type:text + type:result. Todos os Conv-*. |
| 8.3 | Continuar sessão | Conv | Segundo turno preserva contexto (Conv-5: write → read na mesma sessão). |
| 8.4 | Histórico | Conv | Verificar messages.jsonl no filesystem após Conv-1. Conv-10. |
| 8.5 | Compaction | Conv | `context_status` event na resposta inclui `compacted`, `willCompact`, `compactThreshold`. Conv-10. |

## 9. Heartbeat

| # | Capability | Canal | Prova |
|---|-----------|-------|-------|
| 9.1 | Tick autônomo | Probe | Output aparece sem intervenção. HB-1. |
| 9.2 | Guard checks | System | heartbeat:status com skip reason visível. HB-2 (empty-instructions test). |
| 9.3 | HEARTBEAT_OK | System | Tick de submissão → ok-token no system-channel. HB-1 (fase 2: submete job, retorna OK). |
| 9.4 | Dedup 24h | System | Test runner: trigger manual 2x com output estático → primeiro "sent", segundo "skipped/duplicate". HB-3. |
| 9.5 | Prompt unificado | Probe | Heartbeat usa MCP tools + lê skills (só possível com prompt unificado). HB-1. |

## 10. Cron

| # | Capability | Canal | Prova |
|---|-----------|-------|-------|
| 10.1 | Schedule at | Conv | `_probe_at` via POST /cron/jobs (at: now+15s). Verificar runs ≥ 1 após 20s. Conv-11. |
| 10.2 | Schedule every | Conv | `_probe_every` (every: 5000ms). Verificar runs ≥ 2 após 12s. Conv-11. |
| 10.3 | Schedule cron | Conv | `_probe_cron` (expr: `* * * * *`). Verificar runs ≥ 1 após 65s. Conv-11. |
| 10.4 | Payload heartbeat | Conv | `_probe_at` com payload: heartbeat. Verificar heartbeat:status no system-channel. Conv-11. |
| 10.5 | Payload agentTurn | Conv | `_probe_at` com payload: agentTurn + prompt. Verificar execução. Conv-11. |

## 11. Hooks

| # | Capability | Canal | Prova |
|---|-----------|-------|-------|
| 11.1 | Lifecycle events | Conv | Hook `_probe_hook` (message:received) escreve marker file. Conv-12. |
| 11.2 | Precedência | Conv | GET /system/hooks confirma hook com source correto. Conv-12. |
| 11.3 | Fire-and-forget | Conv | Mensagem recebida normalmente mesmo se hook falhar. Conv-12. |

## 12. Auth e Admin

| # | Capability | Canal | Prova |
|---|-----------|-------|-------|
| 12.1 | JWT login | Conv | Token obtido no início (pré-requisito de todos os testes). |
| 12.2 | Token em endpoints | Conv | Todos os endpoints protegidos respondem 200. |
| 12.3 | Token em SSE | Probe | SSE conecta via ?token= e recebe eventos. |
| 12.4 | User CRUD | Conv | Criar `_probe_user` via POST /users, verificar GET, deletar DELETE. Conv-13. |
| 12.5 | Agent registry | Conv | Criar `system._probe_agent` via POST /agents, verificar GET, deletar DELETE. Conv-13. |

---

## Resumo de cobertura

| Categoria | Total | Coberto | Testes |
|-----------|-------|---------|--------|
| Identidade e Contexto | 5 | 5 | Conv-1, Conv-2, HB-1 |
| Skills | 4 | 4 | Conv-2, HB-1 |
| Tools | 4 | 4 | Conv-2, Conv-3, Conv-4, Conv-5, Conv-6, HB-1 |
| Adapters | 4 | 4 | Conv-2, Conv-4 |
| Memória | 5 | 5 | Conv-5, Conv-6, Conv-7, Conv-8 |
| Jobs | 4 | 4 | Conv-9, HB-1 |
| Canais | 4 | 4 | Conv-3, HB-1 |
| Conversas | 5 | 5 | Conv-1..Conv-10 |
| Heartbeat | 5 | 5 | HB-1, HB-2, HB-3 |
| Cron | 5 | 5 | Conv-11 |
| Hooks | 3 | 3 | Conv-12 |
| Auth | 5 | 5 | Conv-13 |
| **Total** | **53** | **53** | |

---

## Recursos do system.probe

### Skills (7 total)

| Slug | Nome | Source | Descrição |
|------|------|--------|-----------|
| memory-journal | Memory Journal | shared | Registrar reflexões e acontecimentos do dia |
| memory-recall | Memory Recall | shared | Buscar informações nas memórias e journal |
| memory-reflect | Memory Reflect | shared | Consolidar e comprimir journal em aprendizados duráveis |
| memory-save | Memory Save | shared | Registrar memórias de longo prazo no MEMORY.md |
| memory-user | Memory User | shared | Registrar conhecimento sobre usuário no USER.md |
| system-digest | System Digest | agent | Gerar digest criptográfico verificável do estado do agente |
| test-suite | Test Suite | agent | Suite completa de testes de integração via curl |

### Tools (3 total)

| Slug | Nome | Source | Descrição |
|------|------|--------|-----------|
| emit | Emit | shared | Emitir eventos em canais SSE do backbone |
| jobs | Jobs | shared | Submeter processos longos ao backbone |
| introspect | Introspect | agent | Verificar integridade do próprio agente |

### Adapters (3 total)

| Slug | Nome | Connector | Policy | Descrição |
|------|------|-----------|--------|-----------|
| cia-app | CiaApp | mysql | full | DB de monitoramento de agentes |
| cia-prime | CiaPrime | mysql | readwrite | DB de negócio CiaPrimeCare |
| evolution | Evolution | evolution | readwrite | WhatsApp via Evolution API |
