# Backbone Modules — Sistema de Extensao Modular

O Backbone e um runtime multi-agente. Seu nucleo existe para gerir agentes: registrar, executar, monitorar heartbeats, persistir conversas. Tudo o que nao e gestao de agentes — integracao com Evolution, futuros servicos, recursos auxiliares — e extensao. Extensoes nao devem macular o nucleo. Se precisarmos remover ou evoluir uma extensao, isso acontece sem tocar no core. Hoje nao existe essa fronteira. Qualquer integracao nova espalha codigo por `index.ts`, `routes/`, `events/`, criando acoplamento progressivo. Este PRP define a fronteira.

---

## Objetivo

Implementar um sistema de modulos que permita estender o backbone com capacidades adicionais isoladas do nucleo. O primeiro consumidor sera o modulo Evolution (PRP 02).

## Execution Mode

`implementar`

---

## Contexto

### Estado Atual

O backbone carrega tudo linearmente em `index.ts`:

```
startHeartbeat()
startCron()
startWatchers()
startJobSweeper()
initHooks()
wireEventBusToHooks()
triggerHook("startup")
```

Nao existe conceito de "extensao opcional". Para adicionar uma integracao nova seria necessario importar no `index.ts`, adicionar rotas no `routes/index.ts`, estender o `BackboneEventMap` em `events/index.ts`, e tratar shutdown no handler de sinais. Cada integracao nova aumenta o acoplamento.

### O que ja existe e pode ser aproveitado

- **Event bus tipado** (`events/index.ts`) — ja emite e escuta eventos. Precisa suportar eventos dinamicos de modulos.
- **SSE hub** (`events/sse.ts`) — ja faz streaming de eventos para clientes. Modulos devem poder publicar nesse canal.
- **Endpoint `/health`** (`routes/index.ts`) — ja reporta status do backbone. Precisa incluir saude dos modulos.
- **Graceful shutdown** (`index.ts`) — ja trata SIGTERM/SIGINT. Precisa chamar stop dos modulos.
- **Context directory** (`context/`) — estrutura de precedencia ja existe. Modulos ganham seu proprio namespace: `context/modules/{name}/`.
- **Data directory** (`data/`) — SQLite ja e padrao. Modulos podem ter seu proprio banco: `data/modules/{name}.sqlite`.

---

## Especificacao

### 1. Contrato do Modulo

Todo modulo implementa este contrato:

| Metodo/Propriedade | Tipo | Obrigatorio | Proposito |
|---------------------|------|:-----------:|-----------|
| `name` | string | sim | Identificador unico do modulo (kebab-case, ex: `evolution`) |
| `start(ctx)` | `(ctx: ModuleContext) => Promise<void>` | sim | Inicializa o modulo. Chamado uma vez no startup do backbone. |
| `stop()` | `() => Promise<void>` | sim | Encerra o modulo. Chamado no shutdown do backbone. Deve parar loops, fechar conexoes, liberar recursos. |
| `health()` | `() => ModuleHealth` | sim | Retorna o estado de saude atual do modulo. Chamado sob demanda. |
| `routes` | Hono instance | nao | Sub-app Hono com rotas HTTP do modulo. Montado em `/api/modules/{name}/`. |

**ModuleContext** — o que o backbone fornece ao modulo:

| Campo | Tipo | Proposito |
|-------|------|-----------|
| `eventBus` | BackboneEventBus | Emitir e escutar eventos no barramento do backbone |
| `dbPath` | string | Caminho para o SQLite dedicado do modulo (`data/modules/{name}.sqlite`) |
| `contextDir` | string | Diretorio de contexto do modulo (`context/modules/{name}/`) |
| `log` | `(msg: string) => void` | Logger com prefixo `[module:{name}]` |
| `env` | `Record<string, string \| undefined>` | `process.env` (somente leitura) |

**ModuleHealth** — retorno do `health()`:

