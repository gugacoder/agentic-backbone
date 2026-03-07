# AB Hub - Gestao de Agentes

Interface visual para criar, editar e configurar agentes sem tocar em codigo, YAML ou terminal.

---

## 1. Objetivo

- CRUD de agentes via formularios visuais
- Editor markdown para SOUL.md, CONVERSATION.md, HEARTBEAT.md
- Configuracao de heartbeat (intervalo, active hours) sem cron expressions
- Gestao de skills e tools atribuidos ao agente
- Resolver D-002 (complexidade tecnica), G-007 (independencia tecnica), G-004 (personalizacao), D-010 (dependencia de consultores)

---

## 2. API Endpoints Existentes

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

---

## 3. Telas

### 3.1 Criar Agente

**Rota:** `/agents/new` (ou dialog/drawer sobre `/agents`)

**Formulario:**

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| Nome (slug) | Input texto | Sim | Identificador unico (kebab-case) |
| Owner | Select | Sim | `system` ou user slug |
| Descricao | Textarea | Nao | Descricao breve do agente |
| Enabled | Switch | Nao (default: true) | Ativar imediatamente |

- Validacao: slug formato kebab-case, unico
- Apos criar: redireciona para `/agents/:id` tab Configuracao

### 3.2 Configuracao do Agente (`/agents/:id` tab Configuracao)

**Sub-tabs verticais:**

| Sub-tab | Conteudo |
|---------|----------|
| Identidade | Editor de SOUL.md (personalidade, tom, instrucoes) |
| Conversa | Editor de CONVERSATION.md (instrucoes de conversa) |
| Heartbeat | Editor de HEARTBEAT.md + config de intervalo e active hours |
| Skills | Lista de skills com assign/unassign |
| Tools | Lista de tools com assign/unassign |
| Avancado | JSON metadata, delivery, acoes perigosas (duplicar, excluir) |

### 3.3 Editor de Markdown

**Componente:** `MarkdownEditor`

```typescript
interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}
```

- Textarea com syntax highlighting basico (markdown)
- Preview lado a lado (toggle)
- Auto-save com debounce de 2s (PUT `/agents/:id/files/*`)
- Indicador de "salvo" / "salvando..." / "erro ao salvar"

### 3.4 Configuracao de Heartbeat

**Campos visuais (nao YAML):**

| Campo | Tipo | Descricao |
|-------|------|-----------|
| Heartbeat ativo | Switch | `heartbeat.enabled` |
| Intervalo | Slider + input numerico | Em segundos (min 10, max 3600) |
| Horario ativo (inicio) | Time picker | Hora inicio de operacao |
| Horario ativo (fim) | Time picker | Hora fim de operacao |
| Dias da semana | Checkbox group | Seg-Dom |

- Preview: "O agente operara de segunda a sexta, das 08:00 as 18:00, com heartbeat a cada 30 segundos"

### 3.5 Skills e Tools

**Layout:** Lista de items disponiveis com toggle de atribuicao.

| Coluna | Descricao |
|--------|-----------|
| Nome | Slug da skill/tool |
| Escopo | shared / system / agent |
| Status | Atribuido (toggle) |
| Descricao | Extraida do frontmatter |

- Toggle atribui/remove via `POST /skills/assign` (ou equivalente para tools)
- Agrupamento por escopo

---

## 4. Componentes

### 4.1 AgentForm

**Localizacao:** `components/agents/agent-form.tsx`

```typescript
interface AgentFormProps {
  agent?: Agent;           // undefined = criacao
  onSuccess: () => void;
}
```

### 4.2 MarkdownEditor

**Localizacao:** `components/shared/markdown-editor.tsx`

- Reutilizado em SOUL.md, CONVERSATION.md, HEARTBEAT.md
- CodeMirror ou textarea simples com preview markdown (react-markdown)

### 4.3 HeartbeatConfig

**Localizacao:** `components/agents/heartbeat-config.tsx`

```typescript
interface HeartbeatConfigProps {
  agentId: string;
  config: { enabled: boolean; intervalMs: number };
  onSave: (config: HeartbeatConfigUpdate) => void;
}
```

### 4.4 ResourceAssigner

**Localizacao:** `components/shared/resource-assigner.tsx`

```typescript
interface ResourceAssignerProps {
  available: Resource[];
  assigned: Resource[];
  onAssign: (slug: string) => void;
  onUnassign: (slug: string) => void;
}
```

---

## 5. Criterios de Aceite

- [ ] Formulario de criacao cria agente no backbone e redireciona para detalhe
- [ ] Edicao de SOUL.md salva automaticamente com feedback visual
- [ ] Preview de markdown renderiza corretamente
- [ ] Configuracao de heartbeat atualiza intervalo e active hours sem YAML
- [ ] Skills podem ser atribuidas/removidas com toggle
- [ ] Duplicacao de agente funciona e redireciona para novo agente
- [ ] Exclusao de agente pede confirmacao e redireciona para lista
- [ ] Validacao de slug impede duplicatas e caracteres invalidos
- [ ] Formularios funcionam em mobile (responsivo)

---

## 6. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| AgentForm | D-002, G-007, D-010 |
| MarkdownEditor | G-004 (personalizacao SOUL.md) |
| HeartbeatConfig | D-011 (active hours), G-002 (heartbeat) |
| ResourceAssigner | G-007 (independencia tecnica) |
