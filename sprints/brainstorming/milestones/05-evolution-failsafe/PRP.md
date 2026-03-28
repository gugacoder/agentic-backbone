# PRP — Evolution Fail-Safe: Separacao de Concerns e Contrato de Erro

Reestruturar o modulo Evolution para separar gestao de instancias de linkagem de telefone e garantir que 100% das respostas do backbone para o hub retornem HTTP 200 OK.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O modulo Evolution (`apps/backbone/src/modules/evolution/`) gerencia instancias WhatsApp via Evolution API. O hub (`apps/hub/`) consome as rotas REST do backbone para exibir e operar essas instancias.

**Problema 1 — Acoplamento entre criacao e linkagem:**

O fluxo atual forca a criacao de instancia e a linkagem de telefone como um unico processo. Ao criar uma instancia, o hub navega automaticamente para a aba QR (`search: { tab: "qr" }`), assumindo que o proximo passo obrigatorio eh escanear o QR code. Mas na Evolution API, uma instancia pode existir sem telefone vinculado — a linkagem eh um processo separado, feito quando o operador quiser. Isso causa confusao e impede a gestao de instancias "preparadas" que serao vinculadas depois.

| Arquivo | Problema |
|---|---|
| `create-instance-dialog.tsx:56-59` | Navega para aba QR imediatamente apos criacao |
| `routes.ts:127-160` | Cria instancia e assume que tudo sera linkado na sequencia |
| `instance-qr.tsx` | Componente monolitico que mistura fetch de QR, polling de estado e contagem de tentativas |

**Problema 2 — Respostas HTTP que crasham o hub:**

O backbone repassa codigos HTTP da Evolution API diretamente para o hub (`response.status as 400`). Erros 400, 500, 502, 503 chegam ao hub e causam:

- Toasts de erro genericos sem contexto util
- Estado `isError` no React Query que substitui a UI inteira por telas de erro
- Crashes quando `response.json()` falha no catch
- Experiencia hostil durante linkagem (QR expirado retorna erro em vez de estado)

| Arquivo | Problema |
|---|---|
| `routes.ts:148-151` | `c.json({ error: ... }, response.status as 400)` — repassa status da Evolution |
| `routes.ts:208-210` | QR falha retorna HTTP 400 em vez de resposta com estado de erro |
| `routes.ts:267-269` | Settings falha retorna HTTP 4xx |
| `lib/api.ts:33-43` | Hub lanca `ApiError` para qualquer `!res.ok` |
| `whatsapp.tsx:78-93` | `isError` renderiza card de erro generico, substituindo a tabela |
| `whatsapp-instance.tsx:71-135` | `InstanceErrorCard` tenta interpretar status codes (404, 503) |

### Estado desejado

1. Instancias podem ser criadas, listadas, editadas e excluidas **independentemente** da linkagem de telefone
2. A linkagem de telefone (QR code) eh um processo separado, acessado a partir de uma instancia existente
3. **100% das respostas do backbone retornam HTTP 200** — erros de negocio sao representados no body
4. O hub **nunca** entra em estado de erro por respostas do backbone — sempre renderiza UI funcional

## Especificacao

### 1. Contrato de Resposta do Backbone

Toda rota do modulo Evolution deve retornar **HTTP 200** com um envelope padronizado:

```typescript
// Sucesso
{ ok: true, data: T }

// Erro de negocio
{ ok: false, error: string, details?: unknown }
```

| Cenario | Antes | Depois |
|---|---|---|
| Evolution API offline | HTTP 503 `{ error: "api_offline" }` | HTTP 200 `{ ok: false, error: "api_offline" }` |
| Instancia nao encontrada | HTTP 404 `{ error: "instance_not_found" }` | HTTP 200 `{ ok: false, error: "instance_not_found" }` |
| Criacao falhou | HTTP 400 `{ error: "create_failed" }` | HTTP 200 `{ ok: false, error: "create_failed", details: ... }` |
| QR nao disponivel | HTTP 400 `{ error: "qr_failed" }` | HTTP 200 `{ ok: false, error: "qr_unavailable", details: ... }` |
| Cooldown ativo | HTTP 429 `{ error: "cooldown_active" }` | HTTP 200 `{ ok: false, error: "cooldown_active", retryAfterMs: N }` |
| Tentativas esgotadas | HTTP 409 `{ error: "retries_exhausted" }` | HTTP 200 `{ ok: false, error: "retries_exhausted", attempts: N, maxRetries: N }` |
| Settings falhou | HTTP 400 `{ error: "settings_fetch_failed" }` | HTTP 200 `{ ok: false, error: "settings_fetch_failed", details: ... }` |
| Rede (backbone ↔ evolution) | HTTP 502 `{ error: "...", details: ... }` | HTTP 200 `{ ok: false, error: "network_error", details: ... }` |
| Sucesso (create) | HTTP 201 `data` | HTTP 200 `{ ok: true, data: ... }` |
| Sucesso (demais) | HTTP 200 `data` | HTTP 200 `{ ok: true, data: ... }` |

