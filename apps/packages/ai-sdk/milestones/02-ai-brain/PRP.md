# AI Brain — System Prompt Modular Embutido no SDK

A AI SDK nao possui system prompt. O agente recebe ferramentas mas nenhuma instrucao de como usa-las. Isso faz com que modelos menores errem constantemente e ate modelos fortes desperdicem steps. Este PRP define um system prompt modular, composto por arquivos markdown independentes, embutido no SDK e ativo por padrao.

---

## Objetivo

Dotar a AI SDK de um system prompt embutido, composto por modulos markdown em `src/prompts/`, montado automaticamente em runtime com base nas ferramentas ativas. O consumidor do SDK nao precisa fornecer system prompt para obter um agente competente — mas pode sobrescrever se quiser.

## Execution Mode

`implementar`

---

## Contexto

### Estado Atual

```typescript
// agent.ts:46 — system prompt e opcional e vazio por padrao
...(options.system ? { system: options.system } : {}),
```

Se `options.system` nao for passado, o agente opera sem nenhuma orientacao. O modelo recebe apenas:
- As descricoes Zod das ferramentas (uma frase cada)
- A mensagem do usuario

### Consequencias observadas

| Problema | Causa | Impacto |
|----------|-------|---------|
| Agente usa Bash para ler arquivos | Nao sabe que Read existe para isso | Desperdiça steps, output truncado |
| Agente edita sem ler primeiro | Nao sabe o padrao "ler antes de editar" | Edit falha por old_string incorreta |
| Agente nao testa apos modificar | Nao sabe que deve validar | Codigo quebrado sem deteccao |
| Agente repete a mesma tool em loop | Sem orientacao de recuperacao de erro | Consome maxSteps sem progresso |
| Modelos menores (Llama, Mistral) falham muito | Dependem mais de instrucoes explicitas | AI so funciona bem com Claude/GPT-4 |

### Referencia competitiva

| SDK | System prompt | Tokens |
|-----|:------------:|:------:|
| Claude Code | Monolitico, 110+ fragmentos, auto-load CLAUDE.md | ~12.000 + CLAUDE.md |
| Codex | Monolitico, auto-load AGENTS.md (walk up) | ~? + AGENTS.md |
| OpenCode | Arquivos `.txt` por ferramenta | ~3.000 |
| AI SDK | Nenhum | 0 |
| **AI SDK (apos este PRP)** | **Modular, markdown, auto-load AGENTS.md/CLAUDE.md (walk up)** | **~1.100–1.800 + contexto** |

---

## Especificacao

### Estrutura de arquivos

```
src/prompts/
├── assembly.ts             ← funcao getSystemPrompt(), exportada pelo SDK
├── identity.md             ← quem a AI e
├── tool-guide.md           ← regras gerais de uso de ferramentas
├── tools/                  ← um .md por ferramenta
│   ├── read.md
│   ├── write.md
│   ├── edit.md
│   ├── bash.md
│   ├── glob.md
│   └── grep.md
├── patterns.md             ← padroes de trabalho do agente
└── safety.md               ← limites e restricoes
```

Cada arquivo `.md` e um modulo autonomo. Nao ha dependencias entre eles.

---

### Modulos

#### M01: `identity.md` (~150 tokens)

Define quem a AI e. Tom neutro, direto, sem persona exagerada.

**Conteudo deve cobrir:**
- Identidade: "Voce e AI, um agente de coding autonomo"
- Capacidade: opera via ferramentas sobre filesystem e shell
- Tom: conciso, tecnico, sem floreio
- Idioma: responde no idioma do usuario

**Conteudo NAO deve conter:**
- Persona com nome proprio ou personalidade elaborada
- Referencias a providers especificos (OpenRouter, Claude, etc.)
- Frases motivacionais ou marketing

---

#### M02: `tool-guide.md` (~200 tokens)

Regras universais de uso de ferramentas. Aplica-se a todas.

**Conteudo deve cobrir:**
- Sempre ler um arquivo antes de editar
- Preferir ferramentas dedicadas sobre Bash (Read > cat, Grep > grep, Glob > find)
- Verificar resultado apos modificacoes (ler de novo, rodar build/test)
- Se uma ferramenta falhou, nao repetir identica — mudar abordagem
- Multiplas ferramentas independentes podem ser chamadas em sequencia rapida

