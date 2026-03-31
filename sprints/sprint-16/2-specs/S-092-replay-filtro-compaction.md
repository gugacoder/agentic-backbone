# S-092 — Replay com Filtro de Mídia Antiga + Compaction de Tokens

Implementar filtro que substitui binários antigos por placeholders no replay, e atualizar estimativa de tokens para content parts de mídia.

**Resolve:** D-007 (replay filtro de mídia antiga + compaction com estimativa de tokens)
**Score de prioridade:** 8
**Dependencia:** S-089 (persistência _ref), S-090 (sendMessage com content array)
**PRP:** 21 — File Upload: Envio de Arquivos para o Modelo

---

## 1. Objetivo

Ao retomar uma sessão com histórico de attachments, reenviar binários de mensagens antigas desperdiça tokens sem valor contextual. O modelo já "viu" essas imagens/áudios — reenviá-los não agrega. Além disso, `countMessageTokens()` precisa estimar tokens de mídia para que compaction dispare corretamente.

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-sdk/src/session.ts` (MODIFICAR)

#### Função: `filterOldMedia()`

Aplicar filtro ao carregar `previousMessages` antes de enviar ao `streamText`:

```typescript
export function filterOldMedia(
  messages: ModelMessage[],
  lastUserIndex: number
): ModelMessage[] {
  return messages.map((msg, i) => {
    // Última mensagem do usuário: manter tudo
    if (i === lastUserIndex) return msg;

    // Mensagens do assistant: manter tudo (não têm uploads)
    if (msg.role !== "user") return msg;

    // Mensagens anteriores do usuário: substituir binários por placeholder
    if (!Array.isArray(msg.content)) return msg;

    const filtered = msg.content.map((part: any) => {
      if (part.type === "image") {
        const name = part._ref ?? "imagem";
        return { type: "text", text: `[imagem enviada: ${name}]` };
      }
      if (part.type === "file" && part.data) {
        const name = part._ref ?? "arquivo";
        return { type: "text", text: `[arquivo enviado: ${name}]` };
      }
      // TextPart: sempre manter
      return part;
    });

    return { ...msg, content: filtered };
  });
}
```

**Onde chamar:** Após `loadSession()` e `resolveRefs()` (S-089), antes de passar `previousMessages` para `runAgent()` / `streamText()`.

**Lógica de `lastUserIndex`:** índice da última mensagem com `role: "user"` no array.

### 2.2 Arquivo: `apps/packages/ai-sdk/src/context/compaction.ts` (MODIFICAR)

#### Função: `countMessageTokens()`

Assinatura atual:
```typescript
function countMessageTokens(msg: ModelMessage): number
```

Expandir para estimar tokens de content parts de mídia:

```typescript
function countMessageTokens(msg: ModelMessage): number {
  const overhead = 4; // role + framing

  if (typeof msg.content === "string") {
    return overhead + countTokens(msg.content);
  }

  if (!Array.isArray(msg.content)) {
    return overhead;
  }

  let tokens = overhead;
  for (const part of msg.content) {
    const p = part as Record<string, unknown>;

    if (p.type === "text" && typeof p.text === "string") {
      tokens += countTokens(p.text);
    } else if (p.type === "image") {
      // Estimativa: ~300 tokens (média de imagens redimensionadas pelo provider)
      tokens += 300;
    } else if (p.type === "file") {
      const mime = (p.mimeType as string) ?? "";
      if (mime === "application/pdf") {
        // ~500 tokens por página. Estimativa conservadora: 3 páginas médias
        tokens += 1500;
      } else if (mime.startsWith("audio/")) {
        // ~100 tokens por minuto. Estimativa: 2 minutos médios
        tokens += 200;
      } else {
        // Fallback genérico
        tokens += 500;
      }
    } else {
      // Part desconhecido
      tokens += 500;
    }
  }

  return tokens;
}
```

**Nota:** As estimativas não precisam ser exatas. O objetivo é que compaction dispare num momento razoável, evitando que sessões com muitos uploads nunca compactem.

---

## 3. Regras de Implementação

- **Filtro só afeta mensagens anteriores do usuário** — a última mensagem do usuário mantém todos os parts (o modelo precisa ver o que acabou de ser enviado)
- **Mensagens do assistant nunca são filtradas** — não contêm uploads de usuário
- **TextParts sempre mantidos** — texto extraído de DOCX/XLSX tem valor contextual duradouro
- **Placeholders informativos** — incluir nome do arquivo quando disponível (`_ref` ou fallback genérico)
- **Estimativas de tokens são conservadoras** — melhor compactar cedo demais que tarde demais
- **Retrocompatível** — `countMessageTokens()` com `content: string` continua funcionando igual

---

## 4. Critérios de Aceite

- [ ] `filterOldMedia()` substitui `ImagePart` por `[imagem enviada: nome]` em mensagens anteriores
- [ ] `filterOldMedia()` substitui `FilePart` binário por `[arquivo enviado: nome]` em mensagens anteriores
- [ ] `filterOldMedia()` mantém todos os parts da última mensagem do usuário
- [ ] `filterOldMedia()` mantém `TextPart` em todas as mensagens
- [ ] `filterOldMedia()` não altera mensagens do assistant
- [ ] `countMessageTokens()` retorna ~300 para `ImagePart`
- [ ] `countMessageTokens()` retorna ~1500 para `FilePart` PDF
- [ ] `countMessageTokens()` retorna ~200 para `FilePart` áudio
- [ ] `countMessageTokens()` retorna ~500 para parts desconhecidos
- [ ] `countMessageTokens()` com `content: string` retorna mesmo valor de antes (retrocompatível)
- [ ] TypeScript compila sem erros em `apps/packages/ai-sdk`
