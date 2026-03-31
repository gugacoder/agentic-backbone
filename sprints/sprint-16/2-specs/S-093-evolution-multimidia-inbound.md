# S-093 — Evolution: Processar Mídia Inbound (Imagem, Documento, Áudio)

Expandir o webhook do Evolution para processar `imageMessage`, `documentMessage` e melhorar o handling de `audioMessage` com suporte a áudio nativo.

**Resolve:** D-008 (Evolution multimídia inbound), D-011 (caption WhatsApp), D-012 (áudio nativo vs Whisper)
**Score de prioridade:** 7
**Dependencia:** S-090 — `InboundMessage.content` deve aceitar `ContentPart[]`
**PRP:** 21 — File Upload: Envio de Arquivos para o Modelo

---

## 1. Objetivo

Hoje o webhook Evolution só processa `audioMessage`/`pttMessage` (via Whisper) e texto. Imagens e documentos recebidos via WhatsApp são silenciosamente descartados. Esta spec expande o webhook para processar toda mídia suportada, salvá-la em `attachments/`, e entregá-la ao modelo como content parts.

---

## 2. Alterações

### 2.1 Arquivo: `apps/backbone/src/connectors/evolution/routes.ts` (MODIFICAR)

#### Tipos de mensagem a processar

| Tipo Evolution | Ação |
|---|---|
| `imageMessage` | Baixar via `getBase64FromMediaMessage`, montar `ImagePart` |
| `documentMessage` | Baixar, classificar por MIME, montar `FilePart` ou pré-processar (DOCX/XLSX) |
| `audioMessage` / `pttMessage` | Manter Whisper como default; opcionalmente enviar como `FilePart` nativo |
| `videoMessage` | Ignorar (modelos não suportam vídeo) |
| `stickerMessage` | Ignorar |

#### Pipeline para `imageMessage`

```typescript
if (payload.imageMessage) {
  // 1. Baixar base64 da Evolution API
  const mediaResp = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ message: { key: payload.key } }),
  });
  const { base64 } = await mediaResp.json();

  // 2. Extrair MIME type e extensão
  const mimeType = payload.imageMessage.mimetype ?? "image/jpeg";
  const ext = mimeType.split("/")[1] ?? "jpg";

  // 3. Salvar em attachments/
  const filename = generateAttachmentId(`image.${ext}`);
  const attachmentsDir = path.join(sessionDir, "attachments");
  await mkdir(attachmentsDir, { recursive: true });
  await writeFile(path.join(attachmentsDir, filename), Buffer.from(base64, "base64"));

  // 4. Montar content array
  const parts: ContentPart[] = [];

  // Caption como TextPart (se presente)
  const caption = payload.imageMessage.caption;
  if (caption?.trim()) {
    parts.push({ type: "text", text: caption });
  }

  // ImagePart
  parts.push({ type: "image", image: base64, mimeType, _ref: filename });

  // 5. Routear com content array
  content = parts;
}
```

#### Pipeline para `documentMessage`

```typescript
if (payload.documentMessage) {
  const mediaResp = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ message: { key: payload.key } }),
  });
  const { base64 } = await mediaResp.json();

  const mimeType = payload.documentMessage.mimetype ?? "application/octet-stream";
  const originalName = payload.documentMessage.fileName ?? "document";
  const ext = path.extname(originalName) || ".bin";

  // Salvar
  const filename = generateAttachmentId(`${path.basename(originalName, ext)}${ext}`);
  const attachmentsDir = path.join(sessionDir, "attachments");
  await mkdir(attachmentsDir, { recursive: true });
  const filepath = path.join(attachmentsDir, filename);
  await writeFile(filepath, Buffer.from(base64, "base64"));

  // Classificar via classifyAttachment (S-088)
  const { part } = await classifyAttachment({ filename, filepath, mimeType, size: Buffer.from(base64, "base64").length });

  const parts: ContentPart[] = [];
  const caption = payload.documentMessage.caption;
  if (caption?.trim()) {
    parts.push({ type: "text", text: caption });
  }
  parts.push(part);

  content = parts;
}
```

