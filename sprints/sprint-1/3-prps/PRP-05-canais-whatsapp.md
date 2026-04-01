# PRP-05 — Canais e Integracao WhatsApp

Gestao de canais de comunicacao e configuracao de integracao WhatsApp via Evolution API com fluxo de pareamento por QR Code.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O Hub tem scaffold (PRP-01). A pagina `/channels` existe como placeholder. O backbone expoe:

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

O conector Evolution esta implementado no backbone com probe de status, QR code, e channel-adapter.

### Estado desejado

1. Lista de canais com status de conexao
2. Detalhe do canal com status, config e feed de mensagens
3. Wizard de setup WhatsApp com QR Code
4. Feed de mensagens em tempo real via SSE

## Especificacao

### Feature F-020: Lista de canais + ChannelCard

**Substituir placeholder** `routes/_authenticated/channels.tsx`:

- Fetch via `channelsQueryOptions()` (loader)
- Grid responsivo de cards (similar a agentes)

**components/channels/channel-card.tsx:**

```typescript
interface ChannelCardProps {
  channel: Channel;
  onSelect: (slug: string) => void;
}
```

| Campo | Fonte | Visual |
|-------|-------|--------|
| Nome | `channel.slug` | Titulo do card |
| Tipo | `channel.type` | Badge com icone (MessageSquare=chat, Phone=whatsapp, PhoneCall=voice) |
| Owner | `channel.owner` | Texto sutil |
| Listeners | `channel.listeners` | Numero de conexoes ativas |
| Status | calculado | StatusBadge verde (conectado) / vermelho (desconectado) |

**Barra de acoes (PageHeader):**
- Filtro por tipo (Select: todos / chat / whatsapp / voice)
- Botao "Novo Canal" → dialog com tipo de canal e configuracao basica

**Comportamento:**
- Click no card → navega para `/channels/:slug`
- SSE `registry:adapters` → invalida query `["channels"]`

### Feature F-021: Detalhe do canal + status

**routes/_authenticated/channels.$slug.tsx:**

- Fetch via `channelQueryOptions(slug)` (loader)
- Tabs horizontais:

| Tab | Valor | Conteudo |
|-----|-------|----------|
| Status | `status` | Info de conexao, adapter, acoes |
| Configuracao | `config` | Form de edicao do canal |
| Mensagens | `messages` | Feed em tempo real (F-023) |

- Tab ativa controlada por `?tab=status`

**Tab Status:**
- Info do adapter: connector type, status de conexao
- Para WhatsApp: numero pareado, estado da instancia
- Botoes: Reconectar, Desconectar
- Atribuicao a agente (Select com agentes disponiveis)

**Tab Configuracao:**
- Form para editar canal: `PATCH /channels/:slug`
- Campos dependem do tipo de canal
- Botao "Excluir Canal" com `ConfirmDialog`

### Feature F-022: Setup WhatsApp (wizard QR Code)

**Trigger:** Botao "Novo Canal" com tipo WhatsApp, ou navegacao direta.

**components/channels/whatsapp-setup.tsx:**

```typescript
interface WhatsAppSetupProps {
  onComplete: () => void;
}
```

**Wizard de 3 passos:**

**Passo 1 — Criar instancia:**
- Input: nome da instancia
- `POST /adapters` com `{ connector: "evolution", credential: {...}, options: {...} }`
- Sucesso → avanca para passo 2

**Passo 2 — QR Code:**
- Exibir QR Code para parear WhatsApp
- QR code vem do adapter via endpoint de probe/status
- **Excecao ao veto de polling:** polling condicional a cada 5s para verificar se QR foi lido (unico caso permitido conforme CLAUDE.md)
- Auto-refresh do QR a cada 30s (QR codes expiram)
- Feedback visual: "Aguardando leitura do QR Code..."
- Se pareado → avanca para passo 3
- Renderizar QR com biblioteca `qrcode.react`

**Passo 3 — Conectado:**
- Exibir numero pareado e status "Conectado"
- Botao "Concluir" → invalida queries, fecha wizard

### Feature F-023: Feed de mensagens do canal

**Substituir placeholder** da tab Mensagens no detalhe do canal.

**components/channels/channel-message-feed.tsx:**

```typescript
interface ChannelMessageFeedProps {
  channelSlug: string;
}
```

- Conecta ao SSE do canal: `GET /channels/:slug/events?token=<jwt>`
- Timeline vertical com mensagens recebidas e enviadas
- Cada mensagem:

| Campo | Visual |
|-------|--------|
| Direcao | Icone (ArrowDown=inbound, ArrowUp=outbound) |
| Remetente | Nome ou numero |
| Conteudo | Texto |
| Timestamp | Relativo |

- Auto-scroll com mensagens novas
- Mensagens acumulam durante a sessao (nao persistidas no client)
- ScrollArea do shadcn

## Limites

- **NAO** implementar envio de mensagens pelo hub diretamente ao canal — apenas visualizacao do feed.
- **NAO** implementar gestao de templates de WhatsApp (HSM) — fora do escopo deste sprint.
- **NAO** implementar multiplas instancias WhatsApp simultaneas — um canal por instancia.
- **NAO** implementar configuracao de webhook da Evolution — o backbone ja gerencia isso.
- **NAO** usar polling exceto no fluxo de QR Code (conforme CLAUDE.md).

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado.
- **Variavel de ambiente** `EVOLUTION_URL` deve estar configurada no backbone para o modulo Evolution carregar.

## Validacao

- [ ] Lista de canais exibe todos os canais do backbone
- [ ] Cards mostram tipo com icone diferenciado (chat, whatsapp, voice)
- [ ] Status de conexao exibido com badge colorido
- [ ] Criar canal WhatsApp exibe wizard de setup
- [ ] QR Code renderiza e atualiza automaticamente
- [ ] Apos parear, wizard avanca para tela de "Conectado"
- [ ] Feed de mensagens exibe mensagens em tempo real via SSE
- [ ] Feed mostra direcao (inbound/outbound) com icone
- [ ] Auto-scroll funciona no feed
- [ ] Desconectar/reconectar WhatsApp funciona
- [ ] Excluir canal pede confirmacao
- [ ] Tab ativa persiste na URL
- [ ] Layout responsivo
- [ ] `npm run build:hub` compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-020 Lista canais | S-005 sec 3.1 | D-003, D-005 |
| F-021 Detalhe canal | S-005 sec 3.2 | D-003, G-005 |
| F-022 WhatsApp setup | S-005 sec 3.3 | D-003 (integracao sem complexidade), G-005 (WhatsApp nativo) |
| F-023 Message feed | S-005 sec 3.4 | G-001, D-001 |
