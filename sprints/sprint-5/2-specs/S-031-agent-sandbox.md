# S-031 — Agent Sandbox (Rascunho Isolado e Comparacao)

Sistema de sandbox por agente: clonar agente como rascunho isolado, testar via chat sem afetar producao, comparar respostas rascunho vs. producao side-by-side e publicar com versao registrada.

**Resolve:** D-045 (mudancas direto em producao sem sandbox), G-046 (agent sandbox)
**Score de prioridade:** 7

---

## 1. Objetivo

- Criar "rascunhos" de agente (draft) como copia isolada do AGENT.md, SOUL.md, etc.
- Chat de teste no Hub executa o rascunho sem impactar o agente de producao
- View comparativa: resposta do rascunho vs. resposta do agente de producao para o mesmo input
- Publicar rascunho promove as mudancas para producao com registro de versao

---

## 2. Modelo de Rascunho

Um rascunho e armazenado em disco como copia do agente:

```
context/agents/{owner}.{slug}/
  AGENT.md            # producao
  SOUL.md             # producao
  drafts/
    {draftId}/
      AGENT.md        # rascunho (editavel)
      SOUL.md         # rascunho
      HEARTBEAT.md    # rascunho (se existir)
      CONVERSATION.md # rascunho (se existir)
      draft.json      # metadados do rascunho
```

### 2.1 `draft.json`

```json
{
  "id": "draft_abc123",
  "agentId": "system.main",
  "label": "Teste novo tom de voz",
  "createdAt": "2026-03-07T10:00:00Z",
  "updatedAt": "2026-03-07T12:00:00Z",
  "basedOnVersion": "v1.3",
  "status": "draft"
}
```

---

## 3. Schema DB

Nenhuma tabela nova necessaria. Estado de rascunhos gerenciado pelo filesystem (`drafts/`). Versoes de producao registradas via Config Versioning (S-032).

---

## 4. API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:agentId/drafts` | Listar rascunhos do agente |
| POST | `/agents/:agentId/drafts` | Criar rascunho (clona producao atual) |
| GET | `/agents/:agentId/drafts/:draftId` | Obter metadados + conteudo de um rascunho |
| PATCH | `/agents/:agentId/drafts/:draftId` | Atualizar arquivo de rascunho (SOUL.md, etc.) |
| DELETE | `/agents/:agentId/drafts/:draftId` | Descartar rascunho |
| POST | `/agents/:agentId/drafts/:draftId/publish` | Publicar rascunho → producao |
| POST | `/agents/:agentId/drafts/:draftId/chat` | Executar chat contra rascunho (SSE) |
| POST | `/agents/:agentId/drafts/:draftId/compare` | Executar mesmo input em prod e rascunho |

### 4.1 POST `/agents/:agentId/drafts` — Criar rascunho

**Request:**
```json
{ "label": "Teste novo tom de voz" }
```

**Response 201:**
```json
{
  "id": "draft_abc123",
  "agentId": "system.main",
  "label": "Teste novo tom de voz",
  "createdAt": "2026-03-07T10:00:00Z",
  "files": ["AGENT.md", "SOUL.md", "CONVERSATION.md"]
}
```

### 4.2 POST `/agents/:agentId/drafts/:draftId/chat` — Chat com rascunho

Mesmo protocolo do `/conversations/:id/stream` — retorna SSE de `AgentEvent`.
Executa `runAgent()` com contexto montado a partir dos arquivos do rascunho em vez de producao.

### 4.3 POST `/agents/:agentId/drafts/:draftId/compare` — Comparar respostas

**Request:**
```json
{ "input": "Ola, preciso de ajuda com meu pedido" }
```

**Response:**
```json
{
  "input": "Ola, preciso de ajuda com meu pedido",
  "production": {
    "agentId": "system.main",
    "response": "Ola! Fico feliz em ajudar. Qual e o numero do seu pedido?"
  },
  "draft": {
    "draftId": "draft_abc123",
    "response": "Oi! Claro, me passa o numero do pedido que te ajudo rapidinho!"
  }
}
```

### 4.4 POST `/agents/:agentId/drafts/:draftId/publish`

- Copia arquivos do rascunho para producao (SOUL.md, AGENT.md, etc.)
- Registra versao via Config Versioning (S-032) antes de sobrescrever
- Remove diretorio do rascunho
- Recarrega agente no registry (hot reload via watcher ja existente)

**Response 200:** `{ "publishedAt": "2026-03-07T13:00:00Z", "versionId": "v1.4" }`

---

## 5. Telas (Hub)

### 5.1 `/agents/:id` — Aba "Sandbox"

- Lista de rascunhos: Label, Criado em, Status
- Botao "Criar rascunho"
- Por rascunho: botoes "Editar", "Testar", "Comparar", "Publicar", "Descartar"

### 5.2 `/agents/:id/drafts/:draftId` — Editor de Rascunho

- Editor de texto (textarea ou CodeMirror) por arquivo: SOUL.md, AGENT.md, CONVERSATION.md
- Tabs por arquivo
- Botao "Salvar" (PATCH do arquivo)
- Botao "Testar no chat" (abre painel lateral de chat)
- Botao "Publicar" (com confirmacao: "Isso sobrescreve a producao")

### 5.3 `/agents/:id/drafts/:draftId/compare` — Comparacao Side-by-Side

- Campo de input para mensagem de teste
- Botao "Executar comparacao"
- Layout 2 colunas: "Producao" | "Rascunho"
- Cada coluna exibe a resposta completa do agente
- Diferenca de tom, palavras e estrutura destacada visualmente (diff de texto)

---

## 6. Criterios de Aceite

- [ ] Criar rascunho clona todos os arquivos markdown do agente para `drafts/{draftId}/`
- [ ] Chat com rascunho executa agente com contexto do rascunho sem afetar sessoes de producao
- [ ] Comparacao retorna respostas de producao e rascunho para o mesmo input
- [ ] Publicar rascunho sobrescreve producao e registra versao (S-032)
- [ ] Publicar rascunho dispara hot reload do agente (watcher ja existente)
- [ ] Descartar rascunho remove diretorio `drafts/{draftId}/` do filesystem
- [ ] Multiplos rascunhos podem coexistir para o mesmo agente
- [ ] Editor no Hub exibe e salva conteudo de SOUL.md e AGENT.md do rascunho
