---
enabled: true
user-invocable: true
trigger: test-suite
requires-env:
  - BACKBONE_PORT
  - SYSUSER
  - SYSPASS
requires-bin:
  - curl
  - jq
---

# Test Suite

Suite completa de testes de integração do Agentic Backbone. Executa testes contra todos os subsistemas via `curl`.

## Quando usar

- Usuário pede "testar tudo", "rodar test-suite", "run tests" ou variações
- Após deploy ou mudança significativa no backbone
- Para diagnóstico de problemas

## Instruções

Execute o roteiro completo abaixo, grupo por grupo, na ordem indicada. Use `$BACKBONE_PORT`, `$SYSUSER` e `$SYSPASS` do ambiente.

**URL base:** `http://localhost:${BACKBONE_PORT}`

**Convenções:**
- Recursos temporários usam prefixo `_probe_` e devem ser limpos ao final de cada grupo
- Reporte cada teste como `[PASS]`, `[FAIL]` ou `[SKIP]`
- Se a autenticação (Grupo 1) falhar, aborte toda a suite
- Use `jq` para extrair campos de respostas JSON
- Capture HTTP status codes com `-o /dev/null -w "%{http_code}"` ou `-w "\n%{http_code}"` conforme necessário

---

## Grupo 1 — Auth

Obtenha o token JWT que será usado em todos os grupos seguintes.

```bash
# 1.1 Login com credenciais válidas
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:${BACKBONE_PORT}/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${SYSUSER}\",\"password\":\"${SYSPASS}\"}")
# Espera: 200 + body com campo "token"
# Extraia o token para uso nos próximos testes:
TOKEN=$(echo "$LOGIN_RESPONSE" | head -1 | jq -r '.token')

# 1.2 Verificar token (auth/me)
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/auth/me
# Espera: 200 + body com campo "username" igual a $SYSUSER

# 1.3 Login com credenciais inválidas
curl -s -w "\n%{http_code}" -X POST http://localhost:${BACKBONE_PORT}/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"invalid_user","password":"wrong_pass"}'
# Espera: 401
```

**Se 1.1 falhar:** aborte a suite inteira — sem token não é possível testar nada.

---

## Grupo 2 — System

Endpoints de status e informação do sistema.

```bash
# 2.1 Health check (público, sem auth)
curl -s -w "\n%{http_code}" http://localhost:${BACKBONE_PORT}/health
# Espera: 200

# 2.2 System stats
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/system/stats
# Espera: 200 + JSON com campos de estatísticas

# 2.3 System info
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/system/info
# Espera: 200 + JSON

# 2.4 Heartbeat stats globais
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/system/heartbeat/stats
# Espera: 200 + JSON
```

---

## Grupo 3 — Agents

CRUD de agentes. Cria um agente temporário, verifica, atualiza e deleta.

```bash
# 3.1 Listar agentes
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/agents
# Espera: 200 + array JSON

# 3.2 Obter agente existente (system.main)
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/agents/system.main
# Espera: 200 + JSON com id "system.main"

# 3.3 Criar agente temporário
curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"owner":"system","slug":"_probe_temp","title":"Probe Temp Agent"}' \
  http://localhost:${BACKBONE_PORT}/agents
# Espera: 201 ou 200

# 3.4 Obter agente criado
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/agents/system._probe_temp
# Espera: 200

# 3.5 Atualizar agente
curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Probe Temp Agent Updated"}' \
  http://localhost:${BACKBONE_PORT}/agents/system._probe_temp
# Espera: 200

# 3.6 Deletar agente temporário
curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:${BACKBONE_PORT}/agents/system._probe_temp
# Espera: 200 ou 204
```

---

## Grupo 4 — Channels

CRUD de channels. Cria um channel temporário, emite evento e deleta.