| Campo | Tipo | Obrigatorio | Proposito |
|-------|------|:-----------:|-----------|
| `status` | `"healthy" \| "degraded" \| "unhealthy"` | sim | Estado geral do modulo |
| `details` | `Record<string, unknown>` | nao | Informacoes adicionais (uptime, metricas, etc.) |

---

### 2. Registro de Modulos

Modulos sao registrados **explicitamente** em `src/modules/index.ts`. Nao ha descoberta automatica via filesystem.

```
src/modules/
  index.ts          ← exporta array de modulos registrados
  types.ts          ← BackboneModule, ModuleContext, ModuleHealth
  loader.ts         ← startModules(), stopModules(), getModuleHealth()
  evolution/        ← primeiro modulo (PRP 02)
```

O array de modulos determina a ordem de inicializacao. O backbone percorre o array na ordem para `start()` e na ordem inversa para `stop()`.

**Decisao:** Registro explicito (nao discovery) porque modulos sao poucos e a ordem de inicializacao importa. Um import esquecido e mais facil de depurar do que um scan silencioso que nao carregou.

---

### 3. Ciclo de Vida

**Startup (em `index.ts`, apos `wireEventBusToHooks()`):**

```
1. Para cada modulo no array (em ordem):
   a. Criar ModuleContext com eventBus, dbPath, contextDir, log, env
   b. Garantir que contextDir existe (mkdir -p)
   c. Chamar module.start(ctx)
   d. Se module.routes existe, montar em /api/modules/{name}
   e. Se start() falhar: logar erro, marcar modulo como unhealthy, continuar para o proximo
2. Logar: "[backbone] modules: evolution, ..."
```

**Shutdown (antes de `process.exit`):**

```
1. Para cada modulo no array (em ordem INVERSA):
   a. Chamar module.stop()
   b. Se stop() falhar: logar erro, continuar para o proximo
```

**Decisao critica:** Falha no `start()` de um modulo NAO impede o backbone de subir. O modulo fica marcado como `unhealthy` e suas rotas retornam 503. Isso garante que o core (gestao de agentes) nunca e comprometido por uma extensao defeituosa.

---

### 4. Eventos de Modulo

Modulos emitem eventos no barramento do backbone usando o namespace `module:{name}:{evento}`.

O event bus precisa de uma extensao para aceitar eventos dinamicos alem dos tipados em `BackboneEventMap`. Adicionar ao `BackboneEventBus`:

- `emitModule(moduleName: string, event: string, payload: unknown): void` — emite como `module:{moduleName}:{event}`
- `onModule(moduleName: string, event: string, listener: (payload: unknown) => void): void` — escuta eventos de um modulo
- `offModule(moduleName: string, event: string, listener: (payload: unknown) => void): void` — remove listener

**Internamente**, `emitModule` usa o mesmo `EventEmitter` subjacente. Os eventos de modulo tambem sao armazenados em `lastEvents` e disponibilizados via SSE.

**Decisao:** Eventos de modulo nao exigem tipagem estatica em `BackboneEventMap`. A tipagem e responsabilidade do modulo internamente. O barramento trata payloads de modulo como `unknown` — quem consome sabe o que esperar.

---

### 5. Integracao com `/health`

O endpoint `/health` passa a incluir uma secao `modules`:

```json
{
  "status": "ok",
  "heartbeat": { ... },
  "agents": [ ... ],
  "channels": [ ... ],
  "modules": {
    "evolution": { "status": "healthy", "details": { ... } }
  }
}
```

`getModuleHealth()` no loader itera todos os modulos registrados e chama `health()` em cada um.

---

### 6. Integracao com SSE

Eventos `module:*` sao automaticamente incluidos no stream SSE de `/system/events`. O SSE hub ja escuta o event bus — a extensao `emitModule` deve garantir que o evento aparece no hub sem configuracao adicional.

---

### 7. Rotas de Modulo

