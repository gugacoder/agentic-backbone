# PRP-21E — Evolution: Processar Mídia Inbound

Expandir o webhook do Evolution para processar `imageMessage`, `documentMessage` e melhorar o handling de `audioMessage` com save em attachments.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O webhook Evolution em `apps/backbone/src/connectors/evolution/routes.ts` processa apenas `audioMessage`/`pttMessage` (via Whisper) e texto. Mensagens com imagem, documento, vídeo e sticker são silenciosamente descartadas.

### Estado desejado

- `imageMessage` recebida → imagem baixada, salva em `attachments/`, enviada como `ImagePart` ao modelo
- `documentMessage` recebida → documento baixado, classificado (PDF→FilePart, DOCX→TextPart, etc.), enviado ao modelo
- Caption de mídia → incluído como `TextPart` antes do part de mídia
- `audioMessage`/`pttMessage` → mantém Whisper + salva arquivo em `attachments/` para referência
- `videoMessage` e `stickerMessage` → ignorados silenciosamente

### Dependencias

- **PRP-21C** — `InboundMessage.content` deve aceitar `ContentPart[]` e `routeInboundMessage()` deve propagar content array

## Especificacao

### Feature F-336: Processar imageMessage inbound

**Spec:** S-093 seção 2.1 (imageMessage)

Modificar `apps/backbone/src/connectors/evolution/routes.ts`:

Pipeline para `imageMessage`:

1. Baixar base64 via `getBase64FromMediaMessage` (mesmo endpoint já usado para áudio)
2. Extrair MIME type de `payload.imageMessage.mimetype` (fallback `image/jpeg`)
3. Gerar ID via `generateAttachmentId()` (importar de `conversations/attachments.ts`)
4. Criar `{sessionDir}/attachments/` com `mkdir({ recursive: true })`
5. Salvar buffer decodificado no arquivo
6. Montar content array:
   - Se caption presente (`payload.imageMessage.caption`), adicionar `TextPart` com caption
   - Adicionar `ImagePart` com base64, mimeType e `_ref: filename`
7. Chamar `routeInboundMessage()` com `content: ContentPart[]`

### Feature F-337: Processar documentMessage inbound

**Spec:** S-093 seção 2.1 (documentMessage)

Pipeline para `documentMessage`:

1. Baixar base64 via `getBase64FromMediaMessage`
2. Extrair MIME type de `payload.documentMessage.mimetype`
3. Extrair nome original de `payload.documentMessage.fileName`
4. Gerar ID, salvar em `attachments/`
5. Classificar via `classifyAttachment()` (importar de `conversations/attachments.ts`) — reusar mesma lógica de classificação (PDF→FilePart, DOCX→mammoth→TextPart, XLSX→SheetJS→TextPart, etc.)
6. Montar content array com caption (se houver) + part classificado
7. Chamar `routeInboundMessage()` com `content: ContentPart[]`

Para documentos com MIME type não suportado pelo classificador: logar warning e descartar (não enviar ao modelo).

### Feature F-338: Melhorar audioMessage com save em attachments

**Spec:** S-093 seção 2.1 (audioMessage)

Manter o caminho Whisper atual como default (retrocompatível). Adicionar:

1. Baixar base64 da mídia
2. Gerar ID, salvar em `{sessionDir}/attachments/` para referência futura
3. Continuar usando transcrição Whisper como conteúdo da mensagem (string)

**Nota:** Enviar `FilePart` nativo (para modelos com suporte a áudio) é extensão futura. Por ora, salvar o arquivo é suficiente para manter o histórico.

Tipos ignorados (`videoMessage`, `stickerMessage`): retornar silenciosamente sem logar warning para cada sticker (ruído).

#### Regras

- Download via `getBase64FromMediaMessage` — reusar pattern existente de áudio
- Caption sempre antes do part de mídia no content array
- Salvar em `attachments/` da sessão — mesmo storage usado por upload web
- Reusar `classifyAttachment()` para documentos — não duplicar lógica
- Não quebrar fluxo de áudio/Whisper existente
- Graceful degradation — se download de mídia falhar, logar erro e descartar mensagem

## Limites

- **NÃO** suportar `videoMessage` — modelos não processam vídeo via OpenRouter
- **NÃO** suportar `stickerMessage` — sem valor contextual para o modelo
- **NÃO** implementar áudio nativo (FilePart) nesta fase — Whisper é suficiente por ora
- **NÃO** validar tamanho de arquivos recebidos via WhatsApp — o WhatsApp já impõe limites próprios
- **NÃO** duplicar utilitários — importar `generateAttachmentId()` e `classifyAttachment()` de `conversations/attachments.ts`

## Validacao

- [ ] `imageMessage` recebida → imagem salva em `attachments/`, enviada como `ImagePart` ao modelo
- [ ] Caption de `imageMessage` → `TextPart` antes do `ImagePart`
- [ ] `documentMessage` com PDF → `FilePart` enviado ao modelo
- [ ] `documentMessage` com DOCX → texto extraído via mammoth, enviado como `TextPart`
- [ ] Caption de `documentMessage` → `TextPart` antes do part de mídia
- [ ] `audioMessage`/`pttMessage` → transcrição Whisper como antes + arquivo salvo em `attachments/`
- [ ] `videoMessage` e `stickerMessage` → ignorados silenciosamente
- [ ] Falha no download → erro logado, mensagem descartada sem crash
- [ ] `routeInboundMessage` recebe `content: ContentPart[]` para mensagens com mídia
- [ ] TypeScript compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-336 processar imageMessage inbound | S-093 | D-008, D-011 |
| F-337 processar documentMessage inbound | S-093 | D-008 |
| F-338 melhorar audioMessage com save | S-093 | D-008, D-012 |
