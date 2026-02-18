# Evolution Hub — Interface de Gestao de Conectividade WhatsApp

O modulo Evolution (PRP 02) garante que o backbone nunca perde consciencia situacional sobre as instancias WhatsApp. Mas consciencia sem interface e inutil — o operador precisa ver, entender e agir. Este PRP define a interface no hub que consome os dados e eventos do modulo Evolution e entrega ao operador um painel completo de gestao: monitoramento em tempo real, CRUD de instancias, vinculacao via QR code, e acoes corretivas.

---

## Objetivo

Implementar no hub a area de gestao de conectividade WhatsApp, acessivel em `/conectividade/whatsapp`, com monitoramento em tempo real, CRUD completo de instancias, vinculacao QR, e acoes corretivas.

## Execution Mode

`implementar`

---

## Contexto

### Estado Atual do Hub

O hub e um SPA que consome a API do backbone. Utiliza:

- TanStack React Router com rotas tipadas e search params validados via zod
- TanStack React Query para estado de servidor (queries + mutations)
- shadcn + Radix para componentes de UI
- SSE via hook `useSSE()` para eventos em tempo real
- Zustand para estado de auth e UI
- Convencao: `PageHeader` em toda pagina, `Card` para dados, `StatusBadge` para status

### Sidebar Atual

```
Overview:   Dashboard
Resources:  Chat, Agents, Channels, Memory, Skills, Tools, Adapters, Jobs
Admin:      Users, System
```

### O que o Modulo Evolution (PRP 02) Disponibiliza

**Rotas ja definidas no PRP 02:**

| Metodo | Path | Retorno |
|--------|------|---------|
| `GET` | `/api/modules/evolution/health` | Estado da API + ultimo probe |
| `GET` | `/api/modules/evolution/instances` | Lista de instancias com estado, since, duracao |
| `GET` | `/api/modules/evolution/instances/:name` | Detalhe de uma instancia |
| `POST` | `/api/modules/evolution/instances/:name/reconnect` | Acao de reconnect |
| `POST` | `/api/modules/evolution/instances/:name/restart` | Acao de restart |

**Eventos SSE ja definidos no PRP 02:**

`api-online`, `api-offline`, `instance-discovered`, `instance-removed`, `instance-connected`, `instance-disconnected`, `instance-reconnecting`, `instance-unstable`, `instance-prolonged-offline`, `action-success`, `action-failed`, `action-exhausted`

### O que Falta no Backend (Rotas CRUD + QR)

O PRP 02 cobre monitoramento e acoes corretivas, mas nao cobre CRUD nem vinculacao QR — estava fora do escopo de "gestao robusta de conectividade". Para esta interface funcionar completa, o modulo Evolution precisa de rotas adicionais:

| Metodo | Path | Proposito |
|--------|------|-----------|
| `POST` | `/api/modules/evolution/instances` | Criar nova instancia |
| `DELETE` | `/api/modules/evolution/instances/:name` | Remover instancia |
| `GET` | `/api/modules/evolution/instances/:name/qr` | Obter QR code para vinculacao |
| `GET` | `/api/modules/evolution/instances/:name/settings` | Configuracoes da instancia |
| `PATCH` | `/api/modules/evolution/instances/:name/settings` | Atualizar configuracoes |

**Decisao:** Estas rotas sao proxy para a Evolution API, passando pela camada do modulo. O hub nunca chama a Evolution API diretamente — todo acesso passa pelo modulo, mantendo o encapsulamento. O modulo repassa a chamada, invalida seu cache de estado, e retorna o resultado.

**Este PRP assume que essas rotas serao adicionadas ao modulo Evolution como extensao do PRP 02.**

---

## Especificacao

### 1. Navegacao

#### Nova secao no sidebar

Adicionar secao **Conectividade** no sidebar, entre Resources e Admin:

```
Overview:        Dashboard
Resources:       Chat, Agents, Channels, Memory, Skills, Tools, Adapters, Jobs
Conectividade:   WhatsApp
Admin:           Users, System
```

- Icone da secao: `Cable` (lucide)
- Item WhatsApp: icone `MessageCircle` (lucide)
- Path: `/conectividade/whatsapp`
- Active state: `location.pathname.startsWith("/conectividade/whatsapp")`

**Decisao:** A secao se chama "Conectividade" (nao "Evolution") porque no futuro pode abrigar outros canais (Telegram, SMS, etc.). O item se chama "WhatsApp" porque e o que o operador entende.