**Conteudo NAO deve conter:**
- Instrucoes especificas de uma ferramenta (isso vai nos `tools/*.md`)
- Exemplos longos (max 2 linhas por exemplo)

---

#### M03: `tools/*.md` (~60-100 tokens cada)

Um arquivo por ferramenta. Cada um segue o mesmo formato:

```markdown
## {ToolName}

**Use para:** {quando usar}

**NAO use para:** {quando NAO usar — usar outra ferramenta}

**Dica:** {um anti-pattern comum e como evitar}
```

Especificacoes por ferramenta:

| Arquivo | Use para | NAO use para |
|---------|----------|-------------|
| `read.md` | Ler conteudo de arquivos, verificar edicoes | Ler diretorios (usar Bash ls ou ListDir) |
| `write.md` | Criar arquivos novos, reescrever arquivos inteiros | Editar trechos (usar Edit) |
| `edit.md` | Substituir trechos especificos | Reescrever arquivo inteiro (usar Write), editar sem ter lido antes |
| `bash.md` | Git, npm, build, test, comandos de sistema | Ler arquivos (usar Read), buscar conteudo (usar Grep), buscar arquivos (usar Glob) |
| `glob.md` | Encontrar arquivos por padrao de nome | Buscar conteudo dentro de arquivos (usar Grep) |
| `grep.md` | Buscar conteudo dentro de arquivos por regex | Encontrar arquivos por nome (usar Glob) |

**Ferramentas futuras** (milestone 01-better-ai) seguem o mesmo padrao. Ao adicionar uma ferramenta ao SDK, adicionar o `.md` correspondente em `tools/`.

---

#### M04: `patterns.md` (~150 tokens)

Padroes de trabalho que o agente deve seguir.

**Conteudo deve cobrir:**

1. **Explorar antes de agir** — Usar Glob/Grep para entender a estrutura antes de modificar
2. **Ler antes de editar** — Sempre Read antes de Edit
3. **Validar apos modificar** — Rodar build/test apos edicoes
4. **Falhou? Mudar abordagem** — Nao repetir a mesma acao que falhou
5. **Progresso incremental** — Uma modificacao por vez, verificar, seguir

**Conteudo NAO deve conter:**
- Padroes de planejamento elaborado (isso e responsabilidade de tools como TodoWrite e PlanMode, nao do system prompt)
- Workflows rigidos com steps numerados

---

#### M05: `safety.md` (~100 tokens)

Limites do agente.

**Conteudo deve cobrir:**
- Nao executar comandos destrutivos sem confirmacao (rm -rf, drop table, force push)
- Nao modificar arquivos fora do escopo solicitado
- Nao inventar conteudo de arquivos que nao leu
- Nao hardcodar secrets, senhas ou chaves de API
- Se incerto, parar e perguntar (se AskUser estiver disponivel)

---

### Assembler

#### Funcao: `getSystemPrompt(activeTools: string[]): string`

| Aspecto | Decisao |
|---------|---------|
| Arquivo | `src/prompts/assembly.ts` |
| Exportado por | `src/index.ts` (API publica do SDK) |
| Parametro | `activeTools` — array com os nomes das ferramentas ativas (ex: `["Read", "Write", "Edit", "Bash", "Glob", "Grep"]`) |
| Retorno | string com o system prompt completo |

**Ordem de montagem:**

```
1. identity.md
2. tool-guide.md
3. tools/{name}.md  (apenas para cada tool presente em activeTools)
4. patterns.md
5. safety.md
```

**Separacao entre secoes:** uma linha em branco entre cada modulo. Sem XML tags, sem headers extras — o conteudo dos `.md` ja contem seus proprios headers.

**Leitura dos arquivos:** Os `.md` devem ser lidos em build time ou embutidos como strings no bundle (nao em runtime do filesystem). Isso garante que o SDK funciona como pacote npm sem depender de paths relativos.

---

### Descoberta de Contexto do Projeto

A AI auto-descobre arquivos de contexto do projeto, seguindo o mesmo padrao do Claude Code (`CLAUDE.md`) e do Codex (`AGENTS.md`).

#### Algoritmo de descoberta

