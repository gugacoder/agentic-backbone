# Agent Harness: Guia Completo para Agentes de Longa Duração

> Referência técnica baseada no artigo "Effective Harnesses for Long-Running Agents" da Anthropic, no padrão AGENTS.md, e nas melhores práticas da comunidade.

---

## O Problema Fundamental

Agentes de IA que trabalham em tarefas complexas — spanning horas ou dias — precisam operar em sessões discretas. Cada nova sessão começa **sem memória** do que veio antes.

Imagine um projeto de software onde a cada turno chega um engenheiro novo que não sabe o que o anterior fez. Sem uma forma estruturada de fazer handoff, o resultado é:

- **Features incompletas** — o agente começa algo novo sem terminar o anterior
- **Trabalho duplicado** — refaz o que já foi feito por não saber do progresso
- **Declaração prematura de conclusão** — vê que há código e assume que está pronto
- **Cascading failures** — constrói features sobre uma base quebrada

A Anthropic desenvolveu uma solução two-fold: um **Initializer Agent** que prepara o ambiente, e um **Coding Agent** que faz progresso incremental a cada sessão.

---

## Arquitetura Two-Fold

```
┌─────────────────────────────────────────────────────────┐
│                    PRIMEIRA SESSÃO                       │
│                                                         │
│  Initializer Agent                                      │
│  ├── Expande prompt → feature list detalhada (JSON)     │
│  ├── Cria init.sh (bootstrap do ambiente)               │
│  ├── Cria claude-progress.txt (log de progresso)        │
│  ├── Cria AGENTS.md (contexto para agentes)             │
│  └── Faz git commit inicial (snapshot do ponto zero)    │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│               SESSÕES SUBSEQUENTES (loop)               │
│                                                         │
│  Coding Agent                                           │
│  ├── pwd (grounding no diretório)                       │
│  ├── Lê git log + claude-progress.txt                   │
│  ├── Revisa feature list → seleciona próxima prioridade │
│  ├── Executa init.sh (sobe dev server)                  │
│  ├── Smoke test antes de codar (catch bugs anteriores)  │
│  ├── Implementa UMA feature por sessão                  │
│  ├── Testa a feature implementada                       │
│  ├── Atualiza claude-progress.txt                       │
│  └── Git commit com estado limpo (clean state)          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

A inspiração veio de observar o que engenheiros de software eficientes fazem todo dia: usam git, escrevem notas de progresso, fazem smoke tests antes de começar, e deixam o código num estado limpo.

---

## Arquivos que o Initializer Deve Criar

### 1. `claude-progress.txt` — O Arquivo Mais Crítico

Este é o mecanismo primário de continuidade entre sessões. Cada coding agent lê este arquivo PRIMEIRO ao iniciar uma nova sessão.

```markdown
# Project Progress

## Current Status
Last updated: 2026-02-06T14:30:00Z
Last session focus: JWT Authentication System
Current phase: Feature Implementation (3/12 complete)

## Environment
- Stack: React 18 + Node.js + PostgreSQL
- Dev server: npm run dev (port 3000)
- Test: npm test
- Build: npm run build

## Completed Features
- [x] F-001: Project scaffolding and base layout
- [x] F-002: Database schema and migrations
- [x] F-003: JWT Authentication (login, register, refresh)

## In Progress
- [ ] F-004: Dashboard with charts (NEXT PRIORITY)
  - API endpoints ready
  - Need: frontend components + data binding

## Pending Features
- [ ] F-005: User profile management
- [ ] F-006: Role-based access control
- [ ] F-007: Notification system
- [ ] F-008: Report generation
- [ ] F-009: Audit logging
- [ ] F-010: Search functionality
- [ ] F-011: Data export (CSV/PDF)
- [ ] F-012: Settings page

## Known Issues
- Bug #3: Timeout on queries with >1000 results (workaround: pagination)
- Bug #7: CSS flash on initial load in dark mode

## Architecture Decisions
- Chose Recharts over Chart.js (better tree-shaking, React-native)
- JWT stored in httpOnly cookie (not localStorage)
- API follows REST conventions with /api/v1/ prefix

## Session Notes
### Session 5 (2026-02-06)
- Completed auth refresh token flow
- Fixed CORS issue with cookie-based auth
- Left off: dashboard API endpoints tested, frontend next

