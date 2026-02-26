# Planning → Agent Harness: Workflow

> Como artefatos de planejamento humano alimentam o agent harness para desenvolvimento autônomo de longa duração.
> Baseado em *"Effective Harnesses for Long-Running Agents"* — Anthropic Engineering, Nov 2025.

---

## O Problema

Coding agents que operam em múltiplas sessões precisam de artefatos estruturados para manter continuidade. Sem isso, cada sessão começa do zero — o agente tenta fazer tudo de uma vez, declara vitória prematura, ou constrói sobre código quebrado.

A Anthropic resolveu a parte do agente com o padrão **Initializer + Coder**. Mas esse padrão assume que o prompt inicial já existe e está completo. Ele não cobre o trabalho humano que vem antes: definir o que construir, como construir, e com quais referências.

Este documento cobre o ciclo completo — do brainstorming ao código rodando.

---

## Três Fases, Três Donos

```
HUMANO                      INITIALIZER               CODER (loop)
──────                      ───────────               ────────────
brainstorming               lê PRP                    pwd
  → specs                   expande features.json     cat claude-progress.txt
    → PRPs                  cria init.sh              cat features.json
      → refs                cria claude-progress.txt  git log --oneline -20
                            cria AGENTS.md            bash init.sh
                            git commit inicial        smoke test
                                                      implementa 1 feature
                                                      testa end-to-end
                                                      atualiza progress
                                                      git commit clean state
```

---

## Fase 1: Planejamento Humano

O objetivo é produzir um **PRP (Product Requirement Prompt)** completo o suficiente para que o Initializer consiga expandir em features implementáveis sem ambiguidade.

### Pipeline

```
brainstorming → specs → PRPs → refs
```

**Brainstorming** — exploração livre. Notas soltas, prints, links, áudios transcritos, rabiscos. Sem compromisso com formato.

**Specs** — derivadas do brainstorming, estruturadas em documentos com propósito definido:

| Documento | Conteúdo |
|-----------|----------|
| `requirements.md` | Requisitos de sistema — formato OSD (O Sistema Deve) |
| `user-stories.md` | Histórias de usuário com critérios de aceitação |
| `design.md` | Decisões de arquitetura e engenharia |
| `er.md` | Entidades, relacionamentos e schema de dados |
| `ui-guide.md` | UI/UX — look and feel, padrões visuais, comportamentos |
| `{feature}.md` | Conceitos e guias extras sob demanda |

**PRPs** — prompts derivados das specs, formatados para consumo direto pelo Initializer. Um PRP é um prompt executável, não um documento descritivo.

**Refs** — referências técnicas para a implementação: docs de componentes (shadcn, vaul), padrões de mobile, exemplos de animação (framer-motion), screenshots, trechos de código. Organizadas por lib/pattern, não por feature — uma mesma referência pode servir múltiplas features.

---

## Fase 2: Initializer Agent

O Initializer recebe o PRP como prompt e produz o ambiente para o coding agent:

**`features.json`** — lista expandida de features. Cada uma começa como `"passes": false`. Formato JSON porque o modelo é menos propenso a editar ou apagar conteúdo JSON indevidamente.

```json
{
  "category": "functional",
  "description": "Usuário pode criar conta com email e senha",
  "steps": [
    "Navegar para tela de cadastro",
    "Preencher formulário",
    "Submeter",
    "Verificar redirecionamento para onboarding",
    "Verificar persistência no banco"
  ],
  "passes": false
}
```

**`claude-progress.txt`** — log vivo do projeto. O coder lê no início e atualiza no final de cada sessão. Status atual, features completas, issues, decisões arquiteturais, notas das últimas 3-5 sessões.

**`init.sh`** — bootstrap do ambiente. Sobe dev server, instala dependências, executa migrations.

**`AGENTS.md`** — contexto permanente para o coder. Comandos, stack com versões, convenções, padrões, e boundaries (o que não tocar).

**Git commit inicial** — snapshot do ponto zero.

---

## Fase 3: Coding Agent (Loop)

Cada sessão segue uma sequência fixa:

```
1. pwd                         → confirmar diretório
2. cat claude-progress.txt     → estado atual
3. cat features.json           → lista de features
4. git log --oneline -20       → mudanças recentes
5. bash init.sh                → subir ambiente
6. SMOKE TEST                  → testar o que já existe
7. Selecionar feature          → maior prioridade com passes: false
8. Implementar                 → UMA feature por sessão
9. Testar end-to-end           → como um usuário faria
10. Atualizar progress.txt     → registrar o que foi feito
11. Git commit                 → estado limpo
```

