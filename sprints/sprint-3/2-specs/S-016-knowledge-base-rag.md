# AB Hub - Knowledge Base com RAG

Upload de documentos para alimentar agentes via RAG, com indexacao automatica no pipeline de memoria semantica existente.

---

## 1. Objetivo

- Interface para upload de PDFs, textos e documentos que alimentam o agente
- Indexacao automatica no pipeline de embeddings + sqlite-vec existente
- Gestao de documentos: listar, visualizar, excluir
- Agente consulta knowledge base via busca hibrida (vetor + texto) ja existente
- Resolver D-024 (sem knowledge base), G-024 (upload de docs para RAG)

---

## 2. Armazenamento de Documentos

### 2.1 Estrutura no Filesystem

Documentos ficam no diretorio do agente, seguindo o padrao de filesystem do backbone:

```
context/agents/:owner.:slug/knowledge/
  doc-001.md          -- documento convertido para markdown
  doc-002.md
  ...
```

PDFs e outros formatos sao convertidos para markdown no momento do upload (server-side). O pipeline de embeddings existente (`memory/`) ja indexa todos os `.md` do escopo do agente — ao salvar documentos em `knowledge/`, eles sao automaticamente indexados na proxima passada de embedding.

### 2.2 Nova Tabela: `knowledge_docs`

Metadados dos documentos (o conteudo fica no filesystem).

```sql
CREATE TABLE IF NOT EXISTS knowledge_docs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id     TEXT NOT NULL,
  filename     TEXT NOT NULL,            -- nome original do arquivo
  slug         TEXT NOT NULL,            -- slug do arquivo em knowledge/
  content_type TEXT NOT NULL,            -- 'application/pdf', 'text/plain', 'text/markdown'
  size_bytes   INTEGER NOT NULL,
  chunks       INTEGER NOT NULL DEFAULT 0,  -- numero de chunks gerados
  status       TEXT NOT NULL DEFAULT 'processing', -- 'processing', 'indexed', 'error'
  error        TEXT,                     -- mensagem de erro se falhou
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agent_id, slug)
);

CREATE INDEX idx_knowledge_docs_agent ON knowledge_docs(agent_id);
```

---

## 3. Backend: Pipeline de Indexacao

### 3.1 Upload Flow

1. Hub envia arquivo via `POST /agents/:id/knowledge` (multipart)
2. Backend salva arquivo temporario
3. Converte para markdown:
   - `.md` / `.txt` — usa direto
   - `.pdf` — extrair texto (usar `pdf-parse` ou similar)
4. Salva como `knowledge/doc-{slug}.md` no diretorio do agente
5. Insere registro em `knowledge_docs` com status `processing`
6. Dispara re-indexacao do agente (re-chunk + re-embed dos novos docs)
7. Atualiza status para `indexed` com contagem de chunks

### 3.2 Integracao com Pipeline de Memoria

O pipeline existente em `memory/` ja faz:
- Scan de `.md` no escopo do agente
- Chunking (400 tokens, 80 overlap)
- Embedding via OpenAI `text-embedding-3-small`
- Indexacao em sqlite-vec + FTS5

Ao adicionar documento em `knowledge/`, chamar `reindexAgent(agentId)` para processar os novos arquivos. O pipeline ja ignora arquivos inalterados (pode usar hash ou mtime).

### 3.3 Exclusao

Ao excluir documento:
1. Remove arquivo de `knowledge/`
2. Remove registro de `knowledge_docs`
3. Remove chunks/embeddings correspondentes do sqlite-vec
4. Dispara re-indexacao

---

## 4. API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:id/knowledge` | Listar documentos do agente |
| POST | `/agents/:id/knowledge` | Upload de documento (multipart) |
| GET | `/agents/:id/knowledge/:docId` | Detalhes de um documento |
| DELETE | `/agents/:id/knowledge/:docId` | Excluir documento |

### 4.1 GET `/agents/:id/knowledge`

**Response:**

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

### 4.2 POST `/agents/:id/knowledge`

**Content-Type:** `multipart/form-data`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `file` | File | Arquivo (PDF, TXT, MD) |