### Session 4 (2026-02-05)
- Implemented login/register endpoints
- Added bcrypt password hashing
- Created auth middleware
```

**Regras do progress.txt:**

- Sempre atualizar ao FINAL de cada sessão
- Incluir o que foi feito, o que ficou pendente, e qual é a próxima prioridade
- Registrar decisões arquiteturais para que sessões futuras não as revertam
- Manter um log de sessões recentes (últimas 3-5) para contexto imediato

---

### 2. `features.json` — Source of Truth

O Initializer expande o prompt original do usuário numa feature list detalhada em JSON. Todas as features começam como `"failing"`. O coding agent só pode marcar como `"passing"` após implementação E teste.

```json
{
  "project": "CiaPrimeCare Dashboard",
  "created": "2026-02-06T10:00:00Z",
  "total_features": 12,
  "completed": 3,
  "features": [
    {
      "id": "F-001",
      "name": "Project scaffolding and base layout",
      "description": "Initialize React app with routing, base components, and layout structure",
      "status": "passing",
      "priority": 1,
      "completed_at": "2026-02-04T15:00:00Z",
      "tests": [
        "App renders without errors",
        "Navigation between routes works",
        "Responsive layout on mobile/desktop"
      ],
      "dependencies": []
    },
    {
      "id": "F-002",
      "name": "Database schema and migrations",
      "description": "PostgreSQL schema with all required tables, indexes, and seed data",
      "status": "passing",
      "priority": 2,
      "completed_at": "2026-02-04T18:00:00Z",
      "tests": [
        "All migrations run successfully",
        "Seed data populates correctly",
        "Foreign key constraints validated"
      ],
      "dependencies": []
    },
    {
      "id": "F-003",
      "name": "JWT Authentication",
      "description": "Login, register, token refresh, logout with httpOnly cookies",
      "status": "passing",
      "priority": 3,
      "completed_at": "2026-02-06T14:30:00Z",
      "tests": [
        "User can register with valid data",
        "User can login and receive token",
        "Token refresh works before expiry",
        "Logout invalidates session",
        "Protected routes reject unauthenticated requests"
      ],
      "dependencies": ["F-002"]
    },
    {
      "id": "F-004",
      "name": "Dashboard with charts",
      "description": "Main dashboard with KPI cards and Recharts visualizations",
      "status": "failing",
      "priority": 4,
      "tests": [
        "Dashboard loads with real data",
        "Charts render correctly with sample data",
        "Date range filter works",
        "Responsive on all breakpoints"
      ],
      "dependencies": ["F-003"]
    }
  ]
}
```

**Por que JSON e não Markdown?** O JSON permite que o agente faça parsing programático para determinar automaticamente qual feature atacar, calcular percentual de conclusão, e validar dependências.

---

### 3. `init.sh` — Bootstrap do Ambiente

Script que cada sessão executa para preparar o ambiente de desenvolvimento. O coding agent roda este script antes de começar qualquer trabalho novo.

```bash
#!/bin/bash
set -e

echo "=== Agent Session Bootstrap ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 1. Verificar dependências
echo "→ Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies..."
  npm install
fi

# 2. Verificar banco de dados
echo "→ Checking database..."
if command -v psql &> /dev/null; then
  npx prisma migrate deploy 2>/dev/null || echo "  ⚠️ Migration check skipped"
fi

# 3. Iniciar dev server em background
echo "→ Starting dev server..."
npm run dev &
DEV_PID=$!
sleep 5

# 4. Smoke test — CRÍTICO
echo "→ Running smoke test..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
  echo "  ✅ Server responding (HTTP $HTTP_STATUS)"
else
  echo "  ❌ Server not responding (HTTP $HTTP_STATUS)"
  echo "  Check logs before proceeding!"
fi

# 5. Resumo do estado
echo ""
echo "=== Environment Ready ==="
echo "Dev server PID: $DEV_PID"
echo "URL: http://localhost:3000"
echo ""
echo "Next steps:"
echo "  1. Read claude-progress.txt"
echo "  2. Read features.json"  
echo "  3. Check git log --oneline -10"
echo "  4. Pick highest priority failing feature"
echo "  5. Test existing functionality BEFORE coding"
```

**O smoke test antes de codar é essencial.** Sem ele, o agente pode construir features sobre uma base quebrada, criando cascading failures. No exemplo da Anthropic, o agente sempre iniciava um chat, enviava uma mensagem e verificava a resposta antes de implementar novas features.

---

### 4. Git Commit Inicial — O Snapshot Zero

O primeiro commit marca o estado fundacional do projeto. Sessões subsequentes usam `git log` e `git diff` para entender o que mudou.

```bash
# O Initializer faz isso automaticamente
git init
git add .
git commit -m "feat: initial project setup by initializer agent

- Created project structure and configuration
- Added features.json with 12 features (all failing)
- Created claude-progress.txt
- Created init.sh bootstrap script
- Created AGENTS.md with project context"
```

**Convenção de commits para o Coding Agent:**

```
feat: implement F-004 dashboard charts
- Added KPI cards with real data
- Integrated Recharts for line/bar charts  
- Date range filter functional
- All 4 tests passing

