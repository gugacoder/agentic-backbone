# Evolution Module — Gestao Robusta de Conectividade

A conexao com a Evolution API VAI falhar. Isso nao e excecao — e estado esperado. Instancias WhatsApp desconectam, o servico cai, a rede oscila. O sistema nao pode tratar falha como surpresa; precisa trata-la como cenario de operacao normal. Este modulo existe para garantir que, mesmo quando tudo falha, o backbone nao perde consciencia situacional, o operador e informado, e existem caminhos claros de recuperacao.

---

## Objetivo

Implementar o primeiro modulo do backbone (conforme PRP 01): gestao autonoma e resiliente das instancias Evolution API, baseada em 5 pilares de robustez.

## Execution Mode

`implementar`

---

## Contexto

### O que e a Evolution API

Servico que gerencia instancias WhatsApp. Cada instancia e uma sessao autenticada com um numero de telefone. A API expoe endpoints REST para criar, conectar, desconectar, reiniciar e consultar instancias.

### Estado Atual

- A Evolution API ja roda no docker-compose do projeto (porta interna, servico `evolution`)
- Ja existe um adapter em `context/shared/adapters/evolution/` — mas e passivo (so da acesso ao agente)
- Nao existe monitoramento ativo, deteccao de falhas, ou acoes corretivas
- Se uma instancia desconecta, ninguem sabe ate alguem olhar manualmente
- Variaveis de ambiente ja existem: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`

### Premissa de Design

Este modulo aplica 5 tecnicas de robustez extraidas do estudo do wa-man/evolution-prototype. Sao tecnicas aplicaveis a qualquer sistema de gestao de recursos externos — aqui aplicadas ao contexto especifico da Evolution API.

---

## Especificacao

### Pilar 1: Probe Autonomo com Maquina de Estados

Um loop autonomo interroga a Evolution API em intervalos fixos. Ele opera independente de qualquer interface ou agente — se o backbone esta rodando, o probe esta rodando.

**Maquina de estados do servico:**

```
               start()
                 │
                 ▼
            ┌─────────┐
            │ unknown  │
            └────┬─────┘
                 │ resposta OK
                 ▼
            ┌─────────┐  timeout/erro   ┌─────────┐
            │ online   │───────────────→│ offline  │
            └─────────┘                 └────┬─────┘
                 ▲                           │
                 │      resposta OK          │
                 └───────────────────────────┘
