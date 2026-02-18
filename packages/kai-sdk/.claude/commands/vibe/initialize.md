# Inicializa o agent harness para vibe code

Você é o INITIALIZER AGENT para um projeto long-running com agent harness.

## Contexto do Run

- Arquivo `.harness/{session}/config.json` contém a configuração do run (incluindo `specs`)
- Arquivo `.harness/active` contém o nome da session/milestone

## Passo 1 — Absorver Contexto

Leia TODOS estes arquivos antes de qualquer ação:

### Identifique a sessão e configuração:
```bash
cat .harness/active
cat .harness/$(cat .harness/active)/config.json
```

### Especificação (use o `specs` de config.json):
- `{specs}/02-specs/` — leia TODOS os arquivos
- `{specs}/03-prps/` — leia TODOS os arquivos
- `{specs}/04-refs/` — leia os arquivos relevantes (referências técnicas)

### Estrutura existente do projeto:
- Leia CLAUDE.md (se existir)
- Leia README.md (se existir)
- Leia arquivos de configuração da raiz (package.json, docker-compose*.yml, ou equivalentes)
- Explore a estrutura de diretórios do projeto (`ls` na raiz e subpastas principais)
- Se `.harness/{session}/features.json` já existir, leia-o — esta pode ser uma onda adicional

Onde `{session}` é o conteúdo de `.harness/active`.

## Passo 2 — Criar/Atualizar Harness

**CRÍTICO:** Os artefatos ficam em `.harness/{session}/`. O `agent-setup.sh` fica no root do projeto.

Crie (ou atualize) os seguintes arquivos:

### 2.1 `.harness/{session}/features.json`
Analise as specs e PRPs e decomponha a onda em features atômicas e ordenadas.
**Se features.json já existir, ADICIONE as novas features ao final — nunca apague features existentes.**
Cada feature deve ter:
- id (F-001, F-002... ou continuando a numeração existente)
- name (nome curto)
- description (o que implementar)
- status: "failing" (TODAS as novas começam como failing)
- priority (ordem de implementação, respeitando dependências)
- tests (lista de critérios verificáveis para marcar como "passing")
- dependencies (lista de ids de features que precisam estar prontas antes)
- prp_path (caminho absoluto para o PRP correspondente, se houver — extraído do specs em config.json)

Organize as novas features na ordem lógica de implementação:
1. Infraestrutura e configuração base
2. Database/schema
3. Auth
4. Core features (do mais fundamental ao mais derivado)
5. UI/UX refinements
6. Testes e polish

### 2.2 `.harness/{session}/progress.txt`
Crie (ou atualize) o arquivo de progresso com:
- Current Status (estado geral do projeto)
- Specs Path (caminho para docs — extraído de config.json)
- Environment (stack, comandos de dev/test/build — extraídos da configuração do projeto)
- Lista completa de features (todas as novas como [ ] pendentes)
- Architecture Decisions (extraídas das specs)
- Session Notes: "Session N (Initializer): Harness criado/atualizado para onda {sessão}"

### 2.3 `agent-setup.sh` (no ROOT do projeto — EXATAMENTE este nome)
Script de bootstrap em `./agent-setup.sh` que:
- Detecta o gerenciador de pacotes (npm, pnpm, yarn, bun) e instala dependências
- Sobe o ambiente Docker se houver docker-compose
- Inicia dev server
- Faz smoke test básico (curl ou health check)
- Imprime resumo do estado

## Passo 3 — Git Commit Inicial

Faça um commit com todos os arquivos do harness:
```
chore(harness): inicializar agent harness para onda {sessão}

- features.json com N features (todas failing)
- progress.txt criado/atualizado
- agent-setup.sh bootstrap script criado/atualizado
```

## Passo 4 — Relatório

Ao final, apresente:
1. Quantas features foram identificadas (e total acumulado se for onda adicional)
2. Qual é a primeira feature a ser implementada
3. Estimativa de complexidade geral
4. Qualquer risco ou ambiguidade encontrada nas specs

## Regras

- NÃO implemente nenhuma feature. Apenas PLANEJE e ESTRUTURE.
- NÃO modifique código existente do projeto (src/, apps/, packages/, etc).
- RESPEITE a estrutura existente do projeto.
- Seja específico nos testes de cada feature — critérios vagos são inúteis.
- Priorize features que desbloqueiam outras (dependências primeiro).