**Tipo TypeScript (backbone):**

```typescript
type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: string; details?: unknown; retryAfterMs?: number; attempts?: number; maxRetries?: number };
type ApiResult<T> = ApiOk<T> | ApiErr;
```

**Tipo TypeScript (hub):**

```typescript
// api/evolution.ts
interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  details?: unknown;
  retryAfterMs?: number;
  attempts?: number;
  maxRetries?: number;
}
```

### 2. Separacao: Gestao de Instancias vs. Linkagem

**Gestao de instancias** — CRUD puro, sem efeitos colaterais de linkagem:

| Rota | Funcao | Mudanca |
|---|---|---|
| `GET /instances` | Listar instancias | Apenas envelopa resposta |
| `GET /instances/:name` | Detalhe da instancia | Apenas envelopa resposta |
| `POST /instances` | Criar instancia | Cria sem navegar para QR |
| `DELETE /instances/:name` | Excluir instancia | Apenas envelopa resposta |
| `GET /instances/:name/settings` | Ler settings | Apenas envelopa resposta |
| `PATCH /instances/:name/settings` | Alterar settings | Apenas envelopa resposta |

**Linkagem de telefone** — processo separado:

| Rota | Funcao | Mudanca |
|---|---|---|
| `GET /instances/:name/qr` | Obter QR code | Retorna `{ ok: true, data: { base64, code } }` ou `{ ok: false, error: "qr_unavailable" }` — **nunca** HTTP 4xx |
| `POST /instances/:name/reconnect` | Reconectar | Envelopa resultado da action |
| `POST /instances/:name/restart` | Reiniciar | Envelopa resultado da action |

### 3. Mudancas no Hub

#### 3.1. Camada de API (`api/evolution.ts`)

Todas as query functions e mutations devem:

- Receber `ApiResult<T>` (que eh sempre HTTP 200)
- Verificar `result.ok` para decidir o fluxo
- **Nunca** entrar em estado `isError` do React Query por erro de negocio — `isError` deve indicar exclusivamente falha de rede (backbone inacessivel)

```typescript
// Exemplo: query que extrai data ou lanca apenas se rede falhar
queryFn: async () => {
  const result = await api.get<ApiResult<EvolutionInstance[]>>("/modules/evolution/instances");
  if (!result.ok) return []; // Retorna vazio, a UI mostra estado vazio
  return result.data;
}
```

Para mutations, o `onSuccess` deve verificar `result.ok`:

```typescript
mutationFn: (data) => api.post<ApiResult<...>>("/modules/evolution/instances", data),
onSuccess: (result) => {
  if (!result.ok) {
    toast.error(friendlyMessage(result.error));
    return;
  }
  // fluxo de sucesso
}
```

#### 3.2. Dialog de Criacao (`create-instance-dialog.tsx`)

- Ao criar com sucesso: navegar para a pagina da instancia na aba **status** (nao QR)
- Se `result.ok === false`: mostrar toast com mensagem amigavel, manter dialog aberto

```
✅ navigate({ to: "/conectividade/whatsapp/$name", params: { name }, search: { tab: "status" } })
❌ navigate({ to: "/conectividade/whatsapp/$name", params: { name }, search: { tab: "qr" } })
```

#### 3.3. Pagina da Instancia (`whatsapp-instance.tsx`)