**Limites:**
- Max 10 MB por arquivo
- Tipos aceitos: `.pdf`, `.txt`, `.md`
- Max 50 documentos por agente

**Response:** `201 Created` com o registro criado (status `processing`).

### 4.3 DELETE `/agents/:id/knowledge/:docId`

Remove documento e seus embeddings. Response: `204 No Content`.

---

## 5. Telas

### 5.1 Aba Knowledge na Pagina do Agente

A pagina de detalhes do agente (`/agents/:id`) ja tem tabs (Visao Geral, Heartbeat, etc.). Adicionar nova tab "Knowledge Base".

### 5.2 Layout da Aba Knowledge

```
+---------- Knowledge Base ----------------+
| Documentos do Agente                     |
| [Enviar documento]                       |
|                                          |
| +--------------------------------------+ |
| | manual-atendimento.pdf    245 KB     | |
| | 42 chunks | Indexado | 07/03 14:00  | |
| | [Ver] [Excluir]                      | |
| +--------------------------------------+ |
| | faq-produtos.md           12 KB      | |
| | 8 chunks | Indexado | 06/03 10:00   | |
| | [Ver] [Excluir]                      | |
| +--------------------------------------+ |
| | catalogo-2026.pdf         1.2 MB     | |
| | Processando...                       | |
| +--------------------------------------+ |
|                                          |
| Dica: Documentos sao automaticamente    |
| indexados e ficam disponiveis para o     |
| agente consultar nas conversas.          |
+------------------------------------------+
```

### 5.3 Upload Dialog

- Botao "Enviar documento" abre dialog/drawer
- Drag-and-drop ou seletor de arquivo
- Preview do nome e tamanho antes de enviar
- Barra de progresso durante upload
- Feedback: "Processando..." → "Indexado" (via invalidacao de query)

### 5.4 Detalhes do Documento

Click em "Ver" abre drawer com:
- Nome original, tamanho, data de upload
- Status de indexacao
- Numero de chunks gerados
- Preview do conteudo markdown (primeiros 500 chars)

---

## 6. Componentes

### 6.1 KnowledgeTab

**Localizacao:** `components/agents/knowledge-tab.tsx`

```typescript
interface KnowledgeTabProps {
  agentId: string;
}
```

### 6.2 KnowledgeDocList

**Localizacao:** `components/agents/knowledge-doc-list.tsx`

```typescript
interface KnowledgeDocListProps {
  docs: KnowledgeDoc[];
  onDelete: (docId: number) => void;
  onView: (docId: number) => void;
}
```

### 6.3 KnowledgeUploadDialog

**Localizacao:** `components/agents/knowledge-upload-dialog.tsx`

- React Hook Form para validacao
- Input file com accept `.pdf,.txt,.md`
- Drag-and-drop zone

### 6.4 KnowledgeDocDetail

**Localizacao:** `components/agents/knowledge-doc-detail.tsx`

- Drawer com detalhes e preview

### 6.5 API Module

**Localizacao:** `api/knowledge.ts`

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

---

## 7. Criterios de Aceite

- [ ] Upload de arquivo PDF funciona e converte para markdown
- [ ] Upload de arquivo TXT/MD funciona
- [ ] Documento salvo em `knowledge/` no diretorio do agente
- [ ] Registro em `knowledge_docs` com status correto
- [ ] Pipeline de embeddings indexa documentos automaticamente
- [ ] Agente consegue consultar knowledge base em conversas
- [ ] Lista de documentos exibida na aba Knowledge do agente
- [ ] Exclusao remove arquivo, registro e embeddings
- [ ] Limite de 10 MB por arquivo aplicado
- [ ] Limite de 50 documentos por agente aplicado
- [ ] Status de processamento visivel (processing → indexed)
- [ ] Erro de processamento exibido ao usuario
- [ ] Upload com drag-and-drop funciona

---

## 8. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| Upload + conversao | D-024 (sem knowledge base), G-024 (upload docs) |
| Pipeline indexacao | D-024 (RAG), G-024 (indexacao automatica) |
| KnowledgeTab + DocList | G-024 (gestao de docs), G-012 (onboarding) |
| Busca hibrida (existente) | D-024 (consulta via RAG), G-006 (memoria evolui) |
