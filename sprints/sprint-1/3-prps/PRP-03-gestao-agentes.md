# PRP-03 — Gestao de Agentes

Interface visual para criar, editar e configurar agentes sem tocar em codigo, YAML ou terminal.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O Hub tem o dashboard de agentes (PRP-02) com lista, detalhe e tabs. A tab "Configuracao" existe como placeholder. O backbone expoe:

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/agents` | Criar agente |
| PATCH | `/agents/:id` | Atualizar agente |
| DELETE | `/agents/:id` | Remover agente |
| POST | `/agents/:id/duplicate` | Duplicar agente |
| GET | `/agents/:id/files` | Listar arquivos do agente |
| GET | `/agents/:id/files/*` | Ler arquivo especifico |
| PUT | `/agents/:id/files/*` | Salvar arquivo especifico |
| GET | `/agents/:id/skills` | Skills atribuidas |
| GET | `/skills` | Skills disponiveis |
| POST | `/skills/assign` | Atribuir skill ao agente |

### Estado desejado

1. Formulario de criacao de agente (`/agents/new`)
2. Tab Configuracao no detalhe do agente com sub-tabs verticais
3. Editor markdown para SOUL.md, CONVERSATION.md, HEARTBEAT.md com auto-save
4. Configuracao visual de heartbeat (intervalo, active hours)
5. Gestao de skills e tools com toggle

## Especificacao

### Feature F-011: Formulario de criacao de agente

**routes/_authenticated/agents.new.tsx:**

- Formulario com campos:

| Campo | Tipo | Obrigatorio | Validacao |
|-------|------|-------------|-----------|
| Nome (slug) | Input texto | Sim | kebab-case, unico |
| Owner | Select | Sim | `system` ou user slug |
| Descricao | Textarea | Nao | — |
| Enabled | Switch | Nao (default: true) | — |

- Submit: `POST /agents` com payload
- Sucesso: invalida query `["agents"]`, navega para `/agents/:id?tab=config`
- Erro: feedback inline (slug duplicado, etc.)
- Botao cancelar: volta para `/agents`

**components/agents/agent-form.tsx:**

```typescript
interface AgentFormProps {
  agent?: Agent;        // undefined = criacao
  onSuccess: () => void;
}
```

### Feature F-012: Editor markdown + sub-tabs de configuracao

**Substituir placeholder** da tab Configuracao em `agents.$id.tsx`:

Sub-tabs verticais (layout com sidebar interna):

| Sub-tab | Arquivo | Descricao |
|---------|---------|-----------|
| Identidade | `SOUL.md` | Personalidade, tom, instrucoes do agente |
| Conversa | `CONVERSATION.md` | Instrucoes especificas para modo conversa |
| Heartbeat | `HEARTBEAT.md` | Instrucoes para modo autonomo |

- Sub-tab ativa controlada por search param `?tab=config&subtab=identity`
- Default: `identity`

**components/shared/markdown-editor.tsx:**

```typescript
interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}
```

- Textarea com font monospace
- Toggle para preview lado a lado (react-markdown)
- Auto-save com debounce de 2s → `PUT /agents/:id/files/{filename}`
- Indicador de estado: "Salvo", "Salvando...", "Erro ao salvar"
- Fetch conteudo inicial via `GET /agents/:id/files/{filename}`

### Feature F-013: Configuracao visual de heartbeat

**components/agents/heartbeat-config.tsx:**

```typescript
interface HeartbeatConfigProps {
  agentId: string;
}
```

Renderizado abaixo do editor de HEARTBEAT.md na sub-tab Heartbeat.

**Campos visuais:**

| Campo | Tipo shadcn | Descricao | Mapeamento |
|-------|-------------|-----------|------------|
| Heartbeat ativo | Switch | Liga/desliga heartbeat | `heartbeat.enabled` |
| Intervalo | Slider + Input numerico | Em segundos (min 10, max 3600) | `heartbeat.intervalMs` (converter) |
| Horario inicio | Input time (HH:MM) | Inicio do horario ativo | `heartbeat.activeHours.start` |
| Horario fim | Input time (HH:MM) | Fim do horario ativo | `heartbeat.activeHours.end` |
| Dias da semana | Checkbox group | Seg-Dom | `heartbeat.activeHours.days` |

- Fetch config via `GET /agents/:id/heartbeat`
- Save via `PATCH /agents/:id` (ou endpoint especifico se existir)
- Preview legivel: "O agente operara de segunda a sexta, das 08:00 as 18:00, com heartbeat a cada 30 segundos"
- Botao "Salvar" (nao auto-save — config de heartbeat eh critica)

### Feature F-014: Gestao de skills e tools

**Sub-tabs adicionais na Configuracao:**

| Sub-tab | Descricao |
|---------|-----------|
| Skills | Skills disponiveis e atribuidas |
| Tools | Tools disponiveis e atribuidos |

**components/shared/resource-assigner.tsx:**

```typescript
interface ResourceAssignerProps {
  available: Resource[];
  assigned: Resource[];
  onAssign: (slug: string) => void;
  onUnassign: (slug: string) => void;
}
```

- Lista de items com toggle (Switch) para atribuir/remover
- Agrupamento visual por escopo (shared / system / agent)
- Cada item mostra: nome (slug), descricao (do frontmatter), escopo (badge)
- Fetch skills: `GET /skills` (disponiveis) + `GET /agents/:id/skills` (atribuidas)
- Assign: `POST /skills/assign` com `{ agentId, skillSlug }`
- Unassign: equivalente endpoint

### Feature F-015: Acoes avancadas (duplicar, excluir)

**Sub-tab "Avancado" na Configuracao:**

- Secao "Zona Perigosa" (estilo visual de alerta)
- Botao "Duplicar Agente":
  - `POST /agents/:id/duplicate`
  - Sucesso: invalida `["agents"]`, navega para novo agente
- Botao "Excluir Agente":
  - `ConfirmDialog` com mensagem "Esta acao eh irreversivel. O agente e todos os seus dados serao removidos."
  - Confirmar: `DELETE /agents/:id`
  - Sucesso: invalida `["agents"]`, navega para `/agents`
  - Input de confirmacao: digitar o slug do agente para habilitar botao

## Limites

- **NAO** criar APIs novas no backbone — usar as existentes.
- **NAO** implementar editor de codigo avancado (CodeMirror, Monaco). Usar textarea simples com font monospace. Se o usuario quiser CodeMirror, sera PRP futuro.
- **NAO** implementar drag-and-drop para reordenar skills/tools.
- **NAO** editar frontmatter do AGENT.md via UI — apenas os campos visuais mapeados.
- **NAO** implementar undo/redo no editor markdown.

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado.
- **PRP-02** (Dashboard de Agentes) deve estar implementado — tab Configuracao e sub-tabs vivem na pagina de detalhe do agente.

## Validacao

- [ ] Formulario de criacao em `/agents/new` cria agente no backbone e redireciona para detalhe
- [ ] Slug invalido (nao kebab-case) mostra erro de validacao
- [ ] Edicao de SOUL.md salva automaticamente apos 2s com feedback visual
- [ ] Preview de markdown renderiza headers, listas, codigo, links
- [ ] Configuracao de heartbeat exibe campos visuais e preview legivel
- [ ] Alterar intervalo e salvar atualiza config no backbone
- [ ] Skills podem ser atribuidas/removidas com toggle
- [ ] Duplicacao cria novo agente e redireciona
- [ ] Exclusao pede confirmacao com digitacao do slug e redireciona para lista
- [ ] Sub-tab ativa persiste na URL (`?tab=config&subtab=identity`)
- [ ] Formularios funcionam em mobile (responsivo)
- [ ] `npm run build:hub` compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-011 Criacao | S-003 sec 3.1 | D-002, G-007, D-010 |
| F-012 Markdown editor | S-003 sec 3.3 | G-004 (personalizacao SOUL.md) |
| F-013 Heartbeat config | S-003 sec 3.4 | D-011, G-002, G-013 |
| F-014 Skills/Tools | S-003 sec 3.5 | G-007 (independencia tecnica) |
| F-015 Avancado | S-003 sec 3.2 | D-002 |