#### Rota de indice `/conectividade`

Pagina simples com grid de cards, um por tipo de conectividade. Por ora, apenas WhatsApp. Cada card mostra:

- Nome do canal (WhatsApp)
- Icone
- Status resumido: `N online · N offline`
- Link para a pagina de gestao

**Decisao:** Essa pagina existe para a estrutura ser extensivel. Se amanha houver Telegram, ele aparece aqui como outro card. Enquanto so houver WhatsApp, o sidebar pode linkar diretamente para `/conectividade/whatsapp`, mas a rota `/conectividade` deve existir.

---

### 2. Rotas

| Path | Componente | Proposito |
|------|------------|-----------|
| `/conectividade` | `ConnectivityPage` | Indice de canais disponiveis |
| `/conectividade/whatsapp` | `WhatsAppPage` | Dashboard: saude da API + lista de instancias |
| `/conectividade/whatsapp/$name` | `WhatsAppInstancePage` | Detalhe de uma instancia: estado, QR, acoes, settings |

**Search params em `/conectividade/whatsapp`:**

| Param | Tipo | Default | Proposito |
|-------|------|---------|-----------|
| `view` | `"monitor" \| "instances"` | `"monitor"` | Aba ativa |

**Search params em `/conectividade/whatsapp/$name`:**

| Param | Tipo | Default | Proposito |
|-------|------|---------|-----------|
| `tab` | `"status" \| "qr" \| "settings"` | `"status"` | Aba ativa |

---

### 3. Pagina WhatsApp — Dashboard (`/conectividade/whatsapp`)

Pagina principal com duas abas: **Monitor** e **Instancias**.

#### Aba Monitor (default)

**Cabecalho:**

```
PageHeader
  title: "WhatsApp"
  description: "Gestao de conectividade WhatsApp via Evolution API"
  actions: [Botao "Nova Instancia"]
```

**Card de Saude da API:**

Card no topo mostrando:

| Campo | Fonte | Apresentacao |
|-------|-------|--------------|
| Status da API | `GET /health` → modules.evolution | Badge: `healthy` = verde, `degraded` = amarelo, `unhealthy` = vermelho |
| Tempo de resposta | detalhe do health | Texto: ex. "142ms" |
| Ultimo probe | detalhe do health | Texto: ex. "ha 3s" (tempo relativo) |

**Atualizado via SSE:** eventos `api-online` e `api-offline` atualizam o card sem polling.

**Cards de Resumo:**

Tres cards lado a lado (grid 3 colunas em desktop, stack em mobile):

| Card | Valor | Cor |
|------|-------|-----|
| Online | Contagem de instancias com state `open` | `bg-chart-2` (verde) |
| Conectando | Contagem com state `connecting` | `bg-chart-4` (amarelo) |
| Offline | Contagem com state `close` | `bg-destructive` (vermelho) |

**Lista de Instancias (Monitor View):**

Tabela com todas as instancias, **ordenada por criticidade**:

1. `close` primeiro (mais critico)
2. `connecting` depois
3. `open` por ultimo

Dentro de cada grupo, ordenar por duracao no estado (mais tempo primeiro).

| Coluna | Conteudo |
|--------|----------|
| Nome | `instanceName` |
| Numero | `owner` (telefone vinculado, ou "Nao vinculado") |
| Estado | StatusBadge com cor semantica |
| Duracao | Tempo no estado atual (ex: "ha 3min", "ha 2h") — calculado a partir de `since` |
| Acoes | Botoes: Reconectar, Reiniciar (desabilitados se instancia `open`) |

**Tempo relativo:** Usar calculo client-side a partir do `since` timestamp. Atualizar a cada 10 segundos via `setInterval` (nao precisa de nova query — e calculo local).

**Atualizacao em tempo real:**

- Query com `refetchInterval: 10_000` como fallback
- SSE `module:evolution:*` invalida a query `["evolution", "instances"]` em cada evento de instancia, forcando refresh imediato

**Alertas visuais:**

- Instancia com evento `instance-unstable` recente: mostrar icone de alerta (`AlertTriangle`, lucide) ao lado do nome, com tooltip "Conexao instavel — N reconexoes nos ultimos 5min"
- Instancia com evento `instance-prolonged-offline`: mostrar badge "Offline prolongado" em vermelho, ao lado da duracao

#### Aba Instancias

Mesma tabela, mas com foco em CRUD:

