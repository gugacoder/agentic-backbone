# AB Hub - Memoria Semantica

Visualizacao e gestao da memoria semantica dos agentes — fatos aprendidos, busca por conteudo e controles de sincronizacao.

---

## 1. Objetivo

- Exibir status da memoria de cada agente (arquivos indexados, chunks)
- Permitir busca semantica pelo Hub (pesquisar o que o agente "sabe")
- Controles de sincronizacao e reset da base vetorial
- Visualizar fatos acumulados em MEMORY.md
- Resolver D-008 (contexto perdido), D-013 (chatbots nao aprendem), G-006 (memoria evolutiva)

---

## 2. API Endpoints Existentes

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:id/memory/status` | `MemoryStatus` (fileCount, chunkCount) |
| GET | `/agents/:id/memory/chunks` | `MemoryChunk[]` (com paginacao) |
| POST | `/agents/:id/memory/search` | `MemorySearchResult[]` (query semantica) |
| POST | `/agents/:id/memory/sync` | Reindexar base vetorial |
| DELETE | `/agents/:id/memory/chunks` | Limpar chunks |
| POST | `/agents/:id/memory/reset` | Reset completo da memoria |
| GET | `/agents/:id/files/MEMORY.md` | Conteudo do MEMORY.md |

---

## 3. Telas

### 3.1 Tab Memoria (`/agents/:id` tab Memoria)

**Layout:** Dividido em 3 secoes.

**Secao 1 — Status:**

| Metrica | Fonte | Visual |
|---------|-------|--------|
| Arquivos indexados | `status.fileCount` | Card numerico |
| Chunks na base | `status.chunkCount` | Card numerico |
| Ultima sincronizacao | timestamp do sync | Texto relativo |

**Acoes:**
- Botao "Sincronizar" → `POST /agents/:id/memory/sync`
- Botao "Limpar Memoria" → confirmacao → `POST /agents/:id/memory/reset`

**Secao 2 — MEMORY.md (Fatos Aprendidos):**

- Renderizacao markdown do conteudo de `MEMORY.md`
- Somente leitura (fatos sao extraidos automaticamente pelo agente)
- Indicador se MEMORY.md esta vazio ("Nenhum fato aprendido ainda")

**Secao 3 — Busca Semantica:**

- Input de busca com placeholder "Pesquisar na memoria do agente..."
- Ao buscar: `POST /agents/:id/memory/search` com `{ query, limit: 10 }`
- Resultados em lista:

| Campo | Fonte | Visual |
|-------|-------|--------|
| Arquivo | `result.path` | Badge com nome do arquivo |
| Trecho | `result.snippet` | Texto com highlight do match |
| Score | `result.score` | Barra de relevancia (0-1) |
| Fonte | `result.source` | Badge (vector / text) |
| Citacao | `result.citation` | Link: arquivo:linha |

---

## 4. Componentes

### 4.1 MemoryStatusPanel

**Localizacao:** `components/agents/memory-status-panel.tsx`

```typescript
interface MemoryStatusPanelProps {
  agentId: string;
  status: MemoryStatus;
  onSync: () => void;
  onReset: () => void;
}
```

### 4.2 MemorySearchBox

**Localizacao:** `components/agents/memory-search-box.tsx`

```typescript
interface MemorySearchBoxProps {
  agentId: string;
}
```

- Debounce de 500ms no input
- Loading state durante busca
- Empty state: "Nenhum resultado encontrado"

### 4.3 MemorySearchResult

**Localizacao:** `components/agents/memory-search-result.tsx`

```typescript
interface MemorySearchResultProps {
  result: MemorySearchResult;
}
```

- Snippet com texto truncado e highlight
- Score como barra visual (Tailwind width percentage)

---

## 5. Criterios de Aceite

- [ ] Tab Memoria exibe contagem de arquivos e chunks indexados
- [ ] MEMORY.md renderiza em markdown com fatos aprendidos
- [ ] Busca semantica retorna resultados relevantes com score
- [ ] Resultados mostram snippet, arquivo fonte e score visual
- [ ] Botao Sincronizar reindexar base e atualiza contagem
- [ ] Botao Limpar Memoria pede confirmacao dupla (acao destrutiva)
- [ ] Estado vazio exibe mensagem orientativa
- [ ] Busca com debounce nao dispara requests excessivos

---

## 6. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| MemoryStatus | D-008, D-013 (memoria perdida / estatica) |
| MEMORY.md Viewer | G-006 (memoria evolutiva — visibilidade) |
| Busca Semantica | G-006 (memoria acessivel via UI) |
| Sync/Reset | G-007 (independencia tecnica) |