Progress: 4/12 features complete
Next: F-005 User profile management
```

---

### 5. `AGENTS.md` — README para Agentes

O AGENTS.md é um padrão aberto e cross-tool que funciona como um "briefing packet" para qualquer agente de IA que trabalhe no repositório. Diferente do README (que é para humanos), o AGENTS.md contém o contexto detalhado que agentes precisam: comandos de build, testes, convenções e decisões que seriam muito granulares para documentação humana.

#### O que é AGENTS.md

AGENTS.md é um formato aberto, simples, em Markdown, mantido pela Agentic AI Foundation sob a Linux Foundation. Surgiu da colaboração entre OpenAI Codex, Amp, Jules (Google), Cursor e Factory. É suportado nativamente por:

- **OpenAI Codex** — leitura automática na inicialização
- **Cursor** — suporte nativo
- **GitHub Copilot** — suporte via `.github/agents/`
- **Amp** — suporte anunciado
- **Roo Code** — suporte adicionado
- **Claude Code** — usa `CLAUDE.md` mas pode ser linkado via symlink

```bash
# Para compatibilidade cross-tool
ln -s AGENTS.md CLAUDE.md
ln -s AGENTS.md GEMINI.md
```

#### Estrutura Recomendada

```markdown
# Nome do Projeto

Descrição concisa do que o projeto faz e seu propósito.

## Core Commands

Comandos que o agente vai usar constantemente. Coloque CEDO no arquivo.

- Type-check: `npx tsc --noEmit`
- Lint: `npm run lint`
- Test suite: `npm test --no-color`
- Single test: `npm test -- --testPathPattern=<path>`
- Dev server: `npm run dev`
- Build: `npm run build`
- Database reset: `npx prisma migrate reset --force`

## Architecture Overview

Descrição curta dos módulos principais. Prefira descrever
capacidades ao invés de caminhos de arquivos (caminhos mudam,
capacidades são mais estáveis).

O projeto segue clean architecture com separação em:
- **API Layer**: Express routes com middleware de auth e validação
- **Service Layer**: Lógica de negócio, independente de framework
- **Data Layer**: Prisma ORM com PostgreSQL
- **Frontend**: React 18 com TypeScript e Recharts para visualizações

## Tech Stack

Seja específico com versões.

- React 18.2 com TypeScript 5.3
- Node.js 20 LTS com Express 4
- PostgreSQL 15 com Prisma 5.x ORM
- Recharts 2.x para visualizações
- TailwindCSS 3.4 para styling
- JWT (httpOnly cookies) para autenticação
- Vitest para testes

## Conventions & Patterns

Um snippet de código real vale mais que 3 parágrafos de explicação.

- Componentes React: functional components com hooks, nunca classes
- Naming: camelCase para variáveis/funções, PascalCase para componentes
- API responses: `{ success: boolean, data?: T, error?: string }`
- Errors: usar classes customizadas que estendem AppError
- Imports: absolutos com alias `@/` apontando para `src/`

Exemplo de service pattern:
```typescript
// services/user.service.ts
export class UserService {
  constructor(private readonly db: PrismaClient) {}
  
  async findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }
}
```

## Testing

- Testes unitários: colocados junto ao arquivo fonte (`*.test.ts`)
- Testes de integração: na pasta `tests/integration/`
- Cobertura mínima: 80% em services, 60% em routes
- Rodar lint antes de qualquer PR: `npm run lint`

## Git Workflow

- Branch naming: `feat/F-XXX-short-description`
- Commits: conventional commits (`feat:`, `fix:`, `refactor:`)
- Sempre incluir ID da feature no commit message
- Nunca commitar diretamente na main

## Security

- JWT tokens em httpOnly cookies (nunca localStorage)
- Todas as rotas protegidas passam pelo middleware `requireAuth`
- Input validation com Zod em todos os endpoints
- SQL injection prevenido pelo Prisma (parameterized queries)
- CORS configurado para domínios específicos em produção
- Nunca commitar secrets, .env, ou API keys

## Boundaries — O que NÃO fazer

