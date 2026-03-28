# Correcao da Integracao Evolution — Montagem de Rotas + Robustez

Os PRPs 02 e 03 foram implementados na ordem inversa. O hub (PRP 03) foi construido antes do modulo backend (PRP 02). O resultado e um frontend que faz chamadas a rotas que nunca respondem, sem tratamento de falha visivel para o operador. Este PRP corrige os defeitos estruturais da montagem e define a regra de robustez que deveria ter sido aplicada desde o inicio.

---

## FIX

Este PRP corrige bugs causados pela seguinte situação:
> O PRP agentic-backbone\apps\backbone\milestones\03-evolution-hub\PRP.md foi implementado
> erroneamente antes de agentic-backbone\apps\backbone\milestones\02-evolution-module\PRP.md.
> A inversão da ordem deixou o sistema instável.

## Objetivo

Corrigir a montagem de rotas do sistema de modulos para que o modulo Evolution funcione, e blindar o hub para que nenhum erro de rede ou backend produza tela em branco, spinner infinito ou erro nao-comunicado.

## Execution Mode

`implementar`

---

## Contexto

### O que aconteceu

A ordem de implementacao especificada no PRP 03 era: `PRP 01 → PRP 02 → PRP 03`. A ordem real foi: `PRP 01 → PRP 03 → PRP 02`. O hub foi construido contra uma API que nao existia.

Consequencias:

1. O implementador do hub inventou suposicoes sobre o backend
2. Usou polling (`refetchInterval`) como substituto para o SSE que nao emitia eventos
3. Nao testou cenarios de falha porque nunca houve resposta real do backend
4. O modulo backend foi implementado depois, mas a montagem de rotas ficou incorreta

### Defeitos encontrados — Backend

**D1. Rotas dos modulos sao montadas tarde demais**

`index.ts` faz:

```
const app = new Hono();
app.route("/api", routes);   // linha 33 — congela rotas de `routes` no `app`
app.route("/", routes);       // linha 34

serve({ ... }, async () => {
  await startModules(modules, routes);  // linha 109 — adiciona ao `routes`, mas `app` ja congelou
});
```

O Hono copia rotas no `.route()`. Rotas adicionadas depois nao propagam. **Resultado: 404 em todas as rotas de `/api/modules/evolution/*`.**

**D2. Rotas de modulo fora do JWT barrier**

O PRP 01 especifica (linha 167): "As rotas ficam atras do JWT middleware barrier — mesma protecao das rotas existentes."

O `loader.ts` monta rotas no objeto `routes` via `app.route(\`/modules/${mod.name}\`, mod.routes)`. Mas como essa montagem acontece apos o JWT middleware (registrado na linha 47 do `routes/index.ts`), nao ha garantia de que o middleware intercepta as rotas do modulo.

O PRP 01 tambem especifica (linha 197): as rotas de modulo deveriam ser montadas em `routes/index.ts`, nao no callback async do `serve`.

**D3. O modulo cria `routes` dentro de `start()` — design correto, montagem incorreta**

O `evolutionModule` inicializa com `routes: undefined` e atribui em `start()` (linha 61). Isso e necessario porque as rotas dependem do probe, state e actions criados no `start()`. O problema nao e o design do modulo — e o timing da montagem no loader.

### Defeitos encontrados — Hub (Robustez)

**D4. Queries falham silenciosamente**

`evolutionInstancesQuery` retorna 404 (rota inexistente). O React Query trata como erro, mas `whatsapp.tsx:22` usa `data: instances = []`, mascarando o erro como "lista vazia". O operador ve a pagina vazia sem saber que o backend esta inacessivel.

**D5. `ApiHealthCard` mostra skeleton ou estado errado na falha**

Antes da correcao anterior, mostrava skeleton cinza. Apos a correcao, mostra "Verificando" (badge amarelo) e nunca transiciona — porque o backend retorna 404, a query falha, `health` nunca chega, e o badge fica preso em "Verificando" para sempre.

Nenhuma mensagem informa o operador que o backend nao respondeu.

**D6. Pagina de detalhe nao trata erro do backend**

`whatsapp-instance.tsx:76`: `useQuery(evolutionInstanceQuery(name))`. Se a API retorna 503 (api offline) ou 404 (rota inexistente), a pagina mostra "Instancia nao encontrada" — mensagem incorreta, porque o problema e de conectividade, nao de instancia.