```

**Tres estados:**

| Estado | Significado |
|--------|-------------|
| `unknown` | Estado inicial apos boot. Nenhuma consulta foi feita ainda. |
| `online` | A ultima consulta obteve resposta valida. |
| `offline` | A ultima consulta falhou (timeout, erro de rede, status != 2xx). |

**Transicoes que geram eventos:**

| De | Para | Evento emitido |
|----|------|----------------|
| `unknown` | `online` | nenhum (inicializacao silenciosa) |
| `unknown` | `offline` | `module:evolution:api-offline` |
| `online` | `offline` | `module:evolution:api-offline` |
| `offline` | `online` | `module:evolution:api-online` |

**Dados capturados em cada probe:**

| Campo | Tipo | Proposito |
|-------|------|-----------|
| `timestamp` | number | Quando o probe executou |
| `status` | `online \| offline` | Resultado |
| `responseTimeMs` | number \| null | Tempo de resposta (null se timeout) |
| `error` | string \| null | Mensagem de erro (se houver) |

**Configuracao:**

| Parametro | Default | Proposito |
|-----------|---------|-----------|
| `probe.intervalMs` | `10000` | Intervalo entre probes (10 segundos) |
| `probe.timeoutMs` | `5000` | Timeout por requisicao (5 segundos) |

**Endpoint consultado:** `GET /instance/fetchInstances` — retorna a lista de instancias e valida que a API esta respondendo.

**Decisao:** O probe usa o mesmo endpoint que retorna instancias (nao um `/health` separado) porque assim cada probe ja traz dados uteis para o Pilar 2, evitando requisicoes redundantes.

---

### Pilar 2: Historico Temporal de Estado por Instancia

Cada instancia gerenciada pela Evolution API tem seu estado rastreado individualmente com registro temporal.

**Estado por instancia:**

| Campo | Tipo | Proposito |
|-------|------|-----------|
| `instanceName` | string | Identificador da instancia |
| `instanceId` | string | ID interno da Evolution |
| `state` | `"open" \| "close" \| "connecting"` | Estado atual da conexao |
| `since` | number (timestamp) | Desde quando esta nesse estado |
| `previousState` | string \| null | Estado anterior |
| `owner` | string \| null | Numero de telefone vinculado |

**Mapeamento de estados da Evolution:**

| Estado Evolution | Significado |
|------------------|-------------|
| `open` | Instancia online, autenticada, funcional |
| `close` | Instancia desconectada ou desautenticada |
| `connecting` | Instancia tentando reconectar |

**Transicoes que geram eventos:**

| De | Para | Evento emitido |
|----|------|----------------|
| `open` | `close` | `module:evolution:instance-disconnected` |
| `open` | `connecting` | `module:evolution:instance-reconnecting` |
| `close` | `open` | `module:evolution:instance-connected` |
| `connecting` | `open` | `module:evolution:instance-connected` |
| `connecting` | `close` | `module:evolution:instance-disconnected` |
| (novo) | qualquer | `module:evolution:instance-discovered` |
| existente | (ausente) | `module:evolution:instance-removed` |

**O payload de cada evento de instancia inclui:**

```
{
  ts: number,
  instanceName: string,
  state: string,
  previousState: string | null,
  since: number,
  durationInPreviousState: number | null
}
```

**Calculo de duracao:** Quando uma instancia muda de estado, o campo `durationInPreviousState` informa quanto tempo ficou no estado anterior (em ms). Isso responde "ficou offline por 3 minutos" — informacao acionavel.

**Armazenamento:** Estado em memoria (Map). Nao precisa de persistencia em disco — o probe reconstroi o estado a cada boot a partir da primeira resposta da API. O que importa e o monitoramento em tempo real, nao o historico.

---

### Pilar 3: Deteccao de Padroes de Instabilidade

O sistema nao reage apenas a eventos isolados. Ele detecta padroes temporais que indicam problemas sistemicos.

#### Padrao 1: Flapping (Oscilacao)

Uma instancia que troca de estado repetidamente em um curto periodo esta instavel. Isso e diferente de uma queda isolada.

**Regra:**

```
SE instancia mudou de estado >= N vezes nos ultimos W milissegundos
ENTAO emitir module:evolution:instance-unstable
```

| Parametro | Default | Proposito |
|-----------|---------|-----------|
| `thresholds.flapping.changes` | `3` | Quantidade de mudancas para considerar instavel |
| `thresholds.flapping.windowMs` | `300000` | Janela de observacao (5 minutos) |

**Implementacao:** Manter um array circular de timestamps de mudanca de estado por instancia. A cada mudanca, contar quantas ocorreram dentro da janela. Se >= threshold, emitir evento.

**Payload do evento:**

```
{
  ts: number,
  instanceName: string,
  changeCount: number,
  windowMs: number
}
```

#### Padrao 2: Degradacao Prolongada

Uma instancia que permanece offline alem de um limiar precisa de atencao urgente.

**Regra:**

```
SE instancia.state == "close" E (agora - instancia.since) > T milissegundos
ENTAO emitir module:evolution:instance-prolonged-offline
```

| Parametro | Default | Proposito |
|-----------|---------|-----------|
| `thresholds.prolongedOfflineMs` | `300000` | Tempo para considerar prolongado (5 minutos) |

**Verificacao:** A cada ciclo do probe, alem de checar a API, verificar todas as instancias em estado `close` e calcular duracao. Se exceder threshold e o evento ainda nao foi emitido para essa ocorrencia, emitir.

**Deduplicacao:** O evento `instance-prolonged-offline` e emitido apenas uma vez por ocorrencia de offline. Se a instancia voltar e cair novamente, uma nova ocorrencia pode ser emitida.

**Payload do evento:**

```
{
  ts: number,
  instanceName: string,
  offlineSinceMs: number,
  durationMs: number
}
```

---

### Pilar 4: Eventos no Barramento do Backbone

Todos os eventos do modulo fluem pelo event bus do backbone via `emitModule()` (definido no PRP 01). Isso garante que:

1. **Agentes podem reagir** — via heartbeat, um agente pode ser instruido a monitorar eventos Evolution e tomar acoes
2. **Hub pode exibir** — via SSE, o frontend recebe eventos em tempo real
3. **Hooks podem processar** — hooks existentes podem escutar eventos de modulo
4. **Logs sao automaticos** — o event bus ja tem `lastEvents` para consulta

**Catalogo completo de eventos:**

| Evento | Quando | Severidade |
|--------|--------|------------|
| `api-online` | Evolution API voltou a responder | info |
| `api-offline` | Evolution API parou de responder | critical |
| `instance-discovered` | Nova instancia detectada | info |
| `instance-removed` | Instancia nao aparece mais na API | warning |
| `instance-connected` | Instancia ficou online | info |
| `instance-disconnected` | Instancia ficou offline | warning |
| `instance-reconnecting` | Instancia tentando reconectar | info |
| `instance-unstable` | Instancia com flapping detectado | critical |
| `instance-prolonged-offline` | Instancia offline alem do limiar | critical |
| `action-success` | Acao corretiva bem-sucedida | info |
| `action-failed` | Acao corretiva falhou | warning |
| `action-exhausted` | Todas as tentativas de acao esgotadas | critical |

---

### Pilar 5: Acoes Corretivas com Retry Limitado e Escalacao

O modulo expoe acoes que o operador (ou um agente) pode executar para tentar recuperar instancias.

**Acoes disponiveis:**

| Acao | Endpoint Evolution | Proposito |
|------|-------------------|-----------|
| `reconnect` | `GET /instance/connect/{name}` | Tentativa suave de restabelecer conexao |
| `restart` | `PUT /instance/restart/{name}` | Reinicializacao forcada da instancia |

**Politica de retry:**

| Parametro | Default | Proposito |
|-----------|---------|-----------|
| `actions.maxRetries` | `3` | Maximo de tentativas por acao por ocorrencia |
| `actions.cooldownMs` | `60000` | Intervalo minimo entre tentativas (1 minuto) |

**Fluxo:**

```
1. Operador/agente solicita acao (reconnect ou restart)
2. Verificar cooldown: se ultima tentativa < cooldownMs atras, rejeitar
3. Verificar retries: se tentativas >= maxRetries para esta ocorrencia, rejeitar
4. Executar acao na Evolution API
5. Se sucesso: emitir action-success, resetar contador
6. Se falha: emitir action-failed, incrementar contador
7. Se contador atingiu maxRetries: emitir action-exhausted
```

**Decisao:** O modulo NAO executa acoes corretivas automaticamente. Ele detecta, informa, e disponibiliza os caminhos. A decisao de agir e do operador ou de um agente configurado para isso. Automacao de acoes corretivas e perigosa sem supervisao — uma instancia em loop de reconnect pode causar ban no WhatsApp.

**Reset de contadores:** Quando uma instancia transiciona de volta para `open` (por qualquer meio), os contadores de retry sao zerados. Isso permite novas tentativas numa futura ocorrencia.

---

### Rotas HTTP

Todas montadas em `/api/modules/evolution/` (conforme sistema de modulos do PRP 01).

| Metodo | Path | Proposito |
|--------|------|-----------|
| `GET` | `/health` | Saude do modulo + estado da API (online/offline, ultimo probe, response time) |
| `GET` | `/instances` | Lista todas as instancias com estado atual, since, previousState, duracao |
| `GET` | `/instances/:name` | Detalhe de uma instancia especifica |
| `POST` | `/instances/:name/reconnect` | Executar acao de reconnect (respeitando retry policy) |
| `POST` | `/instances/:name/restart` | Executar acao de restart (respeitando retry policy) |

**Respostas de erro das acoes:**

| Situacao | Status | Body |
|----------|--------|------|
| Cooldown ativo | 429 | `{ error: "cooldown_active", retryAfterMs: number }` |
| Retries esgotados | 409 | `{ error: "retries_exhausted", attempts: number, maxRetries: number }` |
| API offline | 503 | `{ error: "api_offline" }` |
| Instancia nao encontrada | 404 | `{ error: "instance_not_found" }` |

---

### Configuracao

Arquivo: `context/modules/evolution/CONFIG.yaml`

```yaml
# Probe — interrogacao periodica da API
probe:
  intervalMs: 10000
  timeoutMs: 5000