| Coluna | Conteudo |
|--------|----------|
| Nome | `instanceName` (link para detalhe) |
| Numero | `owner` |
| Estado | StatusBadge |
| Perfil | `profileName` se disponivel |
| Acoes | Menu dropdown: Ver detalhes, Reconectar, Reiniciar, Excluir |

**Botao "Nova Instancia":** Abre dialog de criacao (ver secao 5).

**Acao "Excluir":** Usa `ConfirmDialog` com confirmacao por texto. O operador deve digitar o nome da instancia para confirmar. Isso previne exclusao acidental.

---

### 4. Pagina Detalhe da Instancia (`/conectividade/whatsapp/$name`)

Tres abas: **Status**, **QR Code**, **Configuracoes**.

#### Aba Status (default)

**Cabecalho:**

```
PageHeader
  title: instanceName
  description: owner (telefone) ou "Nao vinculado"
  actions: [Reconectar, Reiniciar, Excluir]
```

**Card de Estado:**

| Campo | Apresentacao |
|-------|--------------|
| Estado atual | StatusBadge grande com icone |
| Desde | Data/hora absoluta + tempo relativo |
| Estado anterior | Texto + duracao que ficou nele |
| Perfil | Nome do perfil WhatsApp (se disponivel) |

**Acoes Corretivas:**

Botoes "Reconectar" e "Reiniciar" com feedback visual:

- Estado normal: botao habilitado
- Executando: botao com spinner + disabled
- Sucesso: toast de sucesso via sonner
- Falha: toast de erro com mensagem
- Cooldown: botao disabled com tooltip "Aguarde Xmin" (baseado no `retryAfterMs` do 429)
- Esgotado: botao disabled com tooltip "Tentativas esgotadas" (baseado no 409)

**Feed de Eventos:**

Lista cronologica dos ultimos eventos dessa instancia, atualizada em tempo real via SSE. Cada evento mostra:

- Timestamp (relativo)
- Tipo do evento (ex: "Desconectou", "Reconectou", "Instavel")
- Icone e cor por severidade

**Decisao:** O feed de eventos e client-side only — acumula eventos recebidos via SSE numa ref local. Nao persiste entre recargas de pagina. Isso e aceitavel porque o estado atual e sempre reconstruido pela query, e o feed e apenas contexto adicional.

#### Aba QR Code

**Fluxo de vinculacao:**

```
1. Operador clica "Gerar QR Code"
2. UI chama GET /instances/:name/qr
3. Exibe QR code com countdown de 60 segundos
4. Poll GET /instances/:name a cada 2 segundos
5. Se estado vira "open": exibir sucesso, parar poll
6. Se countdown chega a 0: QR expirado, permitir "Gerar Novo"
7. Maximo de 5 tentativas por sessao
```

**Estados visuais:**

| Estado | Apresentacao |
|--------|--------------|
| Aguardando | Botao "Gerar QR Code" |
| QR ativo | Imagem QR + countdown + texto "Escaneie com WhatsApp" |
| Vinculado | Icone de sucesso + "Instancia vinculada com sucesso" |
| Expirado | Texto "QR expirado" + botao "Gerar Novo" |
| Tentativas esgotadas | Texto "Limite de tentativas atingido. Recarregue a pagina para tentar novamente." |

**Decisao:** O QR code e exibido como imagem (base64 retornada pela Evolution API). O poll de estado usa a query de instancia individual com `refetchInterval: 2000` habilitado apenas enquanto o QR esta ativo.

#### Aba Configuracoes

Formulario com as configuracoes da instancia. Campos retornados por `GET /instances/:name/settings`:

- **reject_call** (boolean) — Rejeitar chamadas automaticamente
- **msg_call** (string) — Mensagem ao rejeitar chamada
- **groups_ignore** (boolean) — Ignorar mensagens de grupos
- **always_online** (boolean) — Manter status sempre online
- **read_messages** (boolean) — Marcar mensagens como lidas
- **read_status** (boolean) — Marcar status como visto

**Formulario:** React Hook Form + zod validation. Botao "Salvar" chama `PATCH /instances/:name/settings`. Toast de sucesso/erro.

**Decisao:** Listar apenas os campos acima — sao os mais relevantes para operacao. Configuracoes avancadas da Evolution API (webhooks, chatwoot, typebot) estao fora de escopo.

---

### 5. Dialog de Criacao de Instancia

Acionado pelo botao "Nova Instancia" na pagina WhatsApp.

**Campos:**

