# PRP-18 — Templates de Agente + Wizard de Onboarding

Galeria de templates pre-configurados para criacao rapida de agentes, com wizard de onboarding guiado em 3 steps.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O Hub tem gestao de agentes (PRP-03) com formulario de criacao. Porem, criar um agente exige preencher nome, descricao, e depois editar manualmente SOUL.md, CONVERSATION.md e HEARTBEAT.md — processo lento que exige conhecimento da plataforma. O backbone tem diretorio `context/.templates/` para templates, mas nao ha templates de agente nem endpoint para usa-los.

### Estado desejado

1. 5 templates de agente no filesystem (`context/.templates/agents/`)
2. Cada template com TEMPLATE.md (metadata), SOUL.md, CONVERSATION.md, HEARTBEAT.md pre-prontos
3. Endpoints para listar templates, ver detalhes e criar agente a partir de template
4. Galeria de templates em `/agents/new` com cards agrupados por categoria
5. Wizard de criacao em 3 steps: preview → personalizar → confirmar
6. Opcao "Criar do zero" na galeria

## Especificacao

### Feature F-071: Templates no filesystem (5 templates iniciais)

**Estrutura em `context/.templates/agents/`:**

```
context/.templates/agents/
  atendente/
    TEMPLATE.md
    SOUL.md
    CONVERSATION.md
    HEARTBEAT.md
  vendedor/
    TEMPLATE.md
    SOUL.md
    CONVERSATION.md
    HEARTBEAT.md
  suporte-tecnico/
    TEMPLATE.md
    SOUL.md
    CONVERSATION.md
    HEARTBEAT.md
  monitor-sistemas/
    TEMPLATE.md
    SOUL.md
    CONVERSATION.md
    HEARTBEAT.md
  assistente-pessoal/
    TEMPLATE.md
    SOUL.md
    CONVERSATION.md
    HEARTBEAT.md
```

**TEMPLATE.md** (metadata em frontmatter YAML):

```yaml
---
name: Atendente
description: Agente de atendimento ao cliente. Responde duvidas, resolve problemas simples e encaminha casos complexos.
icon: Headphones
category: atendimento
tags: [atendimento, cliente, suporte, chat]
suggested_skills: [web-search]
suggested_tools: []
heartbeat_enabled: false
active_hours: "08:00-18:00"
---
```

**5 templates iniciais:**

| Template | Slug | Categoria | Icon | Heartbeat |
|----------|------|-----------|------|-----------|
| Atendente | `atendente` | atendimento | Headphones | desabilitado |
| Vendedor | `vendedor` | vendas | ShoppingCart | desabilitado |
| Suporte Tecnico | `suporte-tecnico` | suporte | LifeBuoy | desabilitado |
| Monitor de Sistemas | `monitor-sistemas` | operacoes | Monitor | habilitado |
| Assistente Pessoal | `assistente-pessoal` | produtividade | User | desabilitado |

Cada SOUL.md pre-pronto com personalidade profissional em pt-BR adequada ao caso de uso.

### Feature F-072: Endpoints de templates + API module

**Novos endpoints em `routes/templates.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/templates/agents` | Listar templates disponiveis |
| GET | `/templates/agents/:slug` | Detalhes de um template (inclui preview dos markdowns) |
| POST | `/agents/from-template` | Criar agente a partir de template |

**GET `/templates/agents` response:**

```json
{
  "templates": [
    {
      "slug": "atendente",
      "name": "Atendente",
      "description": "Agente de atendimento ao cliente...",
      "icon": "Headphones",
      "category": "atendimento",
      "tags": ["atendimento", "cliente", "suporte", "chat"]
    }
  ]
}
```

**GET `/templates/agents/:slug` response:**

```json
{
  "slug": "atendente",
  "name": "Atendente",
  "description": "...",
  "icon": "Headphones",
  "category": "atendimento",
  "tags": [],
  "content": "## Quando usar\n...",
  "suggestedSkills": ["web-search"],
  "heartbeatEnabled": false,
  "activeHours": "08:00-18:00",
  "preview": {
    "soul": "Voce eh um atendente profissional...",
    "conversation": "Ao receber uma mensagem...",
    "heartbeat": ""
  }
}
```

**POST `/agents/from-template`:**

Payload: `{ template, owner, slug, name, description, enabled }`.

