# S-087 — Rota Multipart + Storage + Dependências + Validação

Refatorar `POST /conversations/:sessionId/messages` para aceitar `multipart/form-data`, instalar dependências `mammoth` e `xlsx`, criar storage `attachments/`, e implementar validação completa de limites.

**Resolve:** D-002 (rota multipart + storage + deps), D-010 (validação de limites 413/415)
**Score de prioridade:** 10
**Dependencia:** Nenhuma — desbloqueador de todas as fases seguintes
**PRP:** 21 — File Upload: Envio de Arquivos para o Modelo

---

## 1. Objetivo

Sem aceitação de multipart no backend, nenhum arquivo chega ao sistema. Esta spec instala as dependências necessárias, refatora a rota de mensagens para aceitar arquivos, cria a estrutura de storage, e valida limites de tamanho/tipo.

---

## 2. Alterações

### 2.1 Dependências: `apps/backbone/package.json`

Instalar no workspace `apps/backbone`:

```bash
npm install mammoth xlsx --workspace=apps/backbone
```

- `mammoth` — conversão DOCX → HTML/Markdown
- `xlsx` (SheetJS) — conversão XLSX → CSV

### 2.2 Arquivo: `apps/backbone/src/routes/conversations.ts` (MODIFICAR)

A rota `POST /conversations/:sessionId/messages` hoje aceita apenas `application/json` com `{ message: string }`.

Refatorar para aceitar **dois content types**:

```typescript
// Detecção do content type
const contentType = c.req.header("content-type") ?? "";

if (contentType.includes("multipart/form-data")) {
  // Novo: processar multipart
  const body = await c.req.parseBody({ all: true });
  const message = typeof body.message === "string" ? body.message : undefined;
  const files = Array.isArray(body.files) ? body.files : body.files ? [body.files] : [];
  // ... validação e processamento
} else {
  // Retrocompatível: JSON
  const { message } = await c.req.json();
  // ... comportamento atual
}
```

**Validação de limites** (aplicar antes de qualquer processamento):

| Regra | HTTP Status | Mensagem |
|---|---|---|
| MIME type não suportado | `415 Unsupported Media Type` | `Tipo de arquivo não suportado: {mime}. Tipos aceitos: image/png, image/jpeg, ...` |
| Arquivo excede limite individual | `413 Payload Too Large` | `Arquivo {name} excede o limite de {limit}MB para {tipo}` |
| Total excede 50 MB | `413 Payload Too Large` | `Total de arquivos ({size}MB) excede o limite de 50MB por mensagem` |
| Mais de 10 arquivos | `413 Payload Too Large` | `Máximo de 10 arquivos por mensagem. Enviados: {count}` |
| Nem `message` nem `files` presente | `400 Bad Request` | `Mensagem ou arquivos obrigatórios` |

**Limites por tipo:**

```typescript
const SIZE_LIMITS: Record<string, number> = {
  "image/png": 20 * 1024 * 1024,
  "image/jpeg": 20 * 1024 * 1024,
  "image/gif": 20 * 1024 * 1024,
  "image/webp": 20 * 1024 * 1024,
  "application/pdf": 30 * 1024 * 1024,
  "audio/wav": 25 * 1024 * 1024,
  "audio/mp3": 25 * 1024 * 1024,
  "audio/mpeg": 25 * 1024 * 1024,
  "audio/ogg": 25 * 1024 * 1024,
  "audio/webm": 25 * 1024 * 1024,
  "text/plain": 5 * 1024 * 1024,
  "text/csv": 5 * 1024 * 1024,
  "application/json": 5 * 1024 * 1024,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": 15 * 1024 * 1024,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": 10 * 1024 * 1024,
};
const MAX_TOTAL_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 10;
```

**MIME types suportados** — conjunto derivado das chaves de `SIZE_LIMITS`. Qualquer MIME fora desse conjunto retorna 415.

### 2.3 Storage: Diretório `attachments/`

Criar `{sessionDir}/attachments/` na primeira vez que um arquivo é recebido:

```typescript
import { mkdir } from "node:fs/promises";

const attachmentsDir = path.join(sessionDir, "attachments");
await mkdir(attachmentsDir, { recursive: true });
```

Estrutura resultante:

```
agents/{agentId}/conversations/{sessionId}/
  ├── SESSION.yml
  ├── messages.jsonl
  └── attachments/
      ├── att_1711792800000_a3f2c1.png
      └── att_1711792800123_b4e3d2.pdf
```

### 2.4 Geração de ID de Attachment

Formato: `att_{timestamp}_{random6hex}` com extensão preservada do original.

```typescript
import crypto from "node:crypto";

function generateAttachmentId(originalName: string): string {
  const ext = path.extname(originalName) || "";
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString("hex");
  return `att_${ts}_${rand}${ext}`;
}
```

### 2.5 Salvar Arquivos no Disco

Para cada arquivo validado:

```typescript
const filename = generateAttachmentId(file.name);
const filepath = path.join(attachmentsDir, filename);
const buffer = Buffer.from(await file.arrayBuffer());
await writeFile(filepath, buffer);
```

Após salvar, passar `{ filename, filepath, mimeType: file.type, size: file.size }` para o classificador (S-088).

---

## 3. Regras de Implementação

- **Validação no backend** — não confiar no frontend para limites ou tipos
- **Retrocompatibilidade obrigatória** — `application/json` com `{ message: string }` deve continuar funcionando identicamente
- **Parser nativo do Hono** — usar `c.req.parseBody({ all: true })` para multipart, não instalar lib externa
- **Erro 415 inclui lista de tipos aceitos** — ajuda o usuário a saber o que pode enviar
- **Erro 413 indica qual limite foi violado** — tipo individual, total, ou contagem
- **Não processar arquivos se validação falhar** — retornar erro imediatamente

---

## 4. Critérios de Aceite

- [ ] `mammoth` e `xlsx` instalados em `apps/backbone/package.json`
- [ ] `POST /conversations/:id/messages` aceita `multipart/form-data` com campos `message` e `files`
- [ ] `POST /conversations/:id/messages` com `application/json` continua funcionando (retrocompatível)
- [ ] Diretório `attachments/` criado automaticamente no primeiro upload dentro da sessão
- [ ] ID de attachment gerado no formato `att_{ts}_{hex}.{ext}`
- [ ] Arquivos salvos em `{sessionDir}/attachments/`
- [ ] MIME type não suportado → 415 com lista de tipos aceitos
- [ ] Arquivo acima do limite individual → 413 com mensagem indicando tipo e limite
- [ ] Total acima de 50MB → 413 com mensagem indicando total
- [ ] Mais de 10 arquivos → 413 com contagem
- [ ] Mensagem sem texto nem arquivos → 400
- [ ] TypeScript compila sem erros