| Campo | Tipo | Obrigatorio | Validacao |
|-------|------|:-----------:|-----------|
| Nome da instancia | text | sim | Apenas letras minusculas, numeros e hifens. Min 3, max 30 caracteres. |

**Comportamento:**

1. Operador preenche nome e clica "Criar"
2. `POST /api/modules/evolution/instances` com `{ instanceName }`
3. Se sucesso: fecha dialog, invalida query de instancias, navega para detalhe da instancia na aba QR
4. Se erro (nome duplicado, etc.): exibe mensagem no dialog

**Decisao:** Apenas o nome e pedido na criacao. A vinculacao (QR code) e feita na pagina de detalhe. Isso separa a criacao (rapida) da vinculacao (interativa).

---

### 6. Camada de API no Hub

Arquivo: `src/api/evolution.ts`

**Queries:**

| Query Key | Endpoint | Intervalo |
|-----------|----------|-----------|
| `["evolution", "health"]` | `GET /api/modules/evolution/health` | 10s |
| `["evolution", "instances"]` | `GET /api/modules/evolution/instances` | 10s |
| `["evolution", "instances", name]` | `GET /api/modules/evolution/instances/:name` | 10s (2s durante QR ativo) |
| `["evolution", "instances", name, "settings"]` | `GET /api/modules/evolution/instances/:name/settings` | — |
| `["evolution", "instances", name, "qr"]` | `GET /api/modules/evolution/instances/:name/qr` | — |

**Mutations:**

| Mutation | Endpoint | Invalidacoes |
|----------|----------|-------------|
| `useCreateInstance()` | `POST /instances` | `["evolution", "instances"]` |
| `useDeleteInstance()` | `DELETE /instances/:name` | `["evolution", "instances"]` |
| `useReconnectInstance()` | `POST /instances/:name/reconnect` | `["evolution", "instances", name]` |
| `useRestartInstance()` | `POST /instances/:name/restart` | `["evolution", "instances", name]` |
| `useUpdateSettings()` | `PATCH /instances/:name/settings` | `["evolution", "instances", name, "settings"]` |

---

### 7. Integracao SSE

Hook `useSSE()` conectado a `/system/events`. Filtrar eventos com prefixo `module:evolution:`.

**Efeitos por evento:**

| Evento | Efeito no Hub |
|--------|---------------|
| `api-online` / `api-offline` | Invalida `["evolution", "health"]` |
| `instance-*` (todos) | Invalida `["evolution", "instances"]` |
| `instance-unstable` | Toast warning: "Instancia {name} com conexao instavel" |
| `instance-prolonged-offline` | Toast destructive: "Instancia {name} offline ha mais de 5 minutos" |
| `action-success` | Toast sucesso: "Acao executada com sucesso em {name}" |
| `action-failed` | Toast erro: "Falha ao executar acao em {name}" |
| `action-exhausted` | Toast destructive: "Todas as tentativas esgotadas para {name}" |

**Decisao:** Toasts sao disparados diretamente pelo listener SSE — nao dependem da pagina estar aberta. Se o operador esta em qualquer pagina do hub, ele ve o toast. Isso implementa a camada de "feedback imediato" do modelo de robustez.

---

### 8. Responsividade

**Desktop (>= md):** Layout com sidebar + conteudo. Tabelas completas. Cards em grid 3 colunas.

**Mobile (< md):** Bottom nav. Cards em stack. Tabela simplificada (esconde colunas secundarias). Acoes via menu dropdown em vez de botoes inline.

| Elemento | Desktop | Mobile |
|----------|---------|--------|
| Cards de resumo | Grid 3 colunas | Stack vertical |
| Tabela de instancias | Todas as colunas | Nome, Estado, Duracao. Acoes em dropdown. |
| Acoes na pagina de detalhe | Botoes no PageHeader | Botoes abaixo do card de estado |
| QR code | Card centralizado | Full-width card |

---

### Estrutura de Arquivos

```
src/
  api/
    evolution.ts                   ← queries, mutations, tipos
  pages/
    connectivity.tsx               ← /conectividade (indice)
    whatsapp.tsx                   ← /conectividade/whatsapp (dashboard)
    whatsapp-instance.tsx          ← /conectividade/whatsapp/$name (detalhe)
  components/
    connectivity/
      api-health-card.tsx          ← card de saude da API
      instance-summary-cards.tsx   ← cards online/connecting/offline
      instance-table.tsx           ← tabela de instancias (reutilizada nas 2 abas)
      instance-status-card.tsx     ← card de estado na pagina de detalhe
      instance-event-feed.tsx      ← feed de eventos em tempo real
      instance-qr.tsx              ← fluxo de QR code
      instance-settings-form.tsx   ← formulario de configuracoes
      create-instance-dialog.tsx   ← dialog de criacao
```

### Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/App.tsx` | Adicionar rotas: `/conectividade`, `/conectividade/whatsapp`, `/conectividade/whatsapp/$name` |
| `src/components/layout/app-sidebar.tsx` | Adicionar secao "Conectividade" com item "WhatsApp" |

---

## Limites

### O que este PRP NAO cobre

- **Nao implementa backend.** Este PRP e exclusivamente frontend (hub). As rotas do backend sao definidas nos PRPs 01 e 02.
- **Nao implementa envio/recebimento de mensagens WhatsApp.** Isso e funcionalidade de chat, nao de gestao de conectividade.
- **Nao implementa webhooks ou configuracao avancada da Evolution** (Chatwoot, Typebot, etc.).
- **Nao implementa notificacoes push.** O hub usa toasts para feedback imediato. Push e escopo de outro PRP.
- **Nao implementa historico persistente de eventos.** O feed de eventos e client-side only — se recarregar a pagina, o feed reseta.

### Restricoes

- Toda comunicacao com a Evolution API passa pelo modulo do backbone (`/api/modules/evolution/`). O hub nunca chama a Evolution diretamente.
- Seguir os padroes visuais existentes do hub: shadcn, CSS tokens (nao cores Tailwind diretas), PageHeader, Card, StatusBadge.
- Toda navegacao e bookmarkable — estado relevante vive na URL (search params), nao em state local.
- Textos da interface em pt-BR.

---

## Dependencias

Este PRP depende de:

- **PRP 01** (Sistema de Modulos) — para que `/api/modules/evolution/` exista
- **PRP 02** (Modulo Evolution) — para rotas de monitoramento e acoes corretivas
- **Extensao do PRP 02** — para rotas CRUD e QR code (listadas na secao Contexto)

Ordem de implementacao: PRP 01 → PRP 02 (+ extensoes CRUD/QR) → PRP 03

---

## Validacao

### Criterios de Aceite

**Navegacao:**

- [ ] Secao "Conectividade" visivel no sidebar com item "WhatsApp"
- [ ] Rota `/conectividade` exibe grid de canais disponiveis
- [ ] Rota `/conectividade/whatsapp` exibe dashboard
- [ ] Rota `/conectividade/whatsapp/:name` exibe detalhe da instancia
- [ ] Todas as rotas sao protegidas por auth (redirect para login se nao autenticado)
- [ ] Todas as rotas sao bookmarkable (F5 restaura a mesma view)

**Monitor:**

- [ ] Card de saude mostra status da API com cor semantica
- [ ] Cards de resumo mostram contagem online/connecting/offline
- [ ] Tabela lista instancias ordenadas por criticidade
- [ ] Duracao no estado atual e exibida e atualizada periodicamente
- [ ] Instancias instaveis mostram indicador visual
- [ ] Instancias com offline prolongado mostram indicador visual
- [ ] Eventos SSE atualizam a tabela em tempo real

**CRUD:**

- [ ] Botao "Nova Instancia" abre dialog de criacao
- [ ] Instancia criada aparece na lista
- [ ] Link para detalhe funciona
- [ ] Exclusao requer confirmacao por texto
- [ ] Instancia excluida desaparece da lista

**QR Code:**

- [ ] QR code e exibido apos clicar "Gerar QR Code"
- [ ] Countdown de 60 segundos visivel
- [ ] Ao vincular (estado vira `open`): exibe sucesso
- [ ] Ao expirar: exibe opcao de gerar novo
- [ ] Maximo 5 tentativas por sessao

**Acoes Corretivas:**

- [ ] Botao "Reconectar" chama endpoint e mostra feedback
- [ ] Botao "Reiniciar" chama endpoint e mostra feedback
- [ ] Cooldown exibido quando 429 retornado
- [ ] Tentativas esgotadas exibidas quando 409 retornado
- [ ] Toasts disparados por eventos SSE (instavel, prolonged-offline, action-*)

**Responsividade:**

- [ ] Layout funcional em mobile (< md)
- [ ] Layout funcional em desktop (>= md)

### Comando de validacao

```bash
npm run build --workspace=apps/hub
```
