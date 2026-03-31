# PRP 18 — File Upload: Envio de Arquivos para o Modelo

O usuario pode anexar arquivos (imagens, audio, PDFs, documentos, texto) na conversa. Os arquivos sao enviados ao modelo como content parts (Vercel AI SDK), armazenados no filesystem da conversa, e suportados tanto no chat web quanto via WhatsApp (Evolution).

Execution Mode: `implementar`

---

## Contexto

### Estado atual

- A UI de chat (`MessageInput`) ja coleta attachments (plus menu, drag & drop, paste, gravacao de audio), mas **nao envia** — o submit ignora os arquivos
- A rota `POST /conversations/:id/messages` aceita apenas `{ message: string }`
- O `runAgent()` recebe `content: string`, nunca array de parts
- O connector Evolution **descarta** midia inbound (imagem, documento, video) — so processa audio via Whisper
- `messages.jsonl` persiste `content: string | Part[]` (PRP 17), mas nunca recebe parts de arquivo
- Compaction (`countMessageTokens`) ignora parts nao-texto na contagem de tokens

### O que muda

| Antes | Depois |
|---|---|
| Attachments coletados e descartados no submit | Attachments enviados via multipart, processados, e entregues ao modelo |
| Rota aceita `{ message: string }` | Rota aceita multipart/form-data com arquivos + texto |
| `content` sempre string | `content` pode ser `Array<TextPart \| ImagePart \| FilePart>` |
| Arquivos nao persistem | Arquivos salvos em `attachments/` dentro da conversa |
| Evolution descarta imagem/doc/video | Evolution processa midia inbound como content parts |
| Compaction ignora midia | Compaction estima tokens de midia e filtra parts binarios antigos no replay |

### Dependencias

- PRP 17 (Unified Persistence) — formato `content: Part[]` no `messages.jsonl`
- PRP 14 (Rich Content) — `display_file` e `display_image` para exibicao (direcao oposta: modelo→usuario)

---

## Especificacao

### 1. Guide de referencia

Criar `guides/file-upload/GUIDE.md` com:

- Media types suportados (referencia `ideacao/upload/MEDIATYPES.txt`)
- Pipeline de upload (diagrama do fluxo)
- Formato de referencia no JSONL
- API da rota de upload
- Limites por tipo

Arquivos de suporte conforme necessario (ex: `examples.json`).

### 2. Media types e classificacao

Tres categorias de processamento:

**Inline nativo** — enviado como `ImagePart` ou `FilePart` com binario base64:

| MIME type | Part type |
|---|---|
| `image/png`, `image/jpeg`, `image/gif`, `image/webp` | `ImagePart` |
| `application/pdf` | `FilePart` |
| `audio/wav`, `audio/mp3`, `audio/mpeg`, `audio/ogg`, `audio/webm` | `FilePart` |

**Inline texto** — conteudo lido e enviado como `TextPart`:

| MIME type | Tratamento |
|---|---|
| `text/plain` | Conteudo direto |
| `text/csv` | Conteudo direto |
| `application/json` | Conteudo direto |

**Pre-processado** — convertido para texto e enviado como `TextPart`:

| MIME type | Lib | Saida |
|---|---|---|
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx) | `mammoth` | Markdown |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx) | `xlsx` (SheetJS) | CSV (uma sheet por bloco) |

### 3. Limites

Objetivo: ser generoso. Travar o minimo possivel.

| Tipo | Tamanho maximo | Justificativa |
|---|---|---|
| Imagem | 20 MB | Limite pratico do OpenRouter/Anthropic |
| Audio | 25 MB | ~10 min de audio WAV comprimido |
| PDF | 30 MB | PDFs grandes com imagens embutidas |
| DOCX | 15 MB | Documentos longos com formatacao |
| XLSX | 10 MB | Planilhas grandes viram CSV extenso |
| Texto (plain/csv/json) | 5 MB | Texto puro, limite de tokens do modelo |
| **Total por mensagem** | **50 MB** | Soma de todos os arquivos na mensagem |
| **Arquivos por mensagem** | **10** | Evitar abuso sem restringir uso normal |