**D7. Fluxo de QR fica preso em "loading" se a API falha**

`instance-qr.tsx:21-23`: o estado `qrState` transiciona para `"loading"`, dispara a query, mas se a query falha, nenhum `useEffect` detecta o erro. O componente fica no estado `"loading"` para sempre, com spinner infinito.

**D8. Nenhum componente exibe estado de erro**

Nenhum componente da area de conectividade tem logica para exibir "Falha ao carregar" com botao de retry ou informacao util. Quando uma query falha, o operador ve:
- Tela vazia (lista de instancias)
- "Verificando" eterno (health card)
- Spinner eterno (QR code)
- "Instancia nao encontrada" (detalhe — mensagem errada)

---

## Especificacao

### Regra de Robustez

**Todo componente que consome dados de uma query deve tratar 3 estados: carregando, sucesso e erro.** Nao existe excecao.

| Estado | O que o operador deve ver |
|--------|---------------------------|
| Carregando (primeira vez) | Indicador visual sutil (skeleton, badge "verificando", spinner). Nunca tela em branco. |
| Carregando (refetch) | Dados anteriores permanecem visiveis. Indicador sutil de atualizacao opcional. |
| Sucesso | Dados atualizados. |
| Erro | Mensagem clara do que falhou + acao possivel (retry, contato suporte). Nunca tela vazia, nunca spinner infinito, nunca mensagem errada. |

**O operador nunca deve precisar abrir o DevTools para entender o que esta acontecendo.**

---

### Correcao 1 — Montagem de rotas no backbone

**Problema:** `startModules` e chamado apos `app.route()`.

**Solucao:** Reestruturar `index.ts` para que toda inicializacao async (incluindo `startModules`) aconteca ANTES de montar rotas e iniciar o servidor.

**Novo fluxo de `index.ts`:**

```
1. Validar env vars
2. Imports
3. const app = new Hono()
4. Async bootstrap:
   a. await startModules(modules, routes)  ← ANTES de montar
   b. app.route("/api", routes)
   c. app.route("/", routes)
   d. serve({ ... }, callback-com-logging-e-heartbeat)
```

**Decisao:** O `serve` callback fica apenas para coisas que precisam do servidor rodando (log de porta, start de heartbeat, etc.). Toda inicializacao de estado (modulos, hooks) roda antes.

**Arquivo:** `apps/backbone/src/index.ts`

**Mudancas:**

1. Extrair logica de inicializacao do callback de `serve` para funcao async `bootstrap()`
2. Chamar `await startModules(modules, routes)` dentro de `bootstrap()`
3. Depois de `bootstrap()`, montar `app.route("/api", routes)` e `app.route("/", routes)`
4. `serve` callback fica apenas com logging e start de subsistemas nao-criticos

---

### Correcao 2 — Rotas de modulo atras do JWT barrier

**Problema:** Rotas montadas apos o middleware podem nao ser interceptadas.

**Solucao:** O `startModules` no `loader.ts` monta rotas no objeto `routes` que ja tem o JWT middleware registrado. Como a montagem agora acontece ANTES do `app.route()`, as rotas ficam corretamente atras do barrier.

**Verificacao:** Confirmar que `loader.ts:45` usa `app.route(\`/modules/${mod.name}\`, mod.routes)` onde `app` e o `routes` de `routes/index.ts` (que tem o JWT middleware). Isso ja e assim — o problema era apenas timing.

**Nenhuma mudanca em `loader.ts` e necessaria** se a Correcao 1 resolver o timing.

---

### Correcao 3 — `ApiHealthCard` com estado de erro

**Arquivo:** `apps/hub/src/components/connectivity/api-health-card.tsx`

**Estado atual:** Usa `isFetching` e `data` para decidir o que renderizar. Nao trata `isError`.

**Novo comportamento:**

| Condicao | Renderizacao |
|----------|--------------|
| `!health && isFetching` | Badge "Verificando" (amarelo) com `animate-pulse` |
| `!health && isError` | Badge "Indisponivel" (vermelho) + texto "Falha ao consultar o backbone" |
| `health` presente | Badge conforme `apiState` (online/offline/unknown) + response time + timestamp |
| `health` presente + `isFetching` | Badge com dados anteriores (sem piscar, sem esconder) |

