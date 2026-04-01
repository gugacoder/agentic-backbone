# PRP-16 — Knowledge Base com RAG

Upload de documentos (PDF, TXT, MD) para alimentar agentes via RAG, com indexacao automatica no pipeline de memoria semantica existente.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O backbone tem pipeline de memoria semantica funcional: scan de `.md` no escopo do agente, chunking (400 tokens, 80 overlap), embedding via OpenAI `text-embedding-3-small`, indexacao em sqlite-vec + FTS5, busca hibrida (0.7 vetor + 0.3 texto). Porem, alimentar o agente requer edicao manual de SOUL.md ou MEMORY.md no servidor. Nao ha interface de upload de documentos nem gestao de knowledge base.

### Estado desejado

1. Diretorio `knowledge/` no escopo do agente para documentos
2. Tabela `knowledge_docs` para metadados dos documentos
3. Upload via multipart com conversao automatica (PDF → markdown)
4. Indexacao automatica via pipeline de embeddings existente
5. Aba "Knowledge Base" na pagina do agente com lista, upload e detalhes
6. Exclusao remove arquivo, registro e embeddings

## Especificacao

### Feature F-063: Tabela knowledge_docs + pipeline de upload/conversao

**Backend — nova tabela em `db/`:**

```sql
CREATE TABLE IF NOT EXISTS knowledge_docs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id     TEXT NOT NULL,
  filename     TEXT NOT NULL,
  slug         TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  chunks       INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'processing',
  error        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agent_id, slug)
);

CREATE INDEX idx_knowledge_docs_agent ON knowledge_docs(agent_id);
```

**Pipeline de upload:**

1. Hub envia arquivo via `POST /agents/:id/knowledge` (multipart)
2. Backend salva arquivo temporario
3. Converte para markdown:
   - `.md` / `.txt` — usa direto
   - `.pdf` — extrair texto (usar `pdf-parse` ou similar)
4. Salva como `knowledge/doc-{slug}.md` no diretorio do agente
5. Insere registro em `knowledge_docs` com status `processing`
6. Dispara re-indexacao do agente (`reindexAgent(agentId)` — re-chunk + re-embed)
7. Atualiza status para `indexed` com contagem de chunks

**Exclusao:**
1. Remove arquivo de `knowledge/`
2. Remove registro de `knowledge_docs`
3. Remove chunks/embeddings correspondentes do sqlite-vec
4. Dispara re-indexacao

**Limites de upload:**
- Max 10 MB por arquivo
- Tipos aceitos: `.pdf`, `.txt`, `.md`
- Max 50 documentos por agente

### Feature F-064: Endpoints de knowledge + API module

**Novos endpoints em `routes/agents.ts` (ou novo arquivo `routes/knowledge.ts`):**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:id/knowledge` | Listar documentos do agente |
| POST | `/agents/:id/knowledge` | Upload de documento (multipart) |
| GET | `/agents/:id/knowledge/:docId` | Detalhes de um documento |
| DELETE | `/agents/:id/knowledge/:docId` | Excluir documento |

**GET `/agents/:id/knowledge` response:**

```json
{
  "docs": [
    {
      "id": 1,
      "filename": "manual-atendimento.pdf",
      "slug": "doc-manual-atendimento",
      "contentType": "application/pdf",
      "sizeBytes": 245000,
      "chunks": 42,
      "status": "indexed",
      "createdAt": "2026-03-07T14:00:00Z"
    }
  ]
}
```

**POST `/agents/:id/knowledge`** — multipart, campo `file`. Response: `201 Created` com registro criado (status `processing`).

**DELETE `/agents/:id/knowledge/:docId`** — Response: `204 No Content`.

**Hub — API module `api/knowledge.ts`:**

```typescript
export const knowledgeDocsQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["knowledge", agentId],
    queryFn: () => request<{ docs: KnowledgeDoc[] }>(`/agents/${agentId}/knowledge`),
  });

