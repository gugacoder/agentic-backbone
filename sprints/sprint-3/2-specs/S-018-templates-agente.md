# AB Hub - Templates de Agente

Galeria de templates pre-configurados para criacao rapida de agentes, com wizard de onboarding guiado.

---

## 1. Objetivo

- Galeria de templates de agente por caso de uso (Atendente, Vendedor, Suporte, Monitor, etc.)
- Cada template inclui SOUL.md, CONVERSATION.md, HEARTBEAT.md pre-prontos
- Wizard: escolher template > personalizar nome/descricao > ativar
- Reduzir time-to-value de "horas" para "2 minutos"
- Resolver D-017 (onboarding lento), G-033 (templates + wizard), G-012 (onboarding rapido), G-017 (templates pre-prontos)

---

## 2. Armazenamento de Templates

### 2.1 Estrutura no Filesystem

Templates ficam no diretorio de templates do backbone:

```
context/.templates/agents/
  atendente/
    TEMPLATE.md           -- metadata do template (frontmatter)
    SOUL.md               -- personalidade pre-configurada
    CONVERSATION.md       -- instrucoes de conversa
    HEARTBEAT.md          -- instrucoes de heartbeat
  vendedor/
    TEMPLATE.md
    SOUL.md
    CONVERSATION.md
    HEARTBEAT.md
  suporte-tecnico/
    ...
  monitor-sistemas/
    ...
  assistente-pessoal/
    ...
```

### 2.2 TEMPLATE.md (metadata)

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

## Quando usar

Ideal para empresas que recebem perguntas frequentes de clientes por chat ou WhatsApp. O agente responde automaticamente com base no contexto do negocio.

## O que vem configurado

- Personalidade profissional e empática em pt-BR
- Instrucoes de conversa focadas em atendimento
- Heartbeat desativado por padrao (ativa sob demanda)
- Horario comercial pre-configurado
```

### 2.3 Templates Iniciais

| Template | Slug | Categoria | Descricao |
|----------|------|-----------|-----------|
| Atendente | `atendente` | atendimento | Atendimento ao cliente, FAQs, resolucao de problemas |
| Vendedor | `vendedor` | vendas | Follow-up de leads, qualificacao, pitch de vendas |
| Suporte Tecnico | `suporte-tecnico` | suporte | Troubleshooting, resolucao guiada, escalonamento |
| Monitor de Sistemas | `monitor-sistemas` | operacoes | Verificacao periodica de sistemas, alertas proativos |
| Assistente Pessoal | `assistente-pessoal` | produtividade | Organizacao de tarefas, lembretes, resumos diarios |

---

## 3. API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/templates/agents` | Listar templates disponiveis |
| GET | `/templates/agents/:slug` | Detalhes de um template |
| POST | `/agents/from-template` | Criar agente a partir de template |

### 3.1 GET `/templates/agents`

**Response:**

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

### 3.2 GET `/templates/agents/:slug`

**Response:** template completo incluindo conteudo dos markdowns:

```json
{
  "slug": "atendente",
  "name": "Atendente",
  "description": "...",
  "icon": "Headphones",
  "category": "atendimento",
  "tags": ["atendimento", "cliente"],
  "content": "## Quando usar\n...",
  "suggestedSkills": ["web-search"],
  "suggestedTools": [],
  "heartbeatEnabled": false,
  "activeHours": "08:00-18:00",
  "preview": {
    "soul": "Voce eh um atendente profissional...",
    "conversation": "Ao receber uma mensagem...",
    "heartbeat": ""
  }
}
```

### 3.3 POST `/agents/from-template`

**Payload:**

```json
{
  "template": "atendente",
  "owner": "system",
  "slug": "atendente-loja",
  "name": "Atendente da Loja",
  "description": "Agente de atendimento para a Loja XYZ",
  "enabled": true
}
```

**Logica:**
1. Copiar SOUL.md, CONVERSATION.md, HEARTBEAT.md do template para o diretorio do novo agente
2. Gerar AGENT.md com frontmatter configurado (nome, descricao, enabled, heartbeat, active hours)
3. Registrar agente no registry (hot reload via watcher)
4. Retornar agente criado

