# Guia de Upload de Arquivos

> **Fonte da verdade para o pipeline de upload do Agentic Backbone.**
> Cobre media types suportados, limites, pipeline de processamento, persistência com `_ref`, API das rotas e comportamento no replay/compaction.

---

## Visão Geral

O upload de arquivos permite que o usuário envie imagens, áudios, documentos e texto como **content parts** junto à mensagem. Em vez de tratar arquivos separadamente, eles são convertidos em partes do conteúdo da mensagem (`ContentPart[]`) e entregues ao modelo via Vercel AI SDK.

Fluxo de alto nível:

```
usuário envia multipart/form-data (message + files)
  ↓
backend valida, salva em attachments/ e classifica cada arquivo
  ↓
content array montado: [TextPart?, ImagePart | FilePart | TextPart, ...]
  ↓
content array passado para sendMessage() → runAgent() → streamText()
  ↓
no JSONL, binários substituídos por _ref (sem base64 em disco)
```

Arquivos ficam em `context/agents/{agentId}/conversations/{sessionId}/attachments/` — mesma pasta da conversa. Não há storage central; o ciclo de vida é o da própria conversa.

---

## Media Types Suportados

### Categoria 1 — Inline nativo

Enviados diretamente ao modelo como `ImagePart` ou `FilePart` com binário em base64. O provider (OpenRouter/Anthropic) processa natively — sem conversão no backend.

| MIME type | Extensões | Part type |
|-----------|-----------|-----------|
| `image/png` | `.png` | `ImagePart` |
| `image/jpeg` | `.jpg`, `.jpeg` | `ImagePart` |
| `image/gif` | `.gif` | `ImagePart` |
| `image/webp` | `.webp` | `ImagePart` |
| `application/pdf` | `.pdf` | `FilePart` |
| `audio/wav` | `.wav` | `FilePart` |
| `audio/mp3` | `.mp3` | `FilePart` |
| `audio/mpeg` | `.mp3`, `.mpeg` | `FilePart` |
| `audio/ogg` | `.ogg` | `FilePart` |
| `audio/webm` | `.webm` | `FilePart` |

### Categoria 2 — Inline texto

Conteúdo lido como string e enviado como `TextPart`. Sem conversão — o texto é passado diretamente ao modelo com prefixo `[📎 filename]`.

| MIME type | Extensões |
|-----------|-----------|
| `text/plain` | `.txt` |
| `text/csv` | `.csv` |
| `application/json` | `.json` |

### Categoria 3 — Pré-processado

Convertidos para texto no backend antes de enviar ao modelo. Resultado enviado como `TextPart` com prefixo `[📎 filename]`.

