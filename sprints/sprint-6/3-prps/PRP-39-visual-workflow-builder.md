# PRP-39 — Visual Workflow Builder

Canvas drag-and-drop para orquestracao multi-agent: nos sao agentes, arestas sao condicoes de handoff. Gera frontmatter YAML automaticamente. Democratiza orquestracao para operadores nao-tecnicos.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Orquestracao multi-agent ja existe (Sprint 5) via frontmatter `handoff` no `AGENT.md`. Porem, a configuracao exige edicao manual de YAML, o que e inacessivel para operadores nao-tecnicos. Nao ha representacao visual dos fluxos.

### Estado desejado

1. API backend para CRUD de workflows + operacoes `apply` e `simulate`
2. Canvas visual React Flow no Hub: arrastar agentes, conectar com arestas condicionais
3. Ao "Aplicar ao vivo": gera/atualiza frontmatter `handoff` nos AGENT.md dos agentes participantes
4. Painel de simulacao: testar roteamento com input de texto e ver caminho percorrido

## Especificacao

### Feature F-136: API Backend — CRUD de Workflows + Apply + Simulate

**Persistencia:** arquivos JSON em `context/agents/{owner}.{slug}/workflows/{workflowId}.json`

**Formato `workflow.json`:**

```json
{
  "id": "fluxo-suporte-vendas",
  "label": "Suporte → Vendas → Escalamento",
  "version": 2,
  "createdAt": "2026-03-07T10:00:00Z",
  "updatedAt": "2026-03-07T15:00:00Z",
  "nodes": [
    { "id": "node-1", "agentId": "system.atendimento", "label": "Atendimento", "position": { "x": 100, "y": 200 }, "isEntry": true },
    { "id": "node-2", "agentId": "system.vendas", "label": "Vendas", "position": { "x": 400, "y": 100 } }
  ],
  "edges": [
    {
      "id": "edge-1",
      "from": "node-1",
      "to": "node-2",
      "condition": { "type": "intent", "value": "compra|produto|preco" },
      "label": "Interesse em compra"
    },
    {
      "id": "edge-2",
      "from": "node-1",
      "to": "node-2",
      "condition": { "type": "fallback" },
      "label": "Padrao"
    }
  ]
}
```

**Tipos de condicao de aresta:**

| Tipo | Configuracao | Descricao |
|------|-------------|-----------|
| `keyword` | `value: string` (regex) | Match de palavra-chave no input do usuario |
| `intent` | `value: string` (lista ORed) | Intencao detectada por heuristica regex |
| `sentiment` | `value: "positive"|"negative"|"neutral"` | Sentimento estimado |
| `schedule` | `value: "HH:MM-HH:MM"`, `days: string[]` | Horario e dias da semana |
| `channel` | `value: string` | Canal de origem (`whatsapp`, `hub`, etc.) |
| `fallback` | — | Rota padrao se nenhuma outra passar |

**Endpoints:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/workflows` | Listar workflows |
| POST | `/workflows` | Criar workflow |
| GET | `/workflows/:id` | Obter workflow |
| PUT | `/workflows/:id` | Atualizar workflow (nos + arestas) |
| DELETE | `/workflows/:id` | Deletar workflow |
| POST | `/workflows/:id/apply` | Aplicar — gera frontmatter `handoff` nos agentes |
| POST | `/workflows/:id/simulate` | Simular roteamento com input de texto |

**POST `/workflows/:id/apply` — exemplo de frontmatter gerado no AGENT.md do no-raiz:**

```yaml
handoff:
  - target: "system.vendas"
    condition: "compra|produto|preco"
    label: "Interesse em compra"
  - target: "system.vendas"
    condition: ".*"
    label: "Padrao"
```

**Response:**

```json
{ "applied": true, "agentsUpdated": ["system.atendimento", "system.vendas"], "warnings": [] }
```

**POST `/workflows/:id/simulate`:**

```json
// Request
{ "input": "Quero saber o preco do produto premium", "startNodeId": "node-1", "channelType": "whatsapp" }