export async function uploadKnowledgeDoc(agentId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return requestMultipart<KnowledgeDoc>(`/agents/${agentId}/knowledge`, { method: "POST", body: form });
}

export async function deleteKnowledgeDoc(agentId: string, docId: number) {
  return request(`/agents/${agentId}/knowledge/${docId}`, { method: "DELETE" });
}
```

### Feature F-065: Aba Knowledge na pagina do agente + upload dialog

**Nova aba** "Knowledge Base" na pagina de detalhes do agente (`/agents/:id`).

**components/agents/knowledge-tab.tsx:**

```typescript
interface KnowledgeTabProps {
  agentId: string;
}
```

- Busca docs via `knowledgeDocsQueryOptions(agentId)`
- Botao "Enviar documento" no topo
- Lista de documentos com nome, tamanho, chunks, status, data
- Acoes por documento: "Ver", "Excluir"
- Dica no rodape: "Documentos sao automaticamente indexados e ficam disponiveis para o agente consultar."

**components/agents/knowledge-upload-dialog.tsx:**

- Dialog com drag-and-drop zone ou seletor de arquivo
- Input file com accept `.pdf,.txt,.md`
- Preview do nome e tamanho antes de enviar
- Barra de progresso durante upload
- Feedback pos-upload: "Processando..." → "Indexado" (via invalidacao de query)

**components/agents/knowledge-doc-detail.tsx:**

- Drawer com detalhes: nome original, tamanho, data, status, numero de chunks
- Preview do conteudo markdown (primeiros 500 chars)

### Feature F-066: Integracao com pipeline de embeddings (reindex)

Integrar com o pipeline existente em `memory/`:

- Ao salvar documento em `knowledge/`, chamar `reindexAgent(agentId)`
- O pipeline ja faz scan de `.md`, chunking, embedding e indexacao
- Ignorar arquivos inalterados (por hash ou mtime)
- Ao excluir, remover chunks do sqlite-vec e disparar reindex
- Atualizar `knowledge_docs.chunks` com contagem real apos indexacao
- Atualizar `knowledge_docs.status` para `indexed` ou `error`

## Limites

- **NAO** implementar edicao de documentos na UI — apenas upload e exclusao.
- **NAO** implementar categorias ou tags em documentos.
- **NAO** implementar preview de PDF renderizado — apenas texto extraido.
- **NAO** implementar busca dentro da knowledge base pela UI — o agente consulta via RAG nas conversas.

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado.
- **PRP-03** (Gestao de Agentes) deve estar implementado — aba Knowledge vive na pagina do agente.
- **PRP-06** (Memoria Semantica) deve estar implementado — pipeline de embeddings reutilizado.

## Validacao

- [ ] Upload de arquivo PDF funciona e converte para markdown
- [ ] Upload de arquivo TXT/MD funciona
- [ ] Documento salvo em `knowledge/` no diretorio do agente
- [ ] Registro em `knowledge_docs` com status correto
- [ ] Pipeline de embeddings indexa documentos automaticamente
- [ ] Agente consegue consultar knowledge base em conversas (busca hibrida retorna chunks do doc)
- [ ] Lista de documentos exibida na aba Knowledge do agente
- [ ] Exclusao remove arquivo, registro e embeddings
- [ ] Limite de 10 MB por arquivo aplicado
- [ ] Limite de 50 documentos por agente aplicado
- [ ] Status de processamento visivel (processing → indexed)
- [ ] Erro de processamento exibido ao usuario
- [ ] Upload com drag-and-drop funciona
- [ ] `npm run build:hub` compila sem erros (backbone e hub)

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-063 knowledge_docs + pipeline upload | S-016 sec 2-3 | D-024, G-024 |
| F-064 Endpoints knowledge | S-016 sec 4 | G-024 |
| F-065 Aba Knowledge + upload dialog | S-016 sec 5-6 | G-024, G-012 |
| F-066 Integracao embeddings | S-016 sec 3.2-3.3 | D-024, G-006 |
