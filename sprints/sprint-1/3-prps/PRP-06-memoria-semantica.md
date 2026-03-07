# PRP-06 — Memoria Semantica

Visualizacao e gestao da memoria semantica dos agentes — fatos aprendidos, busca por conteudo e controles de sincronizacao.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O Hub tem dashboard de agentes (PRP-02) com pagina de detalhe e tabs. A tab "Memoria" existe como placeholder. O backbone expoe:

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:id/memory/status` | `MemoryStatus` (fileCount, chunkCount) |
| GET | `/agents/:id/memory/chunks` | `MemoryChunk[]` (com paginacao) |
| POST | `/agents/:id/memory/search` | `MemorySearchResult[]` (query semantica) |
| POST | `/agents/:id/memory/sync` | Reindexar base vetorial |
| DELETE | `/agents/:id/memory/chunks` | Limpar chunks |
| POST | `/agents/:id/memory/reset` | Reset completo da memoria |
| GET | `/agents/:id/files/MEMORY.md` | Conteudo do MEMORY.md |

O pipeline de memoria: a cada 20 mensagens, agente extrai fatos em MEMORY.md. Arquivos `.md` sao chunked, embedded e indexados em SQLite com sqlite-vec + FTS5. Busca hibrida: 0.7 vetor + 0.3 texto.

### Estado desejado

1. Tab Memoria no detalhe do agente com status, fatos e busca
2. Controles de sincronizacao e reset

## Especificacao

### Feature F-024: Status da memoria + MEMORY.md viewer

**Substituir placeholder** da tab "Memoria" em `agents.$id.tsx`.

Layout dividido em 3 secoes verticais.

**Secao 1 — Status:**

Criar `agentMemoryStatusQueryOptions(id)` em `api/agents.ts` → `GET /agents/:id/memory/status`.

| Metrica | Fonte | Visual |
|---------|-------|--------|
| Arquivos indexados | `status.fileCount` | Card numerico (shadcn Card) |
| Chunks na base | `status.chunkCount` | Card numerico |
| Ultima sincronizacao | timestamp | Texto relativo |

Grid de 2 cards lado a lado.

**Secao 2 — MEMORY.md (Fatos Aprendidos):**

- Fetch via `GET /agents/:id/files/MEMORY.md`
- Renderizar markdown via `react-markdown`
- Somente leitura (fatos sao extraidos automaticamente pelo agente)
- Se MEMORY.md vazio ou inexistente: `EmptyState` com mensagem "Nenhum fato aprendido ainda. O agente extrai fatos automaticamente a cada 20 mensagens de conversa."
- Card com titulo "Fatos Aprendidos" e borda sutil

**components/agents/memory-status-panel.tsx:**

```typescript
interface MemoryStatusPanelProps {
  agentId: string;
  status: MemoryStatus;
  onSync: () => void;
  onReset: () => void;
}
```

### Feature F-025: Busca semantica

**Secao 3 — Busca Semantica:**

**components/agents/memory-search-box.tsx:**

```typescript
interface MemorySearchBoxProps {
  agentId: string;
}
```

- Input de busca com placeholder "Pesquisar na memoria do agente..."
- Debounce de 500ms
- Ao buscar: `POST /agents/:id/memory/search` com `{ query, limit: 10 }`
- Loading state (Skeleton) durante busca
- Empty state: "Nenhum resultado encontrado"

**components/agents/memory-search-result.tsx:**

```typescript
interface MemorySearchResultItemProps {
  result: MemorySearchResult;
}
```

Cada resultado em lista vertical:

| Campo | Fonte | Visual |
|-------|-------|--------|
| Arquivo | `result.path` | Badge com nome do arquivo |
| Trecho | `result.snippet` | Texto (max 3 linhas, expandivel) |
| Score | `result.score` | Barra visual de relevancia (0-1) — div com width percentage e cor semantica |
| Fonte | `result.source` | Badge: "vetor" ou "texto" |

- Resultados ordenados por score (maior primeiro, ja vem ordenados da API)

### Feature F-026: Controles de sincronizacao e reset

**Acoes no painel de status (MemoryStatusPanel):**

**Botao "Sincronizar":**
- `POST /agents/:id/memory/sync`
- Loading state durante sincronizacao
- Sucesso: toast "Memoria sincronizada", invalida query `["agents", id, "memory", "status"]`
- Erro: toast de erro

**Botao "Limpar Memoria":**
- Acao destrutiva — `ConfirmDialog` com mensagem:
  - "Todos os fatos e chunks da memoria do agente serao removidos. O MEMORY.md sera mantido. Esta acao eh irreversivel."
- Confirmar: `POST /agents/:id/memory/reset`
- Sucesso: invalida queries de memoria, toast "Memoria resetada"
- Visual: botao com variante `destructive`

## Limites

- **NAO** permitir edicao do MEMORY.md via Hub — fatos sao geridos automaticamente pelo agente.
- **NAO** implementar visualizacao de chunks individuais — complexidade tecnica sem valor para usuario final.
- **NAO** implementar comparacao entre versoes do MEMORY.md.
- **NAO** criar APIs novas no backbone — todas existem.

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado.
- **PRP-02** (Dashboard de Agentes) deve estar implementado — tab Memoria vive na pagina de detalhe do agente.
- **Variavel de ambiente** `OPENAI_API_KEY` deve estar configurada para embeddings funcionarem.

## Validacao

- [ ] Tab Memoria exibe contagem de arquivos e chunks indexados
- [ ] MEMORY.md renderiza em markdown com fatos aprendidos
- [ ] MEMORY.md vazio exibe empty state orientativo
- [ ] Busca semantica retorna resultados relevantes com score
- [ ] Resultados mostram snippet, arquivo fonte e barra de score
- [ ] Debounce de 500ms evita requests excessivos
- [ ] Botao Sincronizar reindexar base e atualiza contagem
- [ ] Botao Limpar Memoria pede confirmacao e reseta
- [ ] Loading states exibidos durante operacoes async
- [ ] Layout responsivo
- [ ] `npm run build:hub` compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-024 Status + MEMORY.md | S-006 sec 3.1 | D-008, D-013, G-006 |
| F-025 Busca semantica | S-006 sec 3.1 | G-006 (memoria acessivel via UI) |
| F-026 Sync/Reset | S-006 sec 3.1 | G-007 (independencia tecnica) |