- A aba QR deve funcionar independentemente do estado da instancia
- Se a instancia ja estiver `open`: a aba QR mostra mensagem "Instancia ja vinculada" com o numero do telefone
- Se a instancia estiver `close` ou `connecting`: aba QR permite gerar QR code normalmente
- Remover `InstanceErrorCard` como componente inteiro que substitui a pagina — erros de negocio devem ser tratados inline

#### 3.4. Componente QR (`instance-qr.tsx`)

Mudancas:

| Antes | Depois |
|---|---|
| `qrIsError` vem do React Query | Erro vem de `result.ok === false` no body |
| QR falha = tela de erro | QR falha = mensagem inline com botao de retry |
| Limite fixo de 5 tentativas hard-coded | Manter 5, mas permitir reset sem recarregar pagina |
| Estado `exhausted` pede reload de pagina | Estado `exhausted` mostra botao "Recomecar" que reseta tentativas |

#### 3.5. Pagina principal (`whatsapp.tsx`)

- Se `instances` retornar array vazio (quando `ok: false`): mostrar estado vazio ("Nenhuma instancia" ou "API indisponivel"), nao tela de erro
- Remover a dependencia de `isError` para renderizar `InstanceTable` — a tabela sempre renderiza, podendo estar vazia

### 4. Funcao helper para `routes.ts`

Extrair helpers para padronizar respostas:

```typescript
function ok<T>(c: Context, data: T) {
  return c.json({ ok: true, data });
}

function fail(c: Context, error: string, details?: unknown, extra?: Record<string, unknown>) {
  return c.json({ ok: false, error, details, ...extra });
}

async function proxyGet<T>(c: Context, url: string, apiKey: string, errorCode: string) {
  try {
    const response = await fetch(url, { headers: { apikey: apiKey } });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
      return fail(c, errorCode, err);
    }
    const data = await response.json();
    return ok(c, data);
  } catch (err) {
    return fail(c, "network_error", String(err));
  }
}
```

### 5. Mapa de mensagens amigaveis (hub)

O hub deve traduzir error codes em mensagens para o usuario:

| `error` | Mensagem pt-BR |
|---|---|
| `api_offline` | "Evolution API esta indisponivel" |
| `instance_not_found` | "Instancia nao encontrada" |
| `create_failed` | "Falha ao criar instancia" |
| `delete_failed` | "Falha ao excluir instancia" |
| `qr_unavailable` | "QR code indisponivel no momento" |
| `cooldown_active` | "Aguarde antes de tentar novamente" |
| `retries_exhausted` | "Tentativas esgotadas" |
| `settings_fetch_failed` | "Falha ao carregar configuracoes" |
| `settings_update_failed` | "Falha ao salvar configuracoes" |
| `network_error` | "Erro de comunicacao com Evolution API" |

## Limites

- **NAO** criar novas rotas — reestruturar as existentes
- **NAO** alterar a logica interna de `probe.ts`, `state.ts`, `actions.ts`, `patterns.ts` — apenas as rotas e o hub
- **NAO** remover funcionalidades existentes (cooldown, exhausted, event feed, SSE)
- **NAO** alterar o esquema de eventos SSE — eles continuam como estao
- **NAO** adicionar novas dependencias
- **NAO** alterar `lib/api.ts` do hub — o `ApiError` continua existindo para erros de rede reais (backbone inacessivel). A mudanca eh que o backbone nunca mais retorna 4xx/5xx, entao `ApiError` so dispara se o backbone estiver down
- **NAO** mexer no fluxo de autenticacao (401 no `lib/api.ts`)

## Rastreabilidade

| Mudanca | Arquivos |
|---|---|
| Contrato de resposta (backbone) | `apps/backbone/src/modules/evolution/routes.ts` |
| Tipos compartilhados | `apps/hub/src/api/evolution.ts` |
| Dialog de criacao | `apps/hub/src/components/connectivity/create-instance-dialog.tsx` |
| Pagina principal | `apps/hub/src/pages/whatsapp.tsx` |
| Pagina da instancia | `apps/hub/src/pages/whatsapp-instance.tsx` |
| Componente QR | `apps/hub/src/components/connectivity/instance-qr.tsx` |
| Settings form | `apps/hub/src/components/connectivity/instance-settings-form.tsx` |
| Regra no CLAUDE.md | `CLAUDE.md` (secao "Error Contract") |