Validacao no backend (nao confiar no frontend). Retornar `413 Payload Too Large` com mensagem clara indicando o limite violado.

### 4. Rota de upload

#### 4.1 Endpoint: `POST /conversations/:sessionId/messages`

Refatorar para aceitar **dois content types**:

- `application/json` — comportamento atual (retrocompativel)
- `multipart/form-data` — novo, com arquivos

Campos multipart:

| Campo | Tipo | Obrigatorio |
|---|---|---|
| `message` | string | Nao (pode enviar so arquivos) |
| `files` | File[] | Nao (pode enviar so texto) |

Ao menos um dos dois deve estar presente.

#### 4.2 Pipeline de processamento

```
multipart/form-data
  ↓
  validar: mime type permitido? tamanho dentro do limite?
  ↓
  salvar arquivos em {sessionDir}/attachments/{id}.{ext}
  ↓
  classificar cada arquivo:
    - imagem → ImagePart { type: "image", image: base64, mimeType }
    - pdf/audio → FilePart { type: "file", data: base64, mimeType }
    - texto puro → TextPart { type: "text", text: conteudo }
    - docx → converter com mammoth → TextPart
    - xlsx → converter com SheetJS → TextPart
  ↓
  montar content: Array<Part>
    - se tem texto do usuario, adicionar TextPart no inicio
    - adicionar parts dos arquivos na sequencia
  ↓
  persistir no messages.jsonl com referencia (nao base64)
  ↓
  passar content array para sendMessage → runAgent → streamText
```

#### 4.3 Geracao de ID

Formato: `att_{timestamp}_{random6hex}` (ex: `att_1711792800000_a3f2c1`).

Extensao preservada do arquivo original para facilitar debug e servir com content-type correto.

### 5. Storage

#### 5.1 Estrutura

```
agents/{agentId}/conversations/{sessionId}/
  ├── SESSION.yml
  ├── messages.jsonl
  └── attachments/
      ├── att_1711792800000_a3f2c1.png
      ├── att_1711792800123_b4e3d2.pdf
      └── att_1711792800456_c5f4e3.wav
```

#### 5.2 Lifecycle

- Criado no upload
- Deletado junto com a conversa (ja coberto pela delecao de pasta)
- Sem TTL separado, sem GC, sem orphan detection

#### 5.3 Servir arquivos

Nova rota: `GET /conversations/:sessionId/attachments/:filename`

- Autenticacao obrigatoria (mesmo JWT)
- Retorna o arquivo com `Content-Type` correto
- Necessario para o frontend exibir thumbnails e reproduzir audio

### 6. Persistencia no messages.jsonl

O content array enviado ao modelo contem base64 (necessario para o `streamText`). Mas persistir base64 no JSONL inflaria o arquivo.

#### 6.1 Formato de persistencia

Ao salvar no JSONL, substituir o binario por referencia:

```typescript
// Enviado ao modelo (runtime):
{
  role: "user",
  content: [
    { type: "text", text: "analise esse documento" },
    { type: "file", data: "JVBERi0x...(base64)...", mimeType: "application/pdf" }
  ]
}

// Persistido no JSONL:
{
  role: "user",
  content: [
    { type: "text", text: "analise esse documento" },
    { type: "file", _ref: "att_1711792800123_b4e3d2.pdf", mimeType: "application/pdf" }
  ],
  _meta: { id: "msg_...", ts: "...", userId: "..." }
}
```

Campo `_ref` substitui `data`/`image`. Na leitura, resolver a referencia carregando o arquivo do disco.

#### 6.2 Resolucao de referencia

Em `loadSession()` (ai-sdk), ao carregar mensagens com `_ref`:

- Carregar o arquivo do disco e converter para base64
- Substituir `_ref` por `data` (ou `image` para `ImagePart`)
- Se o arquivo nao existir, substituir por `TextPart` com placeholder: `[arquivo removido: nome.pdf]`