1. Partir do `cwd` (diretorio de trabalho atual)
2. Subir diretorio por diretorio ate a raiz do projeto (detectada por `.git`) ou raiz do filesystem
3. Em cada diretorio, procurar nesta ordem:
   - `AGENTS.md` (padrao aberto, vendor-neutral)
   - `CLAUDE.md` (amplamente adotado)
4. Coletar todos os arquivos encontrados
5. Concatenar na ordem raiz → cwd (arquivos mais proximos do cwd tem maior precedencia, aparecem por ultimo)

#### Exemplo de descoberta

```
Projeto:
/projeto/CLAUDE.md              ← encontrado (raiz, menor precedencia)
/projeto/packages/AGENTS.md     ← encontrado
/projeto/packages/ai-sdk/      ← cwd (nenhum arquivo aqui)

Resultado: conteudo de CLAUDE.md + AGENTS.md (nessa ordem)
```

#### Integracao com o assembler

O contexto do projeto e adicionado **apos** o system prompt base:

```
1. identity.md
2. tool-guide.md
3. tools/{name}.md
4. patterns.md
5. safety.md
6. [contexto do projeto: AGENTS.md e/ou CLAUDE.md encontrados]   ← novo
```

Cada arquivo encontrado e injetado com um separador:

```
--- project context: /projeto/CLAUDE.md ---
[conteudo do arquivo]

--- project context: /projeto/packages/AGENTS.md ---
[conteudo do arquivo]
```

#### Comportamento

- Se nenhum arquivo for encontrado, o agente funciona sem contexto de projeto (so system prompt base)
- Arquivos vazios sao ignorados
- Limite: se o total de contexto do projeto exceder **4.000 tokens**, truncar os arquivos mais distantes do cwd (menor precedencia) primeiro
- A descoberta e feita **uma vez** no inicio de `runAiAgent()`, nao a cada step

#### Funcao: `discoverProjectContext(cwd: string): string`

| Aspecto | Decisao |
|---------|---------|
| Arquivo | `src/prompts/assembly.ts` (junto com `getSystemPrompt`) |
| Parametro | `cwd` — diretorio de trabalho (default: `process.cwd()`) |
| Retorno | string com conteudo concatenado, ou string vazia |
| Exportado | sim, via `src/index.ts` (API publica) |

---

### Integracao com `agent.ts`

**Mudanca necessaria em `agent.ts`:**

O campo `system` em `AiAgentOptions` passa a aceitar 3 formatos, seguindo o padrao do Claude Agent SDK:

**Modo 1: Default (omitido)** — AI monta tudo sozinha

```typescript
runAiAgent("consulta gastos", { model: "...", apiKey: "..." })
// system prompt = base + AGENTS.md/CLAUDE.md (auto-descobertos)
```

Resultado: `getSystemPrompt(tools)` + `discoverProjectContext(cwd)`

**Modo 2: Append** — AI mantem o prompt base e adiciona instrucoes do consumidor

```typescript
runAiAgent("consulta gastos", {
  model: "...", apiKey: "...",
  system: { append: "Foque em tabelas financeiras. Use sempre JOIN explicito." }
})
// system prompt = base + AGENTS.md/CLAUDE.md + append do consumidor
```

Resultado: `getSystemPrompt(tools)` + `discoverProjectContext(cwd)` + `options.system.append`

Este e o modo que o Backbone usaria para injetar SOUL.md, skills, tools e memories sem perder o prompt base da AI.

**Modo 3: Override total** — consumidor substitui tudo

```typescript
runAiAgent("consulta gastos", {
  model: "...", apiKey: "...",
  system: "Voce e um agente especializado em SQL..."
})
// system prompt = somente o que o consumidor passou
```

Resultado: apenas `options.system` (string). Sem prompt base, sem AGENTS.md/CLAUDE.md.

**Nova opcao em `AiAgentOptions`:**

| Campo | Tipo | Default | Descricao |
|-------|------|---------|-----------|
| `system` | `string \| { append: string } \| undefined` | undefined | 3 modos: omitido (auto), `{ append }` (adiciona ao base), string (substitui tudo) |
| `cwd` | string | `process.cwd()` | Diretorio de trabalho para descoberta de AGENTS.md/CLAUDE.md |

---

## Limites

### O que este PRP NAO cobre