**Decisao:** O texto de erro diz "backbone", nao "Evolution API". Porque quando a rota retorna 404/500, o problema e com o backbone, nao com a Evolution API em si.

---

### Correcao 4 — `WhatsAppPage` com estado de erro

**Arquivo:** `apps/hub/src/pages/whatsapp.tsx`

**Estado atual:** `data: instances = []` mascara erros como lista vazia.

**Novo comportamento:**

| Condicao | Renderizacao |
|----------|--------------|
| `isLoading` (primeira vez) | Texto "Carregando instancias..." (ja existe) |
| `isError` | Card de erro: icone `AlertTriangle`, titulo "Falha ao carregar instancias", texto `error.message`, botao "Tentar novamente" que chama `refetch()` |
| `instances.length === 0` (sucesso, lista vazia) | Texto "Nenhuma instancia encontrada" |
| `instances.length > 0` | Tabela normal |

**Decisao:** Quando `isError` e true, os `InstanceSummaryCards` devem receber array vazio (ou nao renderizar), e a tabela nao aparece. Apenas o card de erro.

---

### Correcao 5 — `WhatsAppInstancePage` com estado de erro

**Arquivo:** `apps/hub/src/pages/whatsapp-instance.tsx`

**Estado atual:** Mostra "Instancia nao encontrada" tanto para 404 real quanto para erro de rede.

**Novo comportamento:**

| Condicao | Renderizacao |
|----------|--------------|
| `isLoading` | Spinner (ja existe) |
| `isError` com status 404 | "Instancia nao encontrada" com link para voltar |
| `isError` com status 503 | "Evolution API indisponivel — o backbone nao conseguiu consultar a API" com botao retry |
| `isError` com outro status | "Falha ao carregar instancia" com `error.message` e botao retry |
| `instance` presente | Card de status normal |

**Decisao:** Diferenciar 404 de outros erros porque a mensagem e a acao sao diferentes. 404 = "nao existe, volte". 503/outros = "tente de novo".

---

### Correcao 6 — `InstanceQR` com tratamento de erro

**Arquivo:** `apps/hub/src/components/connectivity/instance-qr.tsx`

**Estado atual:** Se a query de QR falha, o estado fica preso em `"loading"` com spinner infinito.

**Novo comportamento:** Adicionar estado `"error"` a maquina de estados do QR.

| Estado QR | Condicao | Renderizacao |
|-----------|----------|--------------|
| `idle` | Inicial | Botao "Gerar QR Code" |
| `loading` | Query em andamento | Spinner + "Gerando QR code..." |
| `error` | Query falhou | Icone de erro + mensagem + botao "Tentar novamente" |
| `active` | QR recebido | Imagem QR + countdown |
| `linked` | Instancia ficou `open` | Sucesso |
| `expired` | Countdown zerou | QR expirado + botao gerar novo |
| `exhausted` | 5 tentativas | Limite atingido |

**Transicao para `error`:** Observar `isError` da query de QR. Se `qrState === "loading"` e `isError === true`, transicionar para `"error"`.

**O botao "Tentar novamente" em `error` NAO incrementa o contador de tentativas.** Ele retenta a mesma tentativa.

---

### Correcao 7 — Regra anti-polling no CLAUDE.md

**Arquivo:** `agentic-backbone/CLAUDE.md`

**Motivo:** Garantir que futuros implementadores nao reintroduzam polling.

Adicionar secao `### Data Fetching (Hub)` apos `### Routing (Hub)` com regra:

- Polling (`refetchInterval`) proibido no hub
- SSE e a fonte de verdade para atualizacoes em tempo real
- Queries buscam dados apenas: montagem, resposta a SSE, apos mutations
- Proibido criar novos canais SSE sem justificativa

**Nota:** Esta regra ja foi adicionada anteriormente, e o CLAUDE.md ja foi editado pelo usuario removendo-a. Verificar estado atual do arquivo antes de adicionar. Se ja existir, nao duplicar. Se foi removida intencionalmente, nao readicionar.

---

### Correcao 8 — Remover polling das queries

**Arquivo:** `apps/hub/src/api/evolution.ts`

Remover `refetchInterval: 10_000` de:

