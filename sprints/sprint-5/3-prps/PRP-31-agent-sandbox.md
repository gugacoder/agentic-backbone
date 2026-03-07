# PRP-31 — Agent Sandbox (Rascunho Isolado e Comparacao)

Sistema de sandbox por agente: clonar agente como rascunho isolado, testar via chat sem afetar producao, comparar respostas rascunho vs. producao side-by-side e publicar com versao registrada.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Qualquer alteracao em SOUL.md ou AGENT.md e aplicada imediatamente a producao. Nao ha forma de testar mudancas de prompt antes de publicar. O filesystem de agentes nao possui conceito de rascunho (`drafts/`).

### Estado desejado

1. Diretorio `drafts/{draftId}/` por agente com metadados em `draft.json`
2. Endpoints de CRUD, chat e compare de rascunhos
3. Publicacao promove rascunho para producao com registro de versao (S-032)
4. Aba "Sandbox" na pagina do agente com editor de arquivos e chat de teste

## Especificacao

### Feature F-120: Endpoints de rascunhos + modelo de filesystem

**Modelo de rascunho em disco:**

```
context/agents/{owner}.{slug}/
  AGENT.md
  SOUL.md
  drafts/
    {draftId}/
      AGENT.md
      SOUL.md
      HEARTBEAT.md    (se existir no agente)
      CONVERSATION.md (se existir no agente)
      draft.json
```

**`draft.json`:**
```json
{
  "id": "draft_abc123",
  "agentId": "system.main",
  "label": "Teste novo tom de voz",
  "createdAt": "2026-03-07T10:00:00Z",
  "updatedAt": "2026-03-07T12:00:00Z",
  "status": "draft"
}
```

**Novas rotas em `apps/backbone/src/routes/drafts.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:agentId/drafts` | Listar rascunhos do agente |
| POST | `/agents/:agentId/drafts` | Criar rascunho (clona arquivos de producao) |
| GET | `/agents/:agentId/drafts/:draftId` | Metadados + conteudo dos arquivos |
| PATCH | `/agents/:agentId/drafts/:draftId` | Atualizar arquivo (SOUL.md, etc.) |
| DELETE | `/agents/:agentId/drafts/:draftId` | Descartar rascunho (rm -rf drafts/{draftId}/) |
| POST | `/agents/:agentId/drafts/:draftId/publish` | Publicar rascunho → producao |
| POST | `/agents/:agentId/drafts/:draftId/chat` | Chat contra rascunho (SSE) |
| POST | `/agents/:agentId/drafts/:draftId/compare` | Executar mesmo input em prod e rascunho |

**Detalhes de endpoints:**

`POST /drafts` — cria `draftId` (uuid), copia todos os .md do agente para `drafts/{draftId}/`, cria `draft.json`.

`PATCH /drafts/:draftId` — body: `{ fileName: "SOUL.md", content: "..." }`. Salva arquivo e atualiza `draft.json.updatedAt`.

`POST /drafts/:draftId/chat` — retorna SSE de `AgentEvent`; executa `runAgent()` com contexto montado a partir de `drafts/{draftId}/` em vez de producao. Nao persiste sessao em `backbone.sqlite`.

`POST /drafts/:draftId/compare` — executa `runAgent()` em paralelo (producao e rascunho) para o mesmo `input`; retorna JSON com as duas respostas.

`POST /drafts/:draftId/publish`:
1. Chama Config Versioning (S-032/F-123) para criar versao da situacao atual antes de sobrescrever
2. Copia arquivos do rascunho para producao
3. Remove diretorio `drafts/{draftId}/`
4. Dispara hot reload do agente (watcher existente ja escuta mudancas em AGENT.md)
5. Retorna `{ publishedAt, versionId }`

Montar rotas no `index.ts` do backbone.

**Hub — `apps/hub/src/api/drafts.ts`:**

```typescript
export const draftsQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["drafts", agentId],
    queryFn: () => request<Draft[]>(`/agents/${agentId}/drafts`),
  });
```

### Feature F-121: Telas Hub — aba Sandbox e editor de rascunho

**Nova aba "Sandbox"** na pagina do agente (`/agents/:id`) com rota `routes/_authenticated/agents/$agentId/sandbox.tsx`.

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `SandboxTab` | `routes/_authenticated/agents/$agentId/sandbox.tsx` |
| `DraftCard` | `components/sandbox/draft-card.tsx` |
| `DraftEditor` | `routes/_authenticated/agents/$agentId/drafts/$draftId/index.tsx` |
| `DraftChatPanel` | `components/sandbox/draft-chat-panel.tsx` |

**SandboxTab:**
- Lista de rascunhos: Label, Criado em, Ultima atualizacao
- Botao "Criar rascunho" (input de label)
- Por rascunho: botoes "Editar", "Comparar", "Publicar" (com confirmacao), "Descartar"

**DraftEditor** (`/agents/:id/drafts/:draftId`):
- Tabs por arquivo: SOUL.md, AGENT.md, HEARTBEAT.md, CONVERSATION.md (apenas os que existem)
- Textarea editavel para cada arquivo
- Botao "Salvar" (PATCH)
- Botao "Testar no chat" (abre DraftChatPanel como painel lateral)
- Botao "Publicar" com dialog de confirmacao: "Isso sobrescreve a producao. O estado atual sera salvo como nova versao."

**DraftChatPanel:** interface de chat simplificada (input + stream SSE); usa endpoint `/drafts/:draftId/chat`.

### Feature F-122: View de comparacao side-by-side

**Nova rota** `routes/_authenticated/agents/$agentId/drafts/$draftId/compare.tsx`.

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `DraftCompareView` | `routes/_authenticated/agents/$agentId/drafts/$draftId/compare.tsx` |

**Layout:**
- Campo de input para mensagem de teste
- Botao "Executar comparacao"
- Layout 2 colunas: "Producao" | "Rascunho {label}"
- Cada coluna exibe resposta completa do agente
- Diferenca destacada visualmente: tokens diferentes entre as duas respostas marcados em amarelo (diff de palavras simples)

## Limites

- **NAO** implementar versionamento de rascunhos (rascunho e editavel livremente, versoes so existem em producao via S-032)
- **NAO** implementar execucao de heartbeat em rascunho
- **NAO** implementar colaboracao (apenas um operador edita o rascunho por vez)

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado
- **PRP-03** (Gestao de Agentes) deve estar implementado — nova aba adicionada
- **PRP-32** (Config Versioning) deve estar implementado — publicar rascunho usa versioning

## Validacao

- [ ] Criar rascunho clona todos os arquivos .md do agente para `drafts/{draftId}/`
- [ ] Chat com rascunho executa com contexto do rascunho sem afetar sessoes de producao
- [ ] Comparacao retorna respostas de producao e rascunho para o mesmo input
- [ ] Publicar rascunho sobrescreve producao e registra versao (PRP-32)
- [ ] Publicar rascunho dispara hot reload do agente
- [ ] Descartar rascunho remove diretorio `drafts/{draftId}/` do filesystem
- [ ] Multiplos rascunhos coexistem para o mesmo agente
- [ ] Editor no Hub exibe e salva conteudo de SOUL.md e AGENT.md do rascunho
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-120 Endpoints de rascunhos + filesystem | S-031 sec 2, 4 | D-045 |
| F-121 Telas Hub aba Sandbox + editor | S-031 sec 5.1-5.2 | G-046 |
| F-122 View comparacao side-by-side | S-031 sec 5.3 | G-046 |
