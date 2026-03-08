# S-039 — Visual Workflow Builder

Canvas drag-and-drop para orquestração multi-agent: nós são agentes, arestas são condições de handoff. Gera frontmatter YAML automaticamente. Democratiza orquestração para P1 (não-técnicos).

**Resolve:** D-058 (orquestração só via YAML), G-058 (visual workflow builder)
**Score de prioridade:** 8

---

## 1. Objetivo

- Canvas visual onde o operador desenha fluxos entre agentes: arrastar agentes como nós, conectar com arestas condicionais
- Cada aresta representa uma condição de handoff (intenção detectada, palavra-chave, horário, fallback)
- Ao salvar, o builder gera automaticamente os blocos `handoff` no frontmatter YAML de cada agente
- Preview do fluxo: simular roteamento com input de texto e ver qual agente seria acionado
- Compatível com a implementação de multi-agent handoffs já existente (Sprint 5)

---

## 2. Sem Schema DB Adicional

Workflows são persistidos como arquivos JSON no contexto do agente-raiz:
`context/agents/{owner}.{slug}/workflows/{workflowId}.json`

E como frontmatter no `AGENT.md` de cada agente participante (gerado automaticamente pelo builder).

### 2.1 Formato `workflow.json`

```json
{
  "id": "fluxo-suporte-vendas",
  "label": "Suporte → Vendas → Escalamento",
  "version": 2,
  "createdAt": "2026-03-07T10:00:00Z",
  "updatedAt": "2026-03-07T15:00:00Z",
  "nodes": [
    {
      "id": "node-1",
      "agentId": "system.atendimento",
      "label": "Atendimento",
      "position": { "x": 100, "y": 200 },
      "isEntry": true
    },
    {
      "id": "node-2",
      "agentId": "system.vendas",
      "label": "Vendas",
      "position": { "x": 400, "y": 100 }
    },
    {
      "id": "node-3",
      "agentId": "system.escalamento",
      "label": "Escalamento",
      "position": { "x": 400, "y": 300 }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "from": "node-1",
      "to": "node-2",
      "condition": {
        "type": "intent",
        "value": "compra|produto|preco|oferta"
      },
      "label": "Interesse em compra"
    },
    {
      "id": "edge-2",
      "from": "node-1",
      "to": "node-3",
      "condition": {
        "type": "keyword",
        "value": "gerente|responsável|reclamação formal"
      },
      "label": "Escalamento"
    },
    {
      "id": "edge-3",
      "from": "node-1",
      "to": "node-2",
      "condition": {
        "type": "fallback"
      },
      "label": "Padrão"
    }
  ]
}
```

### 2.2 Tipos de condição de aresta

| Tipo | Configuração | Descrição |
|------|-------------|-----------|
| `keyword` | `value: string` (regex) | Match de palavra-chave no input do usuário |
| `intent` | `value: string` (lista ORed) | Intenção detectada (heurística via regex) |
| `sentiment` | `value: "positive"|"negative"|"neutral"` | Sentimento estimado da mensagem |
| `schedule` | `value: "HH:MM-HH:MM"`, `days: string[]` | Horário e dias da semana |
| `channel` | `value: string` (channelType) | Canal de origem (whatsapp, hub, etc.) |
| `fallback` | — | Sem condição — rota padrão se nenhuma outra passar |

---

## 3. API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/workflows` | Listar workflows |
| POST | `/workflows` | Criar workflow |
| GET | `/workflows/:id` | Obter workflow |
| PUT | `/workflows/:id` | Atualizar workflow (nós + arestas) |
| DELETE | `/workflows/:id` | Deletar workflow |
| POST | `/workflows/:id/apply` | Aplicar workflow — gera frontmatter nos agentes participantes |
| POST | `/workflows/:id/simulate` | Simular roteamento com input de texto |

### 3.1 POST `/workflows/:id/apply`

Gera ou atualiza a seção `handoff` no frontmatter de cada agente nó do workflow.

**Exemplo de frontmatter gerado em `AGENT.md` do agente-atendimento:**