**Response:** `201 Created` com o agente criado (mesmo formato de `GET /agents/:id`).

---

## 4. Telas

### 4.1 Galeria de Templates

Acessivel de duas formas:
- Botao "Novo agente" na pagina de agentes (`/agents`) abre wizard que mostra galeria
- Rota dedicada: `/agents/new`

**Layout:**

```
+---------- Novo Agente --------------------+
| Escolha um template                       |
|                                          |
| [Buscar templates...]                    |
|                                          |
| Atendimento                              |
| +-------------+  +------------------+    |
| | Headphones  |  | ShoppingCart     |    |
| | Atendente   |  | Vendedor         |    |
| | Atendimento |  | Follow-up, pitch |    |
| | [Usar]      |  | [Usar]           |    |
| +-------------+  +------------------+    |
|                                          |
| Operacoes                                |
| +-------------+  +------------------+    |
| | Monitor     |  | User             |    |
| | Monitor     |  | Assistente       |    |
| | Sistemas    |  | Pessoal          |    |
| | [Usar]      |  | [Usar]           |    |
| +-------------+  +------------------+    |
|                                          |
| [Criar do zero] — sem template           |
+------------------------------------------+
```

### 4.2 Wizard de Criacao (apos selecionar template)

**Step 1:** Preview do template
- Nome, descricao, o que vem configurado
- Preview do SOUL.md

**Step 2:** Personalizar
- Nome do agente (obrigatorio)
- Slug (auto-gerado do nome, editavel)
- Descricao (pre-preenchida do template, editavel)
- Owner (select: system ou usuario)

**Step 3:** Confirmar e criar
- Resumo do que sera criado
- Botao "Criar agente"
- Apos criacao: redirecionar para pagina do agente

### 4.3 Cards de Template

| Elemento | Descricao |
|----------|-----------|
| Icone | Lucide icon do template |
| Nome | Titulo do template |
| Descricao | Resumo curto (2 linhas max) |
| Categoria | Badge de categoria |
| Botao | "Usar este template" |

### 4.4 Integracao com Pagina de Agentes

- Botao "Novo agente" na pagina `/agents` navega para `/agents/new`
- Na pagina `/agents/new`, opcao "Criar do zero" abre formulario limpo (comportamento atual de criacao)

---

## 5. Componentes

### 5.1 TemplateGallery

**Localizacao:** `components/agents/template-gallery.tsx`

```typescript
interface TemplateGalleryProps {
  templates: AgentTemplate[];
  onSelect: (slug: string) => void;
}
```

- Grid de cards agrupados por categoria

### 5.2 TemplateCard

**Localizacao:** `components/agents/template-card.tsx`

```typescript
interface TemplateCardProps {
  template: AgentTemplate;
  onSelect: () => void;
}
```

### 5.3 CreateFromTemplateWizard

**Localizacao:** `components/agents/create-from-template-wizard.tsx`

```typescript
interface CreateFromTemplateWizardProps {
  templateSlug: string;
}
```

- Steps com stepper visual
- React Hook Form + Zod para validacao
- Navegacao: Voltar / Proximo / Criar

### 5.4 TemplatePreview

**Localizacao:** `components/agents/template-preview.tsx`

- Preview do SOUL.md e instrucoes
- Markdown renderizado

### 5.5 API Module

**Localizacao:** `api/templates.ts`

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

---

## 6. Navegacao

Atualizar fluxo de criacao de agente:

| Acao atual | Novo fluxo |
|------------|------------|
| Botao "Novo agente" abre form | Botao "Novo agente" navega para `/agents/new` |
| — | `/agents/new` mostra galeria + opcao "criar do zero" |
| — | Selecionar template abre wizard |

---

## 7. Criterios de Aceite

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

---

## 8. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| Templates no filesystem | D-017 (onboarding lento), G-017 (templates pre-prontos) |
| TemplateGallery | G-033 (galeria pre-configurada), G-012 (onboarding rapido) |
| CreateFromTemplateWizard | G-033 (wizard 2 minutos), D-017 (sem templates) |
| SOUL.md pre-pronto | G-033 (SOUL.md pre-pronto), G-004 (personalizacao) |
| POST /agents/from-template | G-012 (do zero ao primeiro agente rapido) |
