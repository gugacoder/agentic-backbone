# AB Hub - Canais e Integracao WhatsApp

Gestao de canais de comunicacao e configuracao de integracao WhatsApp via Evolution API.

---

## 1. Objetivo

- Listar e gerenciar canais de comunicacao (chat, WhatsApp, voz)
- Configurar integracao WhatsApp (Evolution API) via interface visual
- Fluxo de pareamento por QR Code
- Monitorar status de conexao dos canais
- Resolver D-003 (integracao WhatsApp), G-005 (WhatsApp nativo), G-001 (atendimento 24/7)

---

## 2. API Endpoints Existentes

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/channels` | Listar canais |
| GET | `/channels/:slug` | Detalhe do canal |
| POST | `/channels` | Criar canal |
| PATCH | `/channels/:slug` | Atualizar canal |
| DELETE | `/channels/:slug` | Remover canal |
| GET | `/channels/:slug/events` | SSE de eventos do canal |
| POST | `/channels/:slug/messages` | Enviar mensagem pelo canal |
| GET | `/adapters` | Listar adapters (conectores) |
| POST | `/adapters` | Criar adapter |
| PATCH | `/adapters/:scope/:slug` | Atualizar adapter |
| DELETE | `/adapters/:scope/:slug` | Remover adapter |

---

## 3. Telas

### 3.1 Lista de Canais (`/channels`)

**Layout:** Grid de cards (similar a agentes).

**ChannelCard:**

| Campo | Fonte | Visual |
|-------|-------|--------|
| Nome | `channel.slug` | Titulo |
| Tipo | `channel.type` | Badge (chat / whatsapp / voice) |
| Owner | `channel.owner` | Texto sutil |
| Listeners | `channel.listeners` | Numero de conexoes ativas |
| Status | SSE / probe | Badge verde (conectado) / vermelho (desconectado) |

**Acoes:**
- Botao "Novo Canal" → dialog com tipo e configuracao
- Filtro por tipo

### 3.2 Detalhe do Canal (`/channels/:slug`)

**Tabs:**

| Tab | Conteudo |
|-----|----------|
| Status | Status de conexao, metricas, info do adapter |
| Configuracao | Form para editar canal e adapter |
| Mensagens | Feed de mensagens recentes do canal (SSE) |

### 3.3 Setup WhatsApp (fluxo especifico)

Quando o tipo do canal eh WhatsApp (Evolution API):

**Passo 1 — Criar instancia:**
- Form com nome da instancia
- `POST /adapters` com connector `evolution`

**Passo 2 — QR Code:**
- Exibir QR Code para parear WhatsApp
- Polling condicional do status (unica excecao ao veto de polling)
- Feedback visual: "Aguardando leitura do QR Code..."
- Auto-refresh do QR a cada 30s

**Passo 3 — Conectado:**
- Exibir numero pareado e status
- Botao para desconectar/reconectar
- Atribuir canal a um agente

### 3.4 Feed de Mensagens do Canal

- Timeline vertical com mensagens recebidas/enviadas
- Via SSE do canal (`/channels/:slug/events`)
- Cada mensagem: remetente, conteudo, timestamp
- Indicador visual de direcao (inbound / outbound)

---

## 4. Componentes

### 4.1 ChannelCard

**Localizacao:** `components/channels/channel-card.tsx`

```typescript
interface ChannelCardProps {
  channel: Channel;
  onSelect: (slug: string) => void;
}
```

### 4.2 WhatsAppSetup

**Localizacao:** `components/channels/whatsapp-setup.tsx`

```typescript
interface WhatsAppSetupProps {
  adapterId?: string;
  onComplete: () => void;
}
```

- Wizard de 3 passos
- QR Code renderizado com `qrcode` lib

### 4.3 ChannelMessageFeed

**Localizacao:** `components/channels/channel-message-feed.tsx`

```typescript
interface ChannelMessageFeedProps {
  channelSlug: string;
}
```

- Conecta ao SSE do canal especifico
- Auto-scroll com mensagens novas

---

## 5. Criterios de Aceite

- [ ] Lista de canais exibe todos os canais do backbone
- [ ] Cards mostram tipo com icone diferenciado (chat, whatsapp, voice)
- [ ] Status de conexao atualiza em tempo real
- [ ] Criar canal WhatsApp exibe QR Code para pareamento
- [ ] QR Code atualiza automaticamente ate ser lido
- [ ] Apos parear, canal mostra status "conectado" com numero
- [ ] Feed de mensagens exibe mensagens em tempo real via SSE
- [ ] Desconectar/reconectar WhatsApp funciona
- [ ] Canal pode ser atribuido a um agente
- [ ] Excluir canal pede confirmacao
- [ ] Layout responsivo

---

## 6. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| ChannelCard | D-003, G-005 (WhatsApp nativo) |
| WhatsAppSetup | D-003 (integracao sem complexidade tecnica) |
| MessageFeed | G-001 (atendimento 24/7 — visibilidade) |
| Status Live | D-001 (visibilidade), D-005 (fragmentacao) |
