# S-094 — Frontend: Wiring do Submit + Rendering de Attachments

Refatorar `handleSubmit` para enviar `FormData` multipart, renderizar attachments em mensagens, e mostrar progresso de upload.

**Resolve:** D-009 (frontend wiring submit + rendering attachments + progress)
**Score de prioridade:** 8
**Dependencia:** S-089 (persistência _ref), S-090 (sendMessage com content array)
**PRP:** 21 — File Upload: Envio de Arquivos para o Modelo

---

## 1. Objetivo

Toda a UI de coleta de attachments em `MessageInput.tsx` é dead code no flow de envio — `handleSubmit` ignora os arquivos. Esta spec fecha o loop UX: enviar arquivos via multipart, mostrar progresso, e renderizar attachments no histórico de mensagens.

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-chat/src/components/Chat.tsx` (MODIFICAR)

#### Refatorar `handleSubmit`

Hoje o submit usa `useChatContext` que ignora attachments. Refatorar para:

1. Se há attachments, construir `FormData` e enviar via `fetch` para a rota multipart
2. Se não há attachments, manter o fluxo atual (JSON)

```typescript
const handleSubmit = async (e: React.FormEvent, attachments?: Attachment[]) => {
  e.preventDefault();

  if (attachments?.length) {
    // Multipart: FormData com message + files
    const formData = new FormData();
    if (inputValue.trim()) {
      formData.append("message", inputValue);
    }
    for (const att of attachments) {
      formData.append("files", att.file);
    }

    // Upload via fetch (não usa useChat.handleSubmit)
    setIsUploading(true);
    try {
      const response = await fetch(`${endpoint}/conversations/${sessionId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        // Mostrar erro ao usuário (413, 415, etc.)
        throw new Error(error.error ?? "Erro no upload");
      }

      // Streaming SSE do response — processar datastream protocol
      // (reusar lógica existente de consumo de streaming)
    } finally {
      setIsUploading(false);
    }

    // Limpar input e attachments
    setInputValue("");
    clearAttachments();
  } else {
    // Fluxo atual: JSON via useChat
    originalHandleSubmit(e);
  }
};
```

**Estado `isUploading`:** novo estado boolean para controlar indicador de progresso.

### 2.2 Arquivo: `apps/packages/ai-chat/src/components/MessageBubble.tsx` (MODIFICAR)

#### Renderizar content parts de mídia

Hoje `MessageBubble` renderiza apenas `text`, `reasoning`, `tool-invocation` via `PartRenderer`. Adicionar rendering para parts de upload:

**Imagens (`ImagePart`):**
```tsx
if (part.type === "image") {
  const src = part._ref
    ? `${endpoint}/conversations/${sessionId}/attachments/${part._ref}`
    : `data:${part.mimeType};base64,${part.image}`;

  return (
    <button onClick={() => openLightbox(src)} className="cursor-pointer">
      <img
        src={src}
        alt="Imagem enviada"
        className="max-w-xs rounded-lg border"
        loading="lazy"
      />
    </button>
  );
}
```

**Áudio (`FilePart` com mimeType audio/*):**
```tsx
if (part.type === "file" && part.mimeType?.startsWith("audio/")) {
  const src = part._ref
    ? `${endpoint}/conversations/${sessionId}/attachments/${part._ref}`
    : `data:${part.mimeType};base64,${part.data}`;

  return (
    <audio controls className="max-w-xs">
      <source src={src} type={part.mimeType} />
    </audio>
  );
}
```

**PDF (`FilePart` com mimeType application/pdf):**
```tsx
if (part.type === "file" && part.mimeType === "application/pdf") {
  const href = part._ref
    ? `${endpoint}/conversations/${sessionId}/attachments/${part._ref}`
    : "#";

  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
       className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted hover:bg-accent">
      <FileIcon className="h-4 w-4" />
      <span className="text-sm">{part._ref ?? "documento.pdf"}</span>
    </a>
  );
}
```

**Texto pré-processado (TextPart com prefixo `[📎`):**
```tsx
if (part.type === "text" && part.text.startsWith("[📎")) {
  // Bloco colapsável com preview das primeiras linhas
  const lines = part.text.split("\n");
  const header = lines[0]; // [📎 filename]
  const preview = lines.slice(1, 6).join("\n");
  const full = lines.slice(1).join("\n");

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground">
        <PaperclipIcon className="h-4 w-4" />
        {header}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="text-xs bg-muted p-2 rounded mt-1 max-h-40 overflow-auto">
          {full}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### 2.3 Indicador de Progresso

No `AttachmentPreview` (já existente em `MessageInput.tsx`), mostrar estado de upload:

```tsx
{isUploading && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" />
    Enviando arquivos...
  </div>
)}
```

Alternativa: barra de progresso com `XMLHttpRequest.upload.onprogress` se granularidade fina for desejada. Mas indicador simples (spinner) é suficiente para o MVP.

### 2.4 URLs dos Assets

Todas as URLs de mídia no histórico apontam para:

```
GET /conversations/:sessionId/attachments/:filename
```

Com `Authorization: Bearer <token>` no header. Para `<img>` e `<audio>` que não suportam headers, considerar:
- Usar `?token=<jwt>` como query param (já suportado pelo auth middleware para EventSource/SSE)
- Ou converter para blob URL via fetch autenticado

A abordagem `?token=` é mais simples e já está implementada no backend.

---

## 3. Regras de Implementação

- **Não quebrar fluxo sem attachments** — se não há arquivos, usar `useChat.handleSubmit` original
- **Tratamento de erros de upload** — mostrar mensagem do backend (413, 415) ao usuário de forma amigável
- **Lazy loading de imagens** — usar `loading="lazy"` para não carregar todas as imagens do histórico de uma vez
- **URLs com token** — para `<img>` e `<audio>`, usar `?token=` query param já suportado
- **Componentes shadcn** — usar `Collapsible` do shadcn para texto pré-processado, `Button` para chips de PDF
- **Manter o streaming SSE** — após upload multipart, o backend retorna streaming normalmente; processar com mesmo consumer existente
- **Interface em pt-BR** — textos como "Enviando arquivos...", "Imagem enviada", "arquivo removido" etc.

---

## 4. Critérios de Aceite

- [ ] `handleSubmit` com attachments → envia `FormData` multipart para a rota de upload
- [ ] `handleSubmit` sem attachments → fluxo JSON original (retrocompatível)
- [ ] Erro 413/415 → mensagem exibida ao usuário
- [ ] Streaming SSE da resposta funciona após upload multipart
- [ ] Imagem no histórico → thumbnail renderizado, clicável para expandir
- [ ] Áudio no histórico → player inline com play/pause
- [ ] PDF no histórico → chip com ícone e nome, clicável para abrir/download
- [ ] Texto pré-processado (DOCX/XLSX) → bloco colapsável com preview
- [ ] Indicador de progresso visível durante upload
- [ ] Input e attachments limpos após envio bem-sucedido
- [ ] TypeScript compila sem erros em `apps/packages/ai-chat`