```yaml
handoff:
  - target: "system.vendas"
    condition: "compra|produto|preco|oferta"
    label: "Interesse em compra"
  - target: "system.escalamento"
    condition: "gerente|responsável|reclamação formal"
    label: "Escalamento"
  - target: "system.vendas"
    condition: ".*"
    label: "Padrão"
```

**Response:**
```json
{
  "applied": true,
  "agentsUpdated": ["system.atendimento", "system.vendas", "system.escalamento"],
  "warnings": []
}
```

### 3.2 POST `/workflows/:id/simulate`

**Request:**
```json
{
  "input": "Quero saber o preço do produto premium",
  "startNodeId": "node-1",
  "channelType": "whatsapp"
}
```

**Response:**
```json
{
  "path": ["node-1", "node-2"],
  "matchedEdge": "edge-1",
  "matchedCondition": { "type": "intent", "value": "compra|produto|preco|oferta" },
  "selectedAgent": "system.vendas",
  "reasoning": "Input contém 'preço' e 'produto' — condição 'intent' satisfeita"
}
```

---

## 4. Telas (Hub)

### 4.1 `/workflows` — Lista de Workflows

- Cards: nome do workflow, número de agentes, última atualização, status ("Aplicado" / "Rascunho")
- Botão "Novo Workflow"
- Botão "Editar" por workflow → abre canvas

### 4.2 `/workflows/:id` — Canvas Visual

**Biblioteca:** React Flow (`@xyflow/react`) — já usada no ecossistema React, sem dependência de D3 ou canvas nativo.

**Layout do canvas:**
- Painel esquerdo: lista de agentes disponíveis (arrastar para o canvas)
- Canvas central: nós e arestas com zoom/pan
- Painel direito (contextual): editar nó selecionado ou aresta selecionada

**Nó de agente:**
- Avatar/ícone do agente
- Nome e label
- Badge "Entrada" no nó marcado como `isEntry`
- Handles de conexão (source/target)
- Clique: abre painel de propriedades

**Aresta de handoff:**
- Label com descrição da condição
- Cor por tipo: keyword=azul, intent=roxo, schedule=verde, fallback=cinza
- Clique: abre painel de edição de condição

**Painel de edição de aresta:**
- Select: tipo de condição
- Campo dinâmico baseado no tipo:
  - keyword/intent: input de texto (regex)
  - sentiment: select (positivo/negativo/neutro)
  - schedule: time range picker + checkbox de dias
  - channel: multi-select de tipos de canal
- Campo: label da aresta
- Botão "Remover aresta"

**Toolbar do canvas:**
- Botão "Salvar rascunho" (PUT /workflows/:id)
- Botão "Aplicar ao vivo" (POST /workflows/:id/apply) com confirmação
- Botão "Simular" → painel lateral com input de texto e resultado

**Painel de simulação:**
- Input: texto de mensagem de teste
- Select: canal de origem
- Botão "Simular"
- Resultado: caminho percorrido (nós destacados no canvas), condição que passou, agente selecionado

### 4.3 `/agents/:id` — Seção "Workflows"

- Lista de workflows em que o agente participa
- Link para abrir o canvas de cada workflow
- Status: papel do agente no workflow (entrada / intermediário / destino)

---

## 5. Dependências

```json
{
  "@xyflow/react": "^12.0.0"
}
```

---

## 6. Critérios de Aceite

- [ ] Canvas permite arrastar agentes da lista para o canvas e criar nós
- [ ] Conectar dois nós cria aresta; clique na aresta abre painel de edição de condição
- [ ] Todos os tipos de condição (keyword, intent, schedule, channel, fallback) são configuráveis via UI sem editar JSON
- [ ] "Salvar rascunho" persiste `workflow.json` sem afetar os agentes
- [ ] "Aplicar ao vivo" gera/atualiza frontmatter `handoff` nos AGENT.md corretos
- [ ] Após aplicar, agentes participantes roteiam handoffs conforme as arestas configuradas (integração com multi-agent existente)
- [ ] Simulação retorna caminho correto e razão da condição satisfeita
- [ ] Nó marcado como "Entrada" é visualmente distinto
- [ ] Arestas com tipo diferente têm cores distintas
- [ ] Canvas suporta zoom e pan com mouse/trackpad
- [ ] Múltiplos workflows coexistem sem conflito (cada um tem seu arquivo JSON)