### Clean State

Ao final de cada sessão, o código deve estar num estado apropriado para merge. Sem bugs introduzidos, código organizado, testes passando, progress atualizado, próxima prioridade clara.

### Failure Modes

| Problema | Solução |
|----------|---------|
| Agente tenta fazer tudo de uma vez | `features.json` força trabalho incremental |
| Declara projeto completo prematuramente | Features com `passes: false` impedem isso |
| Deixa código quebrado entre sessões | Smoke test no início + git commit clean no final |
| Marca feature como pronta sem testar | Instrução explícita para testar end-to-end |
| Perde tempo entendendo o ambiente | `init.sh` + `claude-progress.txt` eliminam isso |

---

## Múltiplas Ondas

O planejamento humano acontece em ondas. O harness não sabe sobre ondas — ele trabalha com `features.json` como backlog contínuo.

**Onda 1 completa.** `.planning/01-mvp/` contém brainstorming, specs, PRPs. O Initializer expandiu em features F-001 a F-010. O Coder implementou todas.

**Onda 2 chega.** Você cria `.planning/02-dashboard/` com novos artefatos. O Initializer lê o PRP novo e **adiciona** features ao JSON existente. Todas começam como `passes: false`. O Coder continua o loop normalmente.

```
features.json (acumulativo):

F-001 onboarding flow       ✅ passes: true   ← onda 1
F-002 profile setup          ✅ passes: true   ← onda 1
F-003 welcome screen         ✅ passes: true   ← onda 1
...
F-011 dashboard KPIs         ❌ passes: false  ← onda 2
F-012 chart filters          ❌ passes: false  ← onda 2
F-013 data export            ❌ passes: false  ← onda 2
```

`claude-progress.txt` é contínuo. `.planning/` é teu histórico de decisões — nunca é apagado. Nada é jogado fora.

---

## Estrutura de Pastas

```
projeto/
│
├── .planning/                          ← HUMANO: antes do harness
│   ├── 00-workflow/
│   │   └── planning-workflow.md        ← este documento
│   │
│   ├── 01-mvp-onboarding/             ← primeira onda
│   │   ├── brainstorming/
│   │   ├── specs/
│   │   │   ├── requirements.md
│   │   │   ├── user-stories.md
│   │   │   ├── design.md
│   │   │   ├── er.md
│   │   │   └── ui-guide.md
│   │   ├── prps/
│   │   │   └── prp-onboarding.md       ← initializer consome isso
│   │   ├── refs/
│   │   │   ├── shadcn/
│   │   │   ├── vaul/
│   │   │   └── framer-motion/
│   │   └── SESSION.md
│   │
│   └── 02-dashboard/                   ← segunda onda
│       ├── brainstorming/
│       ├── specs/
│       ├── prps/
│       ├── refs/
│       └── SESSION.md
│
├── features.json                       ← HARNESS: source of truth
├── claude-progress.txt                 ← HARNESS: estado vivo
├── init.sh                             ← HARNESS: bootstrap
├── AGENTS.md                           ← HARNESS: contexto do coder
├── src/
├── package.json
└── ...
```

### Convenções

- `.planning/` é input humano — o harness não toca lá
- Raiz é output do harness — `features.json`, `claude-progress.txt`, `init.sh`, `AGENTS.md`
- Sessions numeradas — `01-`, `02-`, `03-` mantém ordem cronológica
- Refs por lib/pattern — não por feature (evita duplicação)
- `SESSION.md` — índice da onda com status e links entre docs

---

## SESSION.md (Template)

```markdown
# Session: [nome da onda]

## Objetivo
[O que esta onda entrega]

## Status
- [ ] Brainstorming
- [ ] Specs derivadas
- [ ] PRPs gerados
- [ ] Refs coletadas
- [ ] Initializer executado

## Specs
- requirements.md
- user-stories.md
- design.md
- er.md
- ui-guide.md

## PRPs
- prp-[feature].md ← sources: [specs que alimentaram]

## Refs
[libs e patterns coletados]
```

---

## Fonte

- Anthropic Engineering — *Effective Harnesses for Long-Running Agents* (Nov 2025)
  https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
