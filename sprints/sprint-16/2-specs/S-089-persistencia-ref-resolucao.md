# S-089 — Persistência com `_ref` + Resolução na Leitura

Implementar substituição de base64 por referência `_ref` ao salvar no JSONL, e resolução de referências ao carregar o histórico em `loadSession()`.

**Resolve:** D-004 (persistência _ref + resolução na leitura)
**Score de prioridade:** 9
**Dependencia:** S-088 — classificador já produz content parts com referências
**PRP:** 21 — File Upload: Envio de Arquivos para o Modelo

---

## 1. Objetivo

Sem o mecanismo `_ref`, todo base64 de arquivos vai direto ao `messages.jsonl`, inflando o arquivo indefinidamente. Esta spec implementa a substituição bidirecional: base64 → `_ref` na escrita, `_ref` → base64 na leitura.

---

## 2. Alterações

### 2.1 Arquivo: `apps/backbone/src/conversations/persistence.ts` (MODIFICAR)

#### Função: `stripBase64ForStorage()`

Criar função que percorre um content array e substitui campos binários por referências:

```typescript
function stripBase64ForStorage(
  content: Array<ContentPart>
): Array<ContentPart> {
  return content.map((part) => {
    if (part.type === "image" && "image" in part && "_ref" in (part as any)) {
      // Substituir base64 por _ref
      const { image, ...rest } = part as any;
      return { ...rest, _ref: (part as any)._ref };
    }
    if (part.type === "file" && "data" in part && "_ref" in (part as any)) {
      const { data, ...rest } = part as any;
      return { ...rest, _ref: (part as any)._ref };
    }
    return part;
  });
}
```

**Nota:** O classificador (S-088) retorna `ClassifiedPart` com `ref`. A rota (após S-090) deve adicionar `_ref` às parts antes de persistir. Alternativa: a função `stripBase64ForStorage` recebe um mapa de `partIndex → filename` e faz a substituição diretamente.

#### Integração em `appendModelMessage()`

Após S-090 expandir `appendModelMessage()` para aceitar `content: string | ContentPart[]`:

```typescript
// Ao serializar para JSONL:
if (Array.isArray(message.content)) {
  const strippedContent = stripBase64ForStorage(message.content);
  line = JSON.stringify({ ...message, content: strippedContent });
} else {
  line = JSON.stringify(message);
}
```

### 2.2 Arquivo: `apps/packages/ai-sdk/src/session.ts` (MODIFICAR)

#### Função: `resolveRefs()`

Criar função que carrega `_ref` do disco e reconstrói o content part original:

```typescript
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

async function resolveRefs(
  content: unknown[],
  attachmentsDir: string
): Promise<unknown[]> {
  const resolved: unknown[] = [];

  for (const part of content) {
    if (typeof part !== "object" || part === null) {
      resolved.push(part);
      continue;
    }

    const p = part as Record<string, unknown>;

    if ("_ref" in p && typeof p._ref === "string") {
      const filepath = path.join(attachmentsDir, p._ref);

      if (!existsSync(filepath)) {
        // Arquivo removido — substituir por placeholder
        resolved.push({
          type: "text",
          text: `[arquivo removido: ${p._ref}]`,
        });
        continue;
      }

      const buffer = await readFile(filepath);
      const base64 = buffer.toString("base64");

      if (p.type === "image") {
        const { _ref, ...rest } = p;
        resolved.push({ ...rest, image: base64 });
      } else if (p.type === "file") {
        const { _ref, ...rest } = p;
        resolved.push({ ...rest, data: base64 });
      } else {
        resolved.push(p);
      }
    } else {
      resolved.push(p);
    }
  }

  return resolved;
}
```

#### Integração em `loadSession()`

Ao carregar mensagens do JSONL, resolver referências:

```typescript
export async function loadSession(dir: string): Promise<ModelMessage[]> {
  // ... leitura existente do messages.jsonl ...

  const attachmentsDir = path.join(dir, "attachments");

  for (const msg of messages) {
    if (Array.isArray(msg.content)) {
      msg.content = await resolveRefs(msg.content, attachmentsDir);
    }
  }

  return messages;
}
```

### 2.3 Formato no JSONL — Exemplos

**Escrita (sem base64):**
```json
{"role":"user","content":[{"type":"text","text":"analise esse documento"},{"type":"file","_ref":"att_1711792800123_b4e3d2.pdf","mimeType":"application/pdf"}],"_meta":{"id":"msg_xxx","ts":"2026-03-31T12:00:00Z","userId":"system"}}
```

**Leitura (com base64 resolvido):**
```json
{"role":"user","content":[{"type":"text","text":"analise esse documento"},{"type":"file","data":"JVBERi0x...","mimeType":"application/pdf"}]}
```

---

## 3. Regras de Implementação

- **`_ref` é convenção interna do JSONL** — nunca exposto na API pública
- **TextParts nunca têm `_ref`** — texto é inline sempre (incluindo DOCX/XLSX convertidos)
- **Apenas `ImagePart` e `FilePart` binários usam `_ref`** — types `image` e `file`
- **Resolução é graceful** — arquivo ausente vira placeholder, nunca erro fatal
- **Não carregar todos os base64 em memória de uma vez** — processar sequencialmente
- **`loadSession()` precisa receber ou derivar o caminho do `attachmentsDir`** — derivar de `dir` (que é o diretório da sessão)

---

## 4. Critérios de Aceite

- [ ] `stripBase64ForStorage()` remove `image`/`data` e mantém `_ref` em parts binários
- [ ] `appendModelMessage()` persiste JSONL sem base64 para content arrays com `_ref`
- [ ] `resolveRefs()` carrega arquivo do disco e reconstrói base64
- [ ] Arquivo ausente → `TextPart` com `[arquivo removido: nome.ext]`
- [ ] `loadSession()` resolve `_ref` automaticamente ao carregar histórico
- [ ] JSONL existente (sem `_ref`) continua sendo lido normalmente (retrocompatível)
- [ ] TextParts não são afetados pela substituição
- [ ] TypeScript compila sem erros em `apps/backbone` e `apps/packages/ai-sdk`