| MIME type | Extensão | Biblioteca | Saída |
|-----------|----------|------------|-------|
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` | `mammoth` | Markdown |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `.xlsx` | `xlsx` (SheetJS) | CSV (uma sheet por bloco) |

MIME types não listados acima são rejeitados com `415 Unsupported Media Type`, incluindo a lista de tipos aceitos no corpo da resposta.

---

## Limites

Validados no backend — não confiar no frontend. Retorna `413 Payload Too Large` com mensagem descrevendo o limite violado.

| Tipo | Tamanho máximo | Justificativa |
|------|---------------|---------------|
| Imagem (`image/*`) | **20 MB** | Limite prático do OpenRouter/Anthropic |
| Áudio (`audio/*`) | **25 MB** | ~10 min de áudio WAV comprimido |
| PDF (`application/pdf`) | **30 MB** | PDFs grandes com imagens embutidas |
| DOCX | **15 MB** | Documentos longos com formatação |
| XLSX | **10 MB** | Planilhas grandes viram CSV extenso |
| Texto (plain/csv/json) | **5 MB** | Texto puro — limite de tokens do modelo |
| **Total por mensagem** | **50 MB** | Soma de todos os arquivos na mensagem |
| **Arquivos por mensagem** | **10** | Evitar abuso sem restringir uso normal |

Regras de validação aplicadas nesta ordem:
1. Contar arquivos → `413` se > 10
2. Verificar MIME de cada arquivo → `415` se não suportado
3. Verificar tamanho individual de cada arquivo → `413` se excede limite do tipo
4. Verificar soma total → `413` se > 50 MB
5. Verificar que `message` ou `files` esteja presente → `400` se nenhum

---

## Pipeline de Upload

```
POST /conversations/:sessionId/messages (multipart/form-data)
  │
  ├─ Content-Type: application/json ──→ comportamento retrocompatível (string)
  │
  └─ Content-Type: multipart/form-data
       │
       ▼
  parseBody({ all: true })           ← parser nativo Hono
       │
       ▼
  validar: max arquivos (413)
  validar: MIME type permitido? (415)
  validar: tamanho individual (413)
  validar: total geral (413)
  validar: ao menos message ou files presente (400)
       │
       ▼
  salvar cada arquivo:
    - gerar ID: att_{timestamp}_{random6hex}.{ext}
    - mkdir {sessionDir}/attachments/ (recursive)
    - writeFile(Buffer.from(await file.arrayBuffer()))
       │
       ▼
  classificar cada arquivo (classifyAttachment):
    - image/* ──────────────────→ ImagePart { type, image: base64, mimeType }
    - application/pdf ──────────→ FilePart  { type, data: base64, mimeType }
    - audio/* ──────────────────→ FilePart  { type, data: base64, mimeType }
    - text/plain|csv|json ──────→ TextPart  { type, text: conteúdo }
    - .docx (mammoth) ──────────→ TextPart  { type, text: markdown }
    - .xlsx (SheetJS) ──────────→ TextPart  { type, text: csv por sheet }
       │
       ▼
  buildContentArray(message, classifiedParts):
    - TextPart do texto do usuário (se presente) ← sempre primeiro
    - parts dos arquivos na sequência
       │
       ▼
  persistir no messages.jsonl:
    - substituir data/image por _ref (sem base64 em disco)
    - { type: "file", _ref: "att_xxx.pdf", mimeType: "application/pdf" }
       │
       ▼
  sendMessage(userId, sessionId, content: ContentPart[])
       │
       ▼
  runAgent(content) → streamText(content) → SSE ao cliente
```

---

## Formato `_ref` no JSONL

Persistir base64 no `messages.jsonl` inflaria o arquivo. Ao salvar, binários são substituídos por referência `_ref` apontando para o arquivo em `attachments/`.

### Exemplo — em runtime (enviado ao modelo)

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "analise esse documento" },
    {
      "type": "file",
      "data": "JVBERi0xLjQgJeLjz9MNCjEgMCBvYmoKPDwK...",
      "mimeType": "application/pdf"
    }
  ]
}
```

### Exemplo — persistido no JSONL

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "analise esse documento" },
    {
      "type": "file",
      "_ref": "att_1711792800123_b4e3d2.pdf",
      "mimeType": "application/pdf"
    }
  ],
  "_meta": { "id": "msg_abc123", "ts": "2024-03-30T10:00:00Z", "userId": "guga" }
}
```

### Regras de substituição

| Part type | Campo original | Substituído por |
|-----------|---------------|-----------------|
| `ImagePart` | `image` (base64 string) | `_ref` (filename) |
| `FilePart` | `data` (base64 string) | `_ref` (filename) |
| `TextPart` | — (sem binário) | sem alteração |

### Resolução na leitura (`resolveRefs`)

Em `loadSession()` do ai-sdk, ao carregar mensagens com `_ref`:

1. Carregar arquivo de `attachments/` e converter para base64
2. Restaurar campo original (`image` para `ImagePart`, `data` para `FilePart`)
3. Se arquivo ausente → substituir por `TextPart` com placeholder: `[arquivo removido: att_xxx.pdf]`

JSONL sem `_ref` (mensagens antigas) é lido normalmente — retrocompatível.

---

## API da Rota Multipart

### `POST /conversations/:sessionId/messages`

Aceita dois content types:

**`application/json`** — comportamento atual, retrocompatível:

```json
{ "message": "texto da mensagem" }
```

**`multipart/form-data`** — novo, com arquivos:

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `message` | `string` | Não (pode enviar só arquivos) |
| `files` | `File[]` | Não (pode enviar só texto) |

Ao menos um dos dois deve estar presente. Retorna `400` se ambos ausentes.

**Códigos de resposta:**

| Código | Situação |
|--------|----------|
| `200` | Mensagem processada com sucesso (streaming SSE) |
| `400` | Nem `message` nem `files` presentes |
| `413` | Arquivo ou total acima do limite |
| `415` | MIME type não suportado |
| `404` | Sessão não encontrada |
| `401` | Token JWT ausente ou inválido |

**Exemplo curl:**

```bash
curl -X POST http://localhost:6002/api/v1/ai/conversations/{sessionId}/messages \
  -H "Authorization: Bearer <token>" \
  -F "message=analise essa imagem" \
  -F "files=@foto.png;type=image/png"
```

---

## Rota de Servir Arquivos

### `GET /conversations/:sessionId/attachments/:filename`

Serve o arquivo de attachment com autenticação JWT obrigatória.

**Parâmetros:**

| Parâmetro | Descrição |
|-----------|-----------|
| `sessionId` | ID da sessão dona do attachment |
| `filename` | Nome do arquivo (formato `att_{ts}_{hex}.{ext}`) |

**Segurança:** `filename` é sanitizado — path traversal (`..`, `/`, `\`) retorna `400`.

**Headers de resposta:**

| Header | Valor |
|--------|-------|
| `Content-Type` | MIME type derivado da extensão |
| `Content-Length` | Tamanho do arquivo em bytes |
| `Cache-Control` | `private, max-age=3600` |

**Mapa de extensões para Content-Type:**

| Extensão | Content-Type |
|----------|--------------|
| `.png` | `image/png` |
| `.jpg`, `.jpeg` | `image/jpeg` |
| `.gif` | `image/gif` |
| `.webp` | `image/webp` |
| `.pdf` | `application/pdf` |
| `.wav` | `audio/wav` |
| `.mp3` | `audio/mpeg` |
| `.ogg` | `audio/ogg` |
| `.webm` | `audio/webm` |
| `.txt` | `text/plain` |
| `.csv` | `text/csv` |
| `.json` | `application/json` |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| outros | `application/octet-stream` |

**Códigos de resposta:**

| Código | Situação |
|--------|----------|
| `200` | Arquivo encontrado e retornado |
| `400` | Path traversal detectado no filename |
| `401` | Token JWT ausente ou inválido |
| `404` | Sessão ou arquivo não encontrado |

**Exemplo curl:**

```bash
curl http://localhost:6002/api/v1/ai/conversations/{sessionId}/attachments/att_1711792800000_a3f2c1.png \
  -H "Authorization: Bearer <token>" \
  --output foto.png
```

**Uso no frontend:** Para imagens e áudio inline, adicionar `?token=<jwt>` à URL (EventSource/img não suportam Authorization header):

```html
<img src="/api/v1/ai/conversations/{sessionId}/attachments/{filename}?token={jwt}" />
<audio src="/api/v1/ai/conversations/{sessionId}/attachments/{filename}?token={jwt}" controls />
```

---

## Replay e Compaction

### Filtro de mídia antiga no replay

Ao carregar `previousMessages` para enviar ao `streamText`, mensagens com content arrays passam por `filterOldMedia()`:

| Mensagem | Regra |
|----------|-------|
| **Última mensagem do usuário** | Todos os parts mantidos intactos (incluindo binários) |
| **Mensagens anteriores do usuário** | `ImagePart` → `TextPart` placeholder; `FilePart` binário → `TextPart` placeholder; `TextPart` sempre mantido |
| **Mensagens do assistant** | Não alteradas |

Exemplos de placeholder:
- `[imagem enviada: att_xxx.png]`
- `[arquivo enviado: att_xxx.pdf]`
- `[áudio enviado: att_xxx.wav]`

**Motivação:** Reenviar binários de mensagens antigas desperdiça tokens sem valor contextual. O modelo já processou e respondeu sobre aquela mídia — o placeholder mantém a rastreabilidade sem custo.

### Estimativa de tokens para mídia em compaction

`countMessageTokens()` em `compaction.ts` usa estimativas por tipo de part:

| Part type | Estimativa | Base |
|-----------|-----------|------|
| `TextPart` | `countTokens(text)` | Exato (tiktoken) |
| `ImagePart` | **~300 tokens** | Média de imagens redimensionadas pelo provider |
| `FilePart` PDF | **~1500 tokens** | Estimativa conservadora (~500 tokens/página × 3 páginas) |
| `FilePart` áudio (`audio/*`) | **~200 tokens** | Estimativa por transcrição implícita |
| Part desconhecido | **~500 tokens** | Fallback conservador |

As estimativas são intencionalmente conservadoras — o objetivo é que compaction dispare no momento certo, não precisão de tokens.

**Content string** continua sendo contada como antes (retrocompatível).