# Thresholds — limiares de deteccao de padroes
thresholds:
  flapping:
    changes: 3
    windowMs: 300000
  prolongedOfflineMs: 300000

# Actions — politica de acoes corretivas
actions:
  maxRetries: 3
  cooldownMs: 60000
```

**Variaveis de ambiente (ja existentes no .env):**

| Variavel | Proposito |
|----------|-----------|
| `EVOLUTION_API_URL` | URL base da Evolution API |
| `EVOLUTION_API_KEY` | Chave de autenticacao |

**Decisao:** A URL e chave da API vem do ambiente (padrao do projeto). Parametros de comportamento do modulo vem do YAML no context (editavel sem rebuild, versionavel).

---

### Estrutura de Arquivos

```
src/modules/evolution/
  index.ts          ← implementa BackboneModule, exporta evolutionModule
  probe.ts          ← loop autonomo de health check da API
  state.ts          ← rastreamento de estado por instancia com historico temporal
  patterns.ts       ← deteccao de flapping e degradacao prolongada
  actions.ts        ← acoes corretivas com retry policy
  routes.ts         ← rotas HTTP do modulo
  types.ts          ← tipos internos do modulo
  config.ts         ← leitura e parse do CONFIG.yaml

context/modules/evolution/
  CONFIG.yaml       ← configuracao de comportamento