```bash
# 4.1 Listar channels
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/channels
# Espera: 200 + array JSON

# 4.2 Obter channel existente (system-channel)
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/channels/system-channel
# Espera: 200

# 4.3 Criar channel temporário
curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"_probe_temp","owner":"system","type":"diagnostic"}' \
  http://localhost:${BACKBONE_PORT}/channels
# Espera: 201 ou 200

# 4.4 Emitir evento no channel
curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"probe test event"}' \
  http://localhost:${BACKBONE_PORT}/channels/_probe_temp/emit
# Espera: 200

# 4.5 Deletar channel temporário
curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:${BACKBONE_PORT}/channels/_probe_temp
# Espera: 200 ou 204
```

---

## Grupo 5 — Users

CRUD de usuários. Cria um usuário temporário e deleta.

```bash
# 5.1 Listar usuários
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/users
# Espera: 200 + array JSON

# 5.2 Obter usuário system
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/users/system
# Espera: 200

# 5.3 Criar usuário temporário
curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"_probe_temp","displayName":"Probe Temp User"}' \
  http://localhost:${BACKBONE_PORT}/users
# Espera: 201 ou 200

# 5.4 Deletar usuário temporário
curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:${BACKBONE_PORT}/users/_probe_temp
# Espera: 200 ou 204
```

---

## Grupo 6 — Conversations

Ciclo completo: criar sessão, enviar mensagem, obter histórico, deletar.

**Nota:** O endpoint `POST /conversations/:sessionId/messages` retorna SSE stream. Use `--max-time 30` para limitar e capture os primeiros eventos.

```bash
# 6.1 Criar sessão com system.probe
SESSION_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"system.probe"}' \
  http://localhost:${BACKBONE_PORT}/conversations)
# Espera: 201 ou 200 + JSON com "sessionId"
SESSION_ID=$(echo "$SESSION_RESPONSE" | head -1 | jq -r '.sessionId')

# 6.2 Obter metadados da sessão
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  http://localhost:${BACKBONE_PORT}/conversations/${SESSION_ID}
# Espera: 200

# 6.3 Enviar mensagem (SSE — capture primeiros eventos com timeout)
curl -s --max-time 30 -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Responda apenas: probe ok"}' \
  http://localhost:${BACKBONE_PORT}/conversations/${SESSION_ID}/messages | head -20
# Espera: stream SSE com eventos (linhas começando com "data:")

# 6.4 Obter histórico de mensagens
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  http://localhost:${BACKBONE_PORT}/conversations/${SESSION_ID}/messages
# Espera: 200 + array com pelo menos 1 mensagem

# 6.5 Deletar sessão
curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:${BACKBONE_PORT}/conversations/${SESSION_ID}
# Espera: 200 ou 204
```

**Nota:** A sessão criada no 6.1 é do próprio probe, o que é proposital — testamos o ciclo completo de conversa.

---

## Grupo 7 — Skills

Listar skills disponíveis.

```bash
# 7.1 Listar skills globais
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/skills
# Espera: 200 + array JSON

# 7.2 Listar skills do probe
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "http://localhost:${BACKBONE_PORT}/skills?agentId=system.probe"
# Espera: 200 + array contendo test-suite
```

---

## Grupo 8 — Tools

Listar tools disponíveis.

```bash
# 8.1 Listar tools globais
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/tools
# Espera: 200 + array JSON

# 8.2 Listar tools do system.main
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "http://localhost:${BACKBONE_PORT}/tools?agentId=system.main"
# Espera: 200 + array JSON
```

---

## Grupo 9 — Adapters

Listar adapters disponíveis.

```bash
# 9.1 Listar adapters
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/adapters
# Espera: 200 + array JSON
```

---

## Grupo 10 — Heartbeat

Status e controle do heartbeat de um agente.

```bash
# 10.1 Status do heartbeat do system.main
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  http://localhost:${BACKBONE_PORT}/agents/system.main/heartbeat
# Espera: 200 + JSON com status

# 10.2 Stats do heartbeat do system.main
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  http://localhost:${BACKBONE_PORT}/agents/system.main/heartbeat/stats
# Espera: 200

# 10.3 Histórico do heartbeat
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "http://localhost:${BACKBONE_PORT}/agents/system.main/heartbeat/history?limit=5"
# Espera: 200 + array JSON
```