- `evolutionHealthQuery` (linha 48)
- `evolutionInstancesQuery` (linha 54)
- `evolutionInstanceQuery` (linha 62)

**Excecao:** O `refetchInterval: 2_000` condicional em `instance-qr.tsx:29` (usado apenas durante fluxo de QR ativo) esta correto e deve permanecer. Polling durante QR e necessario porque o SSE nao garante timing suficiente para detectar vinculacao.

**Nota:** A remocao do polling das queries em `evolution.ts` ja foi feita na sessao anterior. Verificar estado atual antes de re-aplicar.

---

## Arquivos modificados

| # | Arquivo | Mudanca |
|---|---------|---------|
| 1 | `apps/backbone/src/index.ts` | Reestruturar para `startModules` antes de `app.route()` |
| 2 | `apps/hub/src/components/connectivity/api-health-card.tsx` | Tratar `isError`, nunca spinner infinito |
| 3 | `apps/hub/src/pages/whatsapp.tsx` | Tratar `isError` com card de erro e retry |
| 4 | `apps/hub/src/pages/whatsapp-instance.tsx` | Diferenciar 404/503/outros erros |
| 5 | `apps/hub/src/components/connectivity/instance-qr.tsx` | Adicionar estado `error` na maquina de estados |
| 6 | `apps/hub/src/api/evolution.ts` | Confirmar que polling foi removido |
| 7 | `agentic-backbone/CLAUDE.md` | Confirmar que regra anti-polling existe |

---

## Limites

### O que este PRP NAO cobre

- **Nao refatora o sistema de modulos.** O PRP 01 define o contrato e este PRP apenas corrige o timing da montagem.
- **Nao reimplementa o modulo Evolution.** O PRP 02 esta correto — o problema e a montagem, nao o modulo.
- **Nao reimplementa o hub.** Os componentes do PRP 03 estao corretos na estrutura. Este PRP adiciona tratamento de erro aos existentes.
- **Nao implementa retry automatico nas queries.** O React Query ja tem retry built-in (3 tentativas por padrao). Este PRP trata o estado visual apos todas as tentativas falharem.
- **Nao cria error boundaries React.** Este PRP trata erros a nivel de componente (por query). Error boundaries globais sao escopo de outro PRP.

### Restricoes

- As correcoes devem manter compatibilidade com todos os outros consumidores do event bus e SSE.
- Mensagens de erro devem ser em pt-BR.
- Componentes de erro devem usar shadcn existentes (Card, Badge, Alert) — nao inventar componentes novos.
- Nao usar `console.error` ou `console.log` no hub como substituto para feedback visual.

---

## Validacao

### Criterios de Aceite

**Montagem de rotas:**

- [ ] `GET /api/modules/evolution/health` retorna 200 com JSON valido (nao 404)
- [ ] `GET /api/modules/evolution/instances` retorna 200 ou 503 (nao 404)
- [ ] Rotas de modulo exigem JWT (401 sem token)
- [ ] Build backend passa: `npm run build --workspace=apps/backbone`

**Robustez do hub:**

- [ ] Com backend rodando: pagina WhatsApp mostra dados normalmente
- [ ] Com backend parado: pagina WhatsApp mostra card de erro com mensagem clara e botao retry
- [ ] Card de saude com backend rodando: badge verde "Online" ou vermelho "Offline" conforme estado real
- [ ] Card de saude com backend parado: badge vermelho "Indisponivel" + texto informativo (nao "Verificando" eterno)
- [ ] Detalhe de instancia com API offline: mensagem "API indisponivel" (nao "Instancia nao encontrada")
- [ ] QR code com API offline: mensagem de erro + botao retry (nao spinner infinito)
- [ ] Nenhum spinner infinito em nenhum cenario de falha
- [ ] Nenhuma tela em branco em nenhum cenario de falha
- [ ] Build hub passa: `npm run build --workspace=apps/hub`

**Anti-polling:**

- [ ] DevTools → Network: nenhuma requisicao periodica a `/modules/evolution/*` (exceto durante QR ativo)
- [ ] Eventos SSE atualizam queries corretamente quando backbone esta rodando

### Comandos de validacao

```bash
npm run build --workspace=apps/backbone
npm run build --workspace=apps/hub
```