```

---

## Limites

### O que este PRP NAO cobre

- **Nao implementa UI.** O hub consumira as rotas e eventos deste modulo, mas a interface e responsabilidade de outro PRP.
- **Nao implementa acoes corretivas automaticas.** O modulo detecta e disponibiliza — nao age sozinho.
- **Nao gerencia QR codes ou vinculacao de instancias.** Isso e CRUD de instancias, nao gestao de conectividade.
- **Nao persiste historico em disco.** Estado e em memoria, reconstruido a cada boot. Historico de longo prazo e escopo de outro PRP.
- **Nao implementa notificacoes push ou toast.** Isso e responsabilidade do consumidor (hub). O modulo emite eventos — quem consome decide como apresentar.
- **Nao implementa webhooks.** Se no futuro a Evolution puder notificar via webhook ao inves de polling, sera uma evolucao deste modulo, nao parte do escopo inicial.

### Restricoes

- O modulo so acessa a Evolution API via HTTP. Nao ha acoplamento com internals da Evolution.
- O modulo nao importa nada do backbone alem do `ModuleContext` recebido no `start()`.
- Toda configuracao de thresholds vem do `CONFIG.yaml`. Nao ha hardcoded magic numbers no codigo.
- Eventos seguem o namespace `module:evolution:*` sem excecao.

---

## Validacao

### Criterios de Aceite

**Probe:**

- [ ] Loop inicia no `start()` e para no `stop()`
- [ ] Emite `api-online` e `api-offline` nas transicoes corretas
- [ ] Respeita intervalo e timeout configurados
- [ ] Nao quebra se a Evolution API esta inacessivel no boot

**Estado de Instancias:**

- [ ] Cada instancia rastreada com state, since, previousState
- [ ] Emite eventos de transicao (connected, disconnected, reconnecting)
- [ ] Detecta instancias novas (discovered) e removidas (removed)
- [ ] `GET /instances` retorna estado completo com duracoes calculadas

**Deteccao de Padroes:**

- [ ] Detecta flapping apos N mudancas em W ms
- [ ] Detecta prolonged-offline apos T ms
- [ ] Eventos emitidos uma vez por ocorrencia (sem repeticao)

**Acoes Corretivas:**

- [ ] `POST /instances/:name/reconnect` chama Evolution e retorna resultado
- [ ] `POST /instances/:name/restart` chama Evolution e retorna resultado
- [ ] Cooldown respeitado (429 se muito cedo)
- [ ] Max retries respeitado (409 se esgotado)
- [ ] Contadores resetam quando instancia volta para `open`

**Integracao:**

- [ ] Todos os eventos aparecem no SSE de `/system/events`
- [ ] `/health` do backbone inclui saude do modulo
- [ ] `/api/modules/evolution/health` retorna estado detalhado
- [ ] Build passa: `npm run build --workspace=apps/backbone`

### Comando de validacao

```bash
npm run build --workspace=apps/backbone
```