Se um modulo define `routes`, elas sao montadas em `/api/modules/{name}/`. As rotas ficam **atras do JWT middleware barrier** — mesma protecao das rotas existentes.

Exemplo: se o modulo `evolution` define uma rota `GET /instances`, ela fica acessivel em `GET /api/modules/evolution/instances`.

**Decisao:** Rotas de modulo sao protegidas por padrao. Nao existe conceito de rota publica de modulo. Se um modulo precisa de acesso publico, isso e uma decisao arquitetural que exige discussao — nao cabe ao sistema de modulos resolver.

---

### 8. Diretorio de Contexto

Cada modulo pode ter arquivos de configuracao e estado em `context/modules/{name}/`. O backbone garante que o diretorio existe antes de chamar `start()`.

O conteudo do diretorio e livre — o modulo decide o que armazenar. O backbone nao interpreta esses arquivos.

---

### Arquivos a Criar

| Arquivo | Proposito |
|---------|-----------|
| `src/modules/types.ts` | Interfaces `BackboneModule`, `ModuleContext`, `ModuleHealth` |
| `src/modules/loader.ts` | `startModules()`, `stopModules()`, `getModuleHealth()` |
| `src/modules/index.ts` | Array de modulos registrados (inicialmente vazio ou com evolution) |

### Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/index.ts` | Importar e chamar `startModules()` no startup, `stopModules()` no shutdown |
| `src/events/index.ts` | Adicionar `emitModule()`, `onModule()`, `offModule()` ao `BackboneEventBus` |
| `src/routes/index.ts` | Importar modulos e montar rotas de cada um em `/api/modules/{name}` |
| `src/routes/index.ts` | Incluir `modules` no response do `/health` |

---

## Limites

### O que este PRP NAO cobre

- **Nao cria nenhum modulo concreto.** Este PRP define apenas a infraestrutura. O modulo Evolution e definido no PRP 02.
- **Nao muda a arquitetura de agentes.** Agents, heartbeat, memory, conversations — nada disso e tocado.
- **Nao implementa hot-reload de modulos.** Modulos sao carregados uma vez no startup. Para recarregar, reinicia o backbone.
- **Nao implementa dependencias entre modulos.** Se no futuro um modulo depender de outro, isso sera tratado num PRP separado.
- **Nao cria UI.** O hub consome as rotas e eventos dos modulos, mas a UI e responsabilidade de outro PRP.

### Restricoes

- Modulos NAO devem importar internals do backbone (nada de `../heartbeat/`, `../conversations/`, etc.). A unica interface e o `ModuleContext`.
- Modulos NAO devem modificar `BackboneEventMap`. Usam `emitModule`/`onModule` para eventos proprios.
- O backbone NAO deve importar internals de modulos. A unica interface e o contrato `BackboneModule`.
- Falha de modulo NAO pode derrubar o backbone. Todo `start()` e `stop()` envolto em try-catch no loader.

---

## Validacao

### Criterios de Aceite

- [ ] `src/modules/types.ts` exporta `BackboneModule`, `ModuleContext`, `ModuleHealth`
- [ ] `src/modules/loader.ts` exporta `startModules()`, `stopModules()`, `getModuleHealth()`
- [ ] `src/modules/index.ts` exporta array de modulos (pode estar vazio)
- [ ] `index.ts` chama `startModules()` apos `wireEventBusToHooks()` e `stopModules()` no shutdown
- [ ] `BackboneEventBus` suporta `emitModule()`, `onModule()`, `offModule()`
- [ ] `/health` inclui secao `modules` com saude de cada modulo registrado
- [ ] Um modulo com `start()` que lanca excecao nao impede o backbone de subir
- [ ] Um modulo com `routes` tem suas rotas acessiveis em `/api/modules/{name}/`
- [ ] Build passa sem erros: `npm run build --workspace=apps/backbone`

### Comando de validacao

```bash
npm run build --workspace=apps/backbone
```