- Nunca modificar arquivos em `prisma/migrations/` manualmente
- Nunca alterar `package-lock.json` manualmente
- Nunca remover testes existentes que estão passando
- Nunca alterar configuração de CI/CD sem aprovação
- Nunca fazer deploy em produção
```

#### Princípios para um AGENTS.md Eficaz

1. **Comandos primeiro** — coloque comandos executáveis no topo, o agente vai referenciá-los constantemente
2. **Exemplos de código > explicações** — um snippet real mostrando o estilo correto vale mais que parágrafos descritivos
3. **Boundaries claros** — diga explicitamente o que o agente NÃO deve tocar (secrets, vendor dirs, configs de produção)
4. **Stack específico** — diga "React 18 com TypeScript, Vite e Tailwind" não "projeto React"
5. **Brevidade** — inclua apenas o que importa; fronteiras LLMs seguem ~150-200 instruções com consistência
6. **Hierarquia** — coloque AGENTS.md em subdiretórios para instruções específicas de cada pacote; o agente lê o mais próximo no directory tree

#### AGENTS.md em Subdiretórios (Monorepos)

```
project/
├── AGENTS.md              ← Instruções globais do projeto
├── packages/
│   ├── api/
│   │   └── AGENTS.md      ← Específico do backend
│   ├── web/
│   │   └── AGENTS.md      ← Específico do frontend
│   └── shared/
│       └── AGENTS.md      ← Tipos e utils compartilhados
```

Agentes leem automaticamente o arquivo mais próximo na árvore de diretórios, permitindo que cada subprojeto tenha instruções especializadas.

---

## Protocolo do Coding Agent (Cada Sessão)

Cada nova sessão do coding agent segue uma sequência rigorosa antes de escrever qualquer código:

```
1. pwd                              → Grounding no diretório de trabalho
2. cat claude-progress.txt          → Estado atual do projeto  
3. cat features.json                → Feature list com status
4. git log --oneline -10            → Mudanças recentes
5. bash init.sh                     → Subir ambiente
6. SMOKE TEST                       → Testar funcionalidade existente
7. Selecionar feature               → Maior prioridade com status "failing"
8. Implementar                      → Uma feature por sessão
9. Testar                           → Todos os testes definidos na feature
10. Atualizar progress.txt          → Registrar o que foi feito
11. Git commit                      → Estado limpo, pronto para próxima sessão
```

O passo 6 (smoke test) previne cascading failures. Se a base está quebrada, o agente corrige ANTES de adicionar features novas.

---

## Clean State: A Regra de Ouro

Ao final de cada sessão, o código deve estar num estado equivalente ao que seria apropriado para merge numa branch main:

- **Sem bugs abertos** introduzidos nesta sessão
- **Código organizado** e bem documentado
- **Testes passando** para todas as features implementadas
- **Progress.txt atualizado** refletindo o estado real
- **Git commit** com mensagem descritiva
- **Próxima prioridade clara** para a sessão seguinte

Um desenvolvedor (humano ou agente) deve poder começar a trabalhar numa feature nova sem primeiro limpar uma bagunça de outra pessoa.

---

## Mapa Completo de Arquivos

```
project/
├── AGENTS.md                  ← Contexto cross-tool para agentes
├── CLAUDE.md                  ← Symlink para AGENTS.md (Claude Code)
├── claude-progress.txt        ← Estado vivo do projeto (atualizado a cada sessão)
├── features.json              ← Source of truth das features
├── init.sh                    ← Bootstrap do ambiente
├── .gitignore
├── package.json
├── src/
│   ├── ...                    ← Código do projeto
│   └── ...
└── tests/
    ├── ...                    ← Testes automatizados
    └── ...
```

---

## Questões em Aberto

A Anthropic reconhece que este é "um conjunto possível de soluções" e que há questões abertas:

1. **Single agent vs Multi-agent** — ainda não está claro se um único agente generalista performa melhor do que agentes especializados (testing agent, QA agent, code cleanup agent) para sub-tarefas do ciclo de desenvolvimento
2. **Generalização** — a demonstração foi otimizada para full-stack web apps; aplicar estes padrões a pesquisa científica, modelagem financeira ou outros domínios é uma direção futura
3. **Intervenção humana estruturada** — "pause e peça ajuda" não é suficiente; definir quando, como, e que informação apresentar ao humano

---

## Fontes

- Anthropic Engineering — *Effective Harnesses for Long-Running Agents* (2025)  
  https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents

- AGENTS.md — Formato aberto mantido pela Linux Foundation  
  https://agents.md/

- Factory Documentation — *AGENTS.md Configuration*  
  https://docs.factory.ai/cli/configuration/agents-md

- GitHub Blog — *How to Write a Great agents.md* (análise de 2500+ repos)  
  https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/

- AI Hero — *A Complete Guide to AGENTS.md*  
  https://www.aihero.dev/a-complete-guide-to-agents-md

- HumanLayer Blog — *Writing a Good CLAUDE.md*  
  https://www.humanlayer.dev/blog/writing-a-good-claude-md

- ZenML LLMOps Database — Análise técnica do harness  
  https://www.zenml.io/llmops-database/long-running-agent-harness-for-multi-context-software-development