### 7. Replay e compaction

#### 7.1 Filtro de midia antiga no replay

Ao carregar `previousMessages` para enviar ao `streamText`, aplicar filtro:

- **Ultima mensagem do usuario**: manter todos os parts (incluindo midia)
- **Mensagens anteriores**: substituir `ImagePart` e `FilePart` binarios por `TextPart` com placeholder (ex: `[imagem enviada: foto.png]`, `[audio enviado: gravacao.wav]`)
- **TextPart**: sempre manter

Isso evita reenviar binarios antigos que desperdicam tokens sem valor contextual.

#### 7.2 Contagem de tokens para midia

Atualizar `countMessageTokens()` em `compaction.ts`:

```typescript
// Estimativas por tipo:
// ImagePart: ~300 tokens (media de imagens redimensionadas pelo provider)
// FilePart PDF: ~500 tokens por pagina (estimativa conservadora)
// FilePart audio: ~100 tokens por minuto
// Fallback: 500 tokens para qualquer part desconhecido
```

Nao precisa ser exato — o objetivo e que compaction dispare no momento certo.

### 8. Backbone: refatorar content para array

#### 8.1 Arquivo: `apps/backbone/src/conversations/index.ts`

A funcao `sendMessage()` hoje recebe `message: string`. Refatorar para aceitar `content: string | ContentPart[]`:

```typescript
export async function* sendMessage(
  userId: string,
  sessionId: string,
  content: string | ContentPart[],
  // ...
): AsyncGenerator<AgentEvent> {
  // Se string, manter comportamento atual
  // Se array, passar como content array para runAgent
}
```

#### 8.2 Arquivo: `apps/backbone/src/conversations/persistence.ts`

`appendModelMessage()` hoje aceita `content: string`. Expandir para `content: string | ContentPart[]` e aplicar a substituicao `data` → `_ref` antes de serializar.

#### 8.3 Arquivo: `apps/backbone/src/channels/delivery/types.ts`

`InboundMessage.content` hoje e `string`. Expandir para `string | ContentPart[]` para suportar midia vinda de canais (Evolution).

### 9. Evolution: processar midia inbound

#### 9.1 Arquivo: `apps/backbone/src/connectors/evolution/routes.ts`

Hoje o webhook extrai apenas `audioMessage` e texto. Expandir para processar:

| Tipo Evolution | Acao |
|---|---|
| `imageMessage` | Baixar via `getBase64FromMediaMessage`, montar `ImagePart` |
| `documentMessage` | Baixar, classificar por mime type, montar `FilePart` ou pre-processar |
| `videoMessage` | Ignorar (modelos nao suportam video de forma confiavel) |
| `stickerMessage` | Ignorar |
| `audioMessage` / `pttMessage` | Manter Whisper como fallback, mas tambem enviar como `FilePart` se modelo suportar audio nativo |

#### 9.2 Pipeline

```
webhook recebe mensagem com midia
  ↓
  baixar base64 via Evolution API (getBase64FromMediaMessage)
  ↓
  salvar em {sessionDir}/attachments/
  ↓
  montar content array com TextPart (caption, se houver) + ImagePart/FilePart
  ↓
  routeInboundMessage com content array (em vez de string)
```

#### 9.3 Caption

Mensagens de midia no WhatsApp podem ter caption. Se presente, incluir como `TextPart` antes do part de midia.

### 10. Frontend: wiring e rendering

#### 10.1 Envio de attachments

Arquivo: `apps/packages/ai-chat/src/components/Chat.tsx`

Hoje `handleSubmit` ignora attachments. Refatorar para:

1. Construir `FormData` com `message` + `files`
2. Enviar via `fetch` para a rota multipart (em vez de `useChat.handleSubmit`)
3. Manter streaming SSE do response (datastream protocol)

#### 10.2 Rendering de attachments em mensagens

Arquivo: `apps/packages/ai-chat/src/components/MessageBubble.tsx`