#### Pipeline para `audioMessage` / `pttMessage` — melhorado

Manter o caminho Whisper atual como default. Adicionar caminho nativo como opção:

```typescript
if (payload.audioMessage || payload.pttMessage) {
  const audioMsg = payload.audioMessage ?? payload.pttMessage;
  const mediaResp = await fetch(/* ... getBase64FromMediaMessage ... */);
  const { base64 } = await mediaResp.json();

  const mimeType = audioMsg.mimetype ?? "audio/ogg";
  const ext = mimeType.split("/")[1] ?? "ogg";
  const filename = generateAttachmentId(`audio.${ext}`);
  const attachmentsDir = path.join(sessionDir, "attachments");
  await mkdir(attachmentsDir, { recursive: true });
  await writeFile(path.join(attachmentsDir, filename), Buffer.from(base64, "base64"));

  // Default: Whisper transcrição (comportamento existente)
  // O caminho Whisper já funciona — manter como está
  // Adicionalmente, salvar o arquivo em attachments/ para referência futura

  // O conteúdo continua sendo a transcrição Whisper como string
  // (manter retrocompatível com o fluxo atual)
}
```

**Nota sobre áudio nativo:** A decisão de enviar `FilePart` nativo vs. Whisper pode ser baseada nas capabilities do modelo configurado. Isso é uma extensão futura — por ora, manter Whisper como caminho único e apenas salvar o arquivo para referência.

#### Tipos ignorados

```typescript
if (payload.videoMessage || payload.stickerMessage) {
  // Ignorar silenciosamente — modelos não suportam vídeo
  // Não logar warning para cada sticker (ruído)
  return;
}
```

### 2.2 Integração com `routeInboundMessage`

Após montar o content (string ou ContentPart[]), chamar:

```typescript
await routeInboundMessage({
  senderId: remoteJid,
  content: content,  // string | ContentPart[]
  ts: Date.now(),
  metadata: { /* ... */ },
});
```

A expansão de `InboundMessage.content` (S-090) permite isso diretamente.

### 2.3 Reusar utilitários

- `generateAttachmentId()` — importar de `conversations/attachments.ts` (S-088)
- `classifyAttachment()` — importar de `conversations/attachments.ts` (S-088) para documentos

---

## 3. Regras de Implementação

- **Download via `getBase64FromMediaMessage`** — mesmo endpoint já usado para áudio. Reusar o pattern existente
- **Caption sempre antes do part de mídia** — quando presente, `TextPart` com caption vem primeiro no array
- **Salvar em `attachments/` da sessão** — mesmo storage usado por upload web
- **Reusar `classifyAttachment()`** para documentos — evitar duplicar lógica de DOCX/XLSX
- **Não quebrar o fluxo de áudio/Whisper** — o áudio continua passando pelo Whisper como antes; a novidade é apenas salvar em `attachments/`
- **Ignorar video e sticker** — sem suporte de modelo para vídeo via OpenRouter
- **Graceful degradation** — se download de mídia falhar, logar erro e continuar com texto apenas (se houver)

---

## 4. Critérios de Aceite

- [ ] `imageMessage` recebida via webhook → imagem baixada, salva em `attachments/`, enviada como `ImagePart` ao modelo
- [ ] `documentMessage` recebida → documento baixado, classificado (PDF→FilePart, DOCX→TextPart, etc.), enviado ao modelo
- [ ] Caption de `imageMessage`/`documentMessage` → incluído como `TextPart` antes do part de mídia
- [ ] `audioMessage`/`pttMessage` → mantém Whisper como transcrição + salva arquivo em `attachments/`
- [ ] `videoMessage` e `stickerMessage` → ignorados silenciosamente
- [ ] `routeInboundMessage` recebe `content: ContentPart[]` para mensagens com mídia
- [ ] Falha no download de mídia → erro logado, mensagem descartada gracefully
- [ ] TypeScript compila sem erros