// Response
{
  "path": ["node-1", "node-2"],
  "matchedEdge": "edge-1",
  "matchedCondition": { "type": "intent", "value": "compra|produto|preco" },
  "selectedAgent": "system.vendas",
  "reasoning": "Input contem 'preco' e 'produto' — condicao 'intent' satisfeita"
}
```

### Feature F-137: Hub — Canvas React Flow + Editor de Condicoes

**Dependencia de pacote:**

```json
{ "@xyflow/react": "^12.0.0" }
```

**`/workflows` — Lista de Workflows:**

- Cards: nome, numero de agentes, ultima atualizacao, status ("Aplicado" / "Rascunho")
- Botao "Novo Workflow"
- Botao "Editar" por workflow → abre canvas

**`/workflows/:id` — Canvas Visual:**

Layout:
- Painel esquerdo: lista de agentes disponiveis (arrastar para o canvas)
- Canvas central: nos e arestas com zoom/pan
- Painel direito (contextual): editar no selecionado ou aresta selecionada

**No de agente:**
- Avatar/icone do agente
- Nome e label
- Badge "Entrada" no no marcado como `isEntry`
- Handles de conexao (source/target)
- Clique: abre painel de propriedades

**Aresta de handoff:**
- Label com descricao da condicao
- Cor por tipo: keyword=azul, intent=roxo, schedule=verde, channel=laranja, fallback=cinza
- Clique: abre painel de edicao de condicao

**Painel de edicao de aresta:**
- Select: tipo de condicao
- Campo dinamico baseado no tipo:
  - `keyword` / `intent`: input de texto (regex/lista)
  - `sentiment`: select (positivo/negativo/neutro)
  - `schedule`: time range picker + checkbox de dias
  - `channel`: multi-select de tipos de canal
- Campo: label da aresta
- Botao "Remover aresta"

**Toolbar do canvas:**
- Botao "Salvar rascunho" (PUT /workflows/:id)
- Botao "Aplicar ao vivo" (POST /workflows/:id/apply) com modal de confirmacao
- Botao "Simular" → painel lateral

### Feature F-138: Hub — Painel de Simulacao + Secao "Workflows" no Agente

**Painel de simulacao (lateral no canvas):**
- Input: texto de mensagem de teste
- Select: canal de origem
- Botao "Simular"
- Resultado: caminho percorrido (nos destacados no canvas), condicao que passou, agente selecionado
- Reasoning textual do match

**`/agents/:id` — Secao "Workflows":**
- Lista de workflows em que o agente participa
- Link para abrir o canvas de cada workflow
- Status: papel do agente (entrada / intermediario / destino)

## Limites

- **NAO** implementar loops no workflow (grafo direcional aciclico apenas)
- **NAO** implementar condicoes compostas (AND/OR entre multiplas condicoes na mesma aresta)
- **NAO** implementar versionamento de workflows

## Dependencias

- **PRP-01** (Scaffold Backbone + Hub) deve estar implementado
- **PRP-03** (Gestao de Agentes) deve estar implementado — nova secao na pagina do agente
- Multi-agent handoffs (Sprint 5) deve estar implementado — o `apply` gera frontmatter compativel

## Validacao

- [ ] Canvas permite arrastar agentes da lista para o canvas e criar nos
- [ ] Conectar dois nos cria aresta; clique na aresta abre painel de edicao de condicao
- [ ] Todos os tipos de condicao (keyword, intent, schedule, channel, fallback) sao configuráveis via UI sem editar JSON
- [ ] "Salvar rascunho" persiste `workflow.json` sem afetar os agentes
- [ ] "Aplicar ao vivo" gera/atualiza frontmatter `handoff` nos AGENT.md corretos
- [ ] Apos aplicar, agentes participantes roteiam handoffs conforme as arestas configuradas
- [ ] Simulacao retorna caminho correto e razao da condicao satisfeita
- [ ] No marcado como "Entrada" e visualmente distinto (badge)
- [ ] Arestas com tipo diferente tem cores distintas
- [ ] Canvas suporta zoom e pan com mouse/trackpad
- [ ] Multiplos workflows coexistem sem conflito (cada um tem seu arquivo JSON)
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-136 API backend workflows | S-039 sec 3 | D-058, G-058 |
| F-137 Hub canvas React Flow | S-039 sec 4.1-4.2 | G-058 |
| F-138 Hub simulacao + agente | S-039 sec 4.2-4.3 | G-058 |