Hoje so renderiza `text`, `reasoning`, `tool-invocation`. Adicionar rendering para:

- **Imagens**: thumbnail clicavel (abre em tamanho real)
- **Audio**: player inline com controles de play/pause
- **PDF**: chip com icone + nome, clicavel para abrir/download
- **Texto pre-processado**: bloco colapsavel com preview das primeiras linhas

As URLs dos assets apontam para `GET /conversations/:sessionId/attachments/:filename`.

#### 10.3 Progress de upload

Mostrar indicador de progresso no `AttachmentPreview` durante o upload (antes do streaming da resposta comecar).

---

## Limites

### NAO fazer

- Nao criar storage central (`data/uploads/`) — arquivos vivem na pasta da conversa
- Nao criar tabela SQL para attachments — referencia direto no JSONL via `_ref`
- Nao suportar video (modelos nao processam video de forma confiavel via OpenRouter)
- Nao comprimir/redimensionar imagens no backend — enviar como recebido; o provider (OpenRouter/Anthropic) ja faz resize
- Nao implementar virus scanning ou content moderation de arquivos
- Nao implementar `display_file`/`display_image` para upload — esses display tools (PRP 14) sao para a direcao oposta (modelo→usuario)

### Observacoes

- `mammoth` e `xlsx` sao dependencias novas no workspace `apps/backbone`
- A rota multipart usa o parser nativo do Hono (`c.req.parseBody()`)
- Audio inbound do WhatsApp: manter Whisper como opcao para modelos que nao suportam audio nativo. Decisao de qual path usar pode ser baseada nas capabilities do modelo configurado
- O campo `_ref` e convencao interna do JSONL — nunca exposto na API publica
- Retrocompatibilidade: `POST /conversations/:id/messages` com `Content-Type: application/json` continua funcionando identicamente

---

## Ordem de Execucao

| Fase | O que | Depende de |
|---|---|---|
| 1 | Guide (`guides/file-upload/GUIDE.md`) | — |
| 2 | Dependencias (`mammoth`, `xlsx`) + rota multipart + storage em `attachments/` | — |
| 3 | Classificacao de arquivos + conversao DOCX/XLSX + montagem de content parts | Fase 2 |
| 4 | Persistencia com `_ref` + resolucao na leitura | Fase 3 |
| 5 | Refatorar `sendMessage` e `InboundMessage` para `content: string \| ContentPart[]` | Fase 3 |
| 6 | Replay com filtro de midia antiga + compaction com estimativa de tokens | Fase 4, 5 |
| 7 | Evolution: processar midia inbound | Fase 5 |
| 8 | Frontend: wiring do submit + rendering de attachments + progress | Fase 4, 5 |

Fases 1-2 podem rodar em paralelo. Fases 7 e 8 podem rodar em paralelo entre si.

---

## Validacao

- [ ] Upload de imagem via chat web → modelo descreve a imagem na resposta
- [ ] Upload de PDF → modelo responde sobre o conteudo do documento
- [ ] Upload de audio → modelo transcreve/responde sobre o audio
- [ ] Upload de DOCX → texto extraido e enviado ao modelo
- [ ] Upload de XLSX → dados convertidos para CSV e enviados ao modelo
- [ ] Upload de texto plano/CSV/JSON → conteudo enviado direto
- [ ] Multiplos arquivos na mesma mensagem
- [ ] Arquivo acima do limite → erro 413 com mensagem clara
- [ ] MIME type nao suportado → erro 415 com lista de tipos aceitos
- [ ] Retomar sessao com historico de attachments → midia antiga filtrada, texto mantido
- [ ] Compaction dispara corretamente com mensagens contendo midia
- [ ] WhatsApp: imagem recebida → modelo ve a imagem
- [ ] WhatsApp: documento recebido → modelo processa o documento
- [ ] WhatsApp: audio recebido → modelo processa (nativo ou Whisper)
- [ ] JSONL nao contem base64 — apenas `_ref`
- [ ] `GET /attachments/:filename` serve o arquivo com auth
