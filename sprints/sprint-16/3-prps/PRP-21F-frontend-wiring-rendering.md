# PRP-21F — Frontend: Wiring do Submit + Rendering de Attachments

Refatorar `handleSubmit` para enviar FormData multipart, renderizar attachments no histórico de mensagens, e mostrar indicador de progresso durante upload.

## Execution Mode

`implementar`

## Contexto

### Estado atual

A UI de chat (`MessageInput`) coleta attachments (plus menu, drag & drop, paste, gravação de áudio), mas `handleSubmit` ignora os arquivos — o submit envia apenas `{ message: string }` via JSON. `MessageBubble` renderiza apenas `text`, `reasoning` e `tool-invocation`. Não há rendering para content parts de mídia (imagens, áudio, PDF, texto pré-processado).

### Estado desejado

- `handleSubmit` com attachments → envia `FormData` multipart para a rota de upload
- `handleSubmit` sem attachments → fluxo JSON original (retrocompatível)
- Erros de upload (413, 415) exibidos ao usuário
- Imagens no histórico → thumbnail clicável (lightbox)
- Áudio no histórico → player inline com play/pause
- PDF no histórico → chip com ícone e nome, clicável para download
- Texto pré-processado (DOCX/XLSX) → bloco colapsável com preview
- Indicador de progresso visível durante upload

### Dependencias

- **PRP-21B** — persistência `_ref` (para construir URLs de assets)
- **PRP-21C** — rota GET attachments (para servir arquivos ao frontend)

## Especificacao

### Feature F-339: Submit multipart com FormData

**Spec:** S-094 seção 2.1

Modificar `apps/packages/ai-chat/src/components/Chat.tsx`:

Refatorar `handleSubmit`:

1. **Se há attachments:**
   - Construir `FormData` com campo `message` (se texto presente) e campos `files` (um por arquivo)
   - Enviar via `fetch` com `Authorization: Bearer <token>` (sem Content-Type — browser define multipart boundary)
   - Tratar erros: 413 (limite excedido), 415 (MIME não suportado) → mostrar mensagem do backend ao usuário
   - Processar streaming SSE do response (reusar lógica existente de consumo de datastream)
   - Limpar input e attachments após envio bem-sucedido

2. **Se não há attachments:**
   - Usar fluxo JSON original via `useChat.handleSubmit` (retrocompatível)

Novo estado `isUploading: boolean` para controlar indicador de progresso.

#### Regras

- Não quebrar fluxo sem attachments — sem arquivos, usar `handleSubmit` original
- Erros de upload exibidos de forma amigável ao usuário
- Streaming SSE funciona após upload multipart
- Interface em pt-BR

### Feature F-340: Rendering de attachments em MessageBubble

**Spec:** S-094 seção 2.2

Modificar `apps/packages/ai-chat/src/components/MessageBubble.tsx`:

Adicionar rendering para content parts de upload no `PartRenderer`:

**Imagens (`ImagePart`):**
- Thumbnail com `max-w-xs`, `rounded-lg`, `border`
- Clicável → abre lightbox (imagem em tamanho real)
- URL: `{endpoint}/conversations/{sessionId}/attachments/{_ref}?token={jwt}`
- `loading="lazy"` para não carregar todas as imagens do histórico

**Áudio (`FilePart` com mimeType `audio/*`):**
- Player inline com `<audio controls>`
- URL: `{endpoint}/conversations/{sessionId}/attachments/{_ref}?token={jwt}`

**PDF (`FilePart` com mimeType `application/pdf`):**
- Chip com ícone de arquivo + nome do arquivo
- Clicável → abre em nova aba ou download
- URL: `{endpoint}/conversations/{sessionId}/attachments/{_ref}?token={jwt}`

**Texto pré-processado (TextPart com prefixo `[📎`):**
- Bloco colapsável (shadcn `Collapsible`)
- Header com ícone de clip + nome do arquivo
- Preview das primeiras linhas visível; conteúdo completo ao expandir
- `<pre>` com `max-h-40 overflow-auto`

**URLs com token:** Para `<img>` e `<audio>` que não suportam headers, usar `?token=<jwt>` como query param (já suportado pelo auth middleware para EventSource/SSE).

#### Regras

- Componentes shadcn — usar `Collapsible`, `Button` do shadcn
- Lazy loading de imagens — `loading="lazy"`
- Interface em pt-BR — textos como "Imagem enviada", "arquivo removido"

### Feature F-341: Indicador de progresso de upload

**Spec:** S-094 seção 2.3

Modificar `AttachmentPreview` em `MessageInput.tsx`:

Quando `isUploading === true`, mostrar indicador:
- Spinner (`Loader2` com `animate-spin`) + texto "Enviando arquivos..."
- Posicionado junto ao preview de attachments
- Desaparece quando upload completa (sucesso ou erro)

Indicador simples (spinner) é suficiente para o MVP. Barra de progresso granular com `XMLHttpRequest.upload.onprogress` é extensão futura.

## Limites

- **NÃO** implementar barra de progresso granular — spinner simples é suficiente
- **NÃO** implementar lightbox elaborado — modal simples com `<img>` em tamanho real
- **NÃO** implementar preview de PDF inline — chip com link é suficiente
- **NÃO** converter URLs de mídia para blob URLs — `?token=` é mais simples e já funciona
- **NÃO** alterar componentes existentes de `MessageInput` além do necessário para o wiring

## Validacao

- [ ] `handleSubmit` com attachments → envia `FormData` multipart
- [ ] `handleSubmit` sem attachments → fluxo JSON original
- [ ] Erro 413/415 → mensagem exibida ao usuário
- [ ] Streaming SSE funciona após upload multipart
- [ ] Imagem no histórico → thumbnail renderizado, clicável para expandir
- [ ] Áudio no histórico → player inline com play/pause
- [ ] PDF no histórico → chip com ícone e nome, clicável para download
- [ ] Texto pré-processado (DOCX/XLSX) → bloco colapsável com preview
- [ ] Indicador de progresso visível durante upload
- [ ] Input e attachments limpos após envio bem-sucedido
- [ ] URLs de assets usam `?token=` para autenticação
- [ ] TypeScript compila sem erros em `apps/packages/ai-chat`

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-339 submit multipart FormData | S-094 | D-009 |
| F-340 rendering attachments MessageBubble | S-094 | D-009 |
| F-341 indicador progresso upload | S-094 | D-009 |