Logica:
1. Copiar SOUL.md, CONVERSATION.md, HEARTBEAT.md do template para o diretorio do novo agente
2. Gerar AGENT.md com frontmatter (nome, descricao, enabled, heartbeat, active hours)
3. Registrar agente no registry (hot reload via watcher)
4. Retornar agente criado

Response: `201 Created` com o agente criado.

**Hub — API module `api/templates.ts`:**

```typescript
export const agentTemplatesQueryOptions = () =>
  queryOptions({
    queryKey: ["templates", "agents"],
    queryFn: () => request<{ templates: AgentTemplate[] }>("/templates/agents"),
  });

export const agentTemplateQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["templates", "agents", slug],
    queryFn: () => request<AgentTemplateDetail>(`/templates/agents/${slug}`),
  });

export async function createAgentFromTemplate(data: CreateFromTemplatePayload) {
  return request<Agent>("/agents/from-template", { method: "POST", body: JSON.stringify(data) });
}
```

### Feature F-073: Galeria de templates + rota /agents/new

**Nova rota** `routes/_authenticated/agents/new.tsx`:

- Grid de cards de template agrupados por categoria
- Busca por nome/descricao (client-side filter)
- Opcao "Criar do zero" no final da galeria

**components/agents/template-gallery.tsx:**

```typescript
interface TemplateGalleryProps {
  templates: AgentTemplate[];
  onSelect: (slug: string) => void;
}
```

**components/agents/template-card.tsx:**

```typescript
interface TemplateCardProps {
  template: AgentTemplate;
  onSelect: () => void;
}
```

Card: icone Lucide, nome, descricao (2 linhas max), badge de categoria, botao "Usar este template".

**Integracao com pagina de agentes:**
- Botao "Novo agente" em `/agents` navega para `/agents/new`
- "Criar do zero" na galeria abre formulario limpo (comportamento atual)

Layout: grid 3 colunas desktop, 2 mobile.

### Feature F-074: Wizard de criacao em 3 steps

**components/agents/create-from-template-wizard.tsx:**

```typescript
interface CreateFromTemplateWizardProps {
  templateSlug: string;
}
```

**Step 1 — Preview do template:**
- Nome, descricao, o que vem configurado
- Preview do SOUL.md (markdown renderizado)

**Step 2 — Personalizar:**
- Nome do agente (obrigatorio)
- Slug (auto-gerado do nome, editavel)
- Descricao (pre-preenchida do template, editavel)
- Owner (select: system ou usuario)

**Step 3 — Confirmar e criar:**
- Resumo do que sera criado
- Botao "Criar agente"
- Apos criacao: redirecionar para pagina do agente

Stepper visual. React Hook Form + Zod para validacao. Navegacao: Voltar / Proximo / Criar.

## Limites

- **NAO** implementar edicao de templates pela UI — templates sao arquivos no filesystem.
- **NAO** implementar criacao de templates pelo usuario — apenas os 5 iniciais.
- **NAO** implementar marketplace de templates.
- **NAO** implementar customizacao de SOUL.md no wizard — apenas nome, slug e descricao. Edicao avancada na pagina do agente apos criacao.

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado.
- **PRP-03** (Gestao de Agentes) deve estar implementado — wizard cria agente e redireciona para pagina do agente.

## Validacao

- [ ] 5 templates iniciais criados com SOUL.md, CONVERSATION.md, HEARTBEAT.md
- [ ] Endpoint `/templates/agents` lista todos os templates
- [ ] Galeria de templates exibida em `/agents/new`
- [ ] Cards agrupados por categoria com busca/filtro
- [ ] Wizard de criacao com 3 steps funciona
- [ ] Criar agente a partir de template copia arquivos corretos
- [ ] Agente criado aparece no registry e funciona normalmente
- [ ] Opcao "Criar do zero" disponivel na galeria
- [ ] Preview do template mostra SOUL.md renderizado
- [ ] Slug auto-gerado a partir do nome (editavel)
- [ ] Redireciona para pagina do agente apos criacao
- [ ] Responsivo: grid 2 colunas mobile, 3+ desktop
- [ ] `npm run build:hub` compila sem erros (backbone e hub)

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-071 Templates filesystem | S-018 sec 2 | D-017, G-017 |
| F-072 Endpoints templates | S-018 sec 3 | G-033, G-012 |
| F-073 Galeria + /agents/new | S-018 sec 4.1, 4.3 | G-033, G-012 |
| F-074 Wizard 3 steps | S-018 sec 4.2 | G-033, D-017 |