- **Nao cria system reminders dinamicos.** O prompt e estatico por sessao. Reminders mid-conversation (como Claude Code faz) sao escopo de outro PRP.
- **Nao implementa compactacao de contexto.** Gestao de context window e um problema separado.
- **Nao define persona rica.** A identidade e minima e tecnica. Agentes com personalidade (como os do Backbone) fornecem seu proprio system prompt.
- **Nao cria prompt para heartbeat.** O SDK nao tem conceito de heartbeat — isso e do Backbone.
- **Nao traduz o prompt.** O conteudo dos `.md` e em ingles (lingua franca para modelos). O agente responde no idioma do usuario conforme instruido em `identity.md`.

### Restricoes tecnicas

- Orcamento do system prompt base: **maximo 2.000 tokens**
- Orcamento do contexto do projeto (AGENTS.md/CLAUDE.md): **maximo 4.000 tokens**
- Orcamento total (base + contexto): **maximo 6.000 tokens**
- Cada `tools/*.md`: **maximo 100 tokens**
- Os `.md` devem ser embutidos como strings no build (nao lidos do filesystem em runtime)
- Nenhum `.md` deve referenciar outro `.md` (modulos sao independentes)
- O assembler dos modulos base nao deve fazer chamadas de rede ou operacao assincrona
- A descoberta de contexto (`discoverProjectContext`) faz I/O de disco (leitura de AGENTS.md/CLAUDE.md) — e a unica excecao, executada uma vez no inicio

---

## Validacao

### Criterios de Aceite

Para cada modulo `.md`:

- [ ] Arquivo existe em `src/prompts/`
- [ ] Conteudo esta em ingles
- [ ] Conteudo nao excede o limite de tokens do modulo
- [ ] Conteudo segue o formato especificado (headers, bullets, sem exemplos longos)

Para o assembler:

- [ ] `getSystemPrompt()` e exportado por `src/index.ts`
- [ ] Recebe `activeTools: string[]` e retorna `string`
- [ ] Inclui apenas os `tools/*.md` das ferramentas presentes em `activeTools`
- [ ] Ordem de montagem: identity → tool-guide → tools → patterns → safety
- [ ] System prompt total nao excede 2.000 tokens com as 6 ferramentas atuais

Para a descoberta de contexto:

- [ ] `discoverProjectContext()` e exportado por `src/index.ts`
- [ ] Encontra `AGENTS.md` no cwd
- [ ] Encontra `CLAUDE.md` no cwd
- [ ] Sobe a arvore de diretorios ate `.git` ou raiz do filesystem
- [ ] Concatena na ordem raiz → cwd (menor → maior precedencia)
- [ ] Ignora arquivos vazios
- [ ] Trunca se total de contexto exceder 4.000 tokens
- [ ] Retorna string vazia se nenhum arquivo encontrado

Para a integracao (3 modos):

- [ ] `system` omitido → usa prompt base + AGENTS.md/CLAUDE.md auto-descobertos
- [ ] `system: { append: "..." }` → usa prompt base + AGENTS.md/CLAUDE.md + append do consumidor
- [ ] `system: "string"` → substitui tudo (sem base, sem descoberta)
- [ ] Tipo de `system` em `AiAgentOptions`: `string | { append: string } | undefined`
- [ ] Build passa sem erros (`npm run build` no workspace)

### Comando de validacao

```bash
npm run build --workspace=packages/ai-sdk
```

---

## Exemplos

### Antes — agente sem orientacao

```
User: "adiciona validacao de email no formulario"
Agent: [Bash] cat src/components/Form.tsx       ← deveria usar Read
Agent: [Edit] old_string="<input"               ← nao leu o arquivo, chuta o conteudo
Result: "Error: old_string not found"
Agent: [Edit] old_string="<input"               ← repete o mesmo erro
Result: "Error: old_string not found"
Agent: [Edit] old_string="<Input"               ← tenta variacao
Result: "Error: old_string not found"
... consome 10 steps sem progresso
```

### Depois — agente com system prompt

```
User: "adiciona validacao de email no formulario"
Agent: [Glob] **/*Form*.tsx                     ← explora antes de agir
Agent: [Read] src/components/ContactForm.tsx     ← le antes de editar
Agent: [Edit] old_string exato do arquivo        ← edita com precisao
Agent: [Read] src/components/ContactForm.tsx     ← verifica a edicao
Agent: [Bash] npm run build                      ← valida que compila
Done em 5 steps.
```