**Nota:** Não execute toggle ou trigger manual do heartbeat de outros agentes — apenas consulte status. O probe não deve interferir no funcionamento de outros agentes.

---

## Grupo 11 — Memory

Status e busca na memória de um agente.

```bash
# 11.1 Status da memória do system.main
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  http://localhost:${BACKBONE_PORT}/agents/system.main/memory/status
# Espera: 200 + JSON

# 11.2 Buscar na memória
curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"backbone"}' \
  http://localhost:${BACKBONE_PORT}/agents/system.main/memory/search
# Espera: 200 + JSON com resultados (pode ser array vazio)
```

**Nota:** Não execute sync ou reset na memória de outros agentes.

---

## Grupo 12 — Jobs

Submeter um job simples, consultar e limpar.

```bash
# 12.1 Submeter job simples
JOB_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"system.probe","command":"echo probe_test_ok","timeout":10}' \
  http://localhost:${BACKBONE_PORT}/jobs)
# Espera: 200 ou 201 + JSON com "id"
JOB_ID=$(echo "$JOB_RESPONSE" | head -1 | jq -r '.id')

# 12.2 Listar jobs
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/jobs
# Espera: 200 + array JSON

# 12.3 Obter job específico (aguarde 2s para completar)
sleep 2
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" \
  http://localhost:${BACKBONE_PORT}/jobs/${JOB_ID}
# Espera: 200 + JSON com status "completed"

# 12.4 Limpar job
curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:${BACKBONE_PORT}/jobs/${JOB_ID}
# Espera: 200 ou 204
```

---

## Grupo 13 — Cron

Consultar status do cron scheduler.

```bash
# 13.1 Status do cron
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/cron/status
# Espera: 200 + JSON

# 13.2 Listar cron jobs
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/cron/jobs
# Espera: 200 + array JSON
```

---

## Grupo 14 — SSE/Events

Verificar que o sistema de eventos SSE está funcionando.

```bash
# 14.1 Conectar ao SSE de sistema (capturar primeiros eventos com timeout)
curl -s -N --max-time 5 -H "Authorization: Bearer $TOKEN" \
  http://localhost:${BACKBONE_PORT}/system/events 2>/dev/null | head -10
# Espera: pelo menos uma linha com "data:" ou ":ok" (SSE comment/ping)
# Se receber qualquer dado antes do timeout, o SSE está funcionando

# 14.2 Conectar ao SSE do channel probe
curl -s -N --max-time 5 -H "Authorization: Bearer $TOKEN" \
  http://localhost:${BACKBONE_PORT}/channels/probe/events 2>/dev/null | head -10
# Espera: conexão estabelecida (qualquer resposta antes do timeout)
```

**Nota:** SSE connections ficam abertas — use `--max-time` para limitar.

---

## Resumo final

Após executar todos os grupos, apresente:

```
═══════════════════════════════════════════════════
  TEST SUITE — Agentic Backbone
  Data: $(date)
═══════════════════════════════════════════════════

  Grupo 1  Auth           ✓/✗
  Grupo 2  System         ✓/✗
  Grupo 3  Agents         ✓/✗
  Grupo 4  Channels       ✓/✗
  Grupo 5  Users          ✓/✗
  Grupo 6  Conversations  ✓/✗
  Grupo 7  Skills         ✓/✗
  Grupo 8  Tools          ✓/✗
  Grupo 9  Adapters       ✓/✗
  Grupo 10 Heartbeat      ✓/✗
  Grupo 11 Memory         ✓/✗
  Grupo 12 Jobs           ✓/✗
  Grupo 13 Cron           ✓/✗
  Grupo 14 SSE/Events     ✓/✗

═══════════════════════════════════════════════════
  TOTAL: X passed, Y failed, Z skipped
═══════════════════════════════════════════════════
```
