# S-091 — Rota GET Attachments

Criar rota para servir arquivos de attachment com autenticação JWT e content-type correto.

**Resolve:** D-006 (rota GET attachments)
**Score de prioridade:** 8
**Dependencia:** S-087 — storage de attachments deve existir
**PRP:** 21 — File Upload: Envio de Arquivos para o Modelo

---

## 1. Objetivo

Sem esta rota, o frontend não consegue exibir thumbnails de imagens, reproduzir áudio, nem oferecer download de PDFs. Os arquivos estão no servidor mas são inacessíveis via HTTP.

---

## 2. Alterações

### 2.1 Arquivo: `apps/backbone/src/routes/conversations.ts` (MODIFICAR)

Adicionar nova rota:

```
GET /conversations/:sessionId/attachments/:filename
```

#### Handler

```typescript
app.get("/conversations/:sessionId/attachments/:filename", authMiddleware, async (c) => {
  const { sessionId, filename } = c.req.param();

  // Sanitizar filename — prevenir path traversal
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return c.json({ error: "Nome de arquivo inválido" }, 400);
  }

  // Resolver caminho da sessão
  const sessionDir = resolveSessionDir(sessionId);
  if (!sessionDir) {
    return c.json({ error: "Sessão não encontrada" }, 404);
  }

  const filepath = path.join(sessionDir, "attachments", filename);

  if (!existsSync(filepath)) {
    return c.json({ error: "Arquivo não encontrado" }, 404);
  }

  // Derivar content-type da extensão
  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_MAP[ext] ?? "application/octet-stream";

  const buffer = await readFile(filepath);
  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
});
```

#### Mapa de MIME types

```typescript
const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".webm": "audio/webm",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".json": "application/json",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
```

### 2.2 Segurança

- **Auth JWT obrigatória** — mesmo middleware das demais rotas de conversa
- **Path traversal prevention** — rejeitar `..`, `/`, `\` no filename
- **Escopo limitado** — só serve arquivos do diretório `attachments/` da sessão
- **Cache-Control private** — browser pode cachear mas proxies não

---

## 3. Regras de Implementação

- **Reusar o middleware de auth existente** — não criar auth customizada
- **Reusar `resolveSessionDir()`** — a função que localiza o diretório da sessão pelo ID já deve existir na rota de conversas
- **Não usar `express.static()` ou equivalente** — servir manualmente para manter controle de auth e sanitização
- **Fallback `application/octet-stream`** para extensões desconhecidas — raro mas seguro

---

## 4. Critérios de Aceite

- [ ] Rota `GET /conversations/:sessionId/attachments/:filename` existe
- [ ] Auth JWT obrigatória — request sem token retorna 401
- [ ] Path traversal (`..`, `/`, `\`) retorna 400
- [ ] Sessão inexistente retorna 404
- [ ] Arquivo inexistente retorna 404
- [ ] Arquivo existente retorna com `Content-Type` correto derivado da extensão
- [ ] Imagens (png/jpeg/gif/webp) servidas com MIME correto
- [ ] PDFs servidos com `application/pdf`
- [ ] Áudios servidos com MIME correto
- [ ] Header `Cache-Control: private, max-age=3600` presente
- [ ] TypeScript compila sem erros
