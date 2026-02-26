# Better KAY — Ferramentas que faltam no AI SDK

O AI SDK possui 6 ferramentas de coding (Read, Write, Edit, Bash, Glob, Grep). Esse conjunto cobre operacoes basicas de filesystem mas deixa o agente surdo, offline e incapaz de decompor trabalho. Este PRP define as ferramentas que faltam para tornar o AI competitivo com Claude Code, OpenCode e Codex CLI.

---

## Objetivo

Expandir o toolset do AI SDK de 6 para 15 ferramentas, cobrindo os gaps criticos identificados na analise comparativa com Claude Code, OpenCode e Codex CLI.

## Execution Mode

`implementar`

---

## Contexto

### Estado Atual

O AI SDK (`@agentic-backbone/ai-sdk`) expoe 6 ferramentas via `codingTools` em `src/tools/index.ts`:

| Tool | Arquivo | O que faz |
|------|---------|-----------|
| Read | read.ts | Le arquivos com offset/limit |
| Write | write.ts | Escreve arquivos, cria diretorios |
| Edit | edit.ts | Substituicao exata de strings |
| Bash | bash.ts | Executa comandos shell |
| Glob | glob.ts | Busca arquivos por padrao glob |
| Grep | grep.ts | Busca conteudo com regex via rg |

### Stack

- Runtime: Node.js (ESM)
- Framework: Vercel AI SDK v4 (`ai` package)
- Validacao: Zod v3
- Provider: OpenRouter (openrouter.ai)
- Pattern: `tool({ description, parameters: z.object(...), execute: async () => ... })`

### Padrao de Registro

Cada ferramenta e um arquivo `.ts` em `src/tools/` que exporta um `tool()`. O `index.ts` agrega tudo num objeto `codingTools` passado ao `streamText()`.

### Analise Competitiva

| Capacidade | AI | Claude Code | OpenCode | Codex |
|------------|:---:|:-----------:|:--------:|:-----:|
| File Read/Write/Edit | ✅ | ✅ | ✅ | ✅ |
| Shell Execution | ✅ | ✅ | ✅ | ✅ |
| File Search (glob) | ✅ | ✅ | ✅ | — |
| Content Search (grep) | ✅ | ✅ | ✅ | ✅ |
| Web Search | ❌ | ✅ | ✅ | ✅ |
| Web Fetch | ❌ | ✅ | ✅ | — |
| Perguntar ao usuario | ❌ | ✅ | ✅ | ✅ |
| Sub-agentes | ❌ | ✅ | ✅ | ✅ |
| Todo/Progresso | ❌ | ✅ | ✅ | ✅ |
| Planejamento | ❌ | ✅ | ✅ | ✅ |
| MultiEdit/Patch | ❌ | — | ✅ | ✅ |
| List Directory | ❌ | ✅ | ✅ | ✅ |
| LSP/Diagnostics | ❌ | ✅ | ✅ | — |
| Batch (parallel tools) | ❌ | — | ✅ | — |

---

## Especificacao

### Ferramentas a Criar

As ferramentas estao organizadas em 4 sprints por ordem de impacto. Cada ferramenta segue o mesmo padrao existente: um arquivo em `src/tools/`, exportando um `tool()` do Vercel AI SDK, com schema Zod.

---

### Sprint 1 — Fundacao (o agente deixa de ser surdo e offline)

#### T01: AskUser

O agente consegue fazer perguntas ao usuario durante a execucao.

| Campo | Valor |
|-------|-------|
| Nome da tool | `AskUser` |
| Arquivo | `src/tools/ask-user.ts` |
| Proposito | Pedir clarificacoes, preferencias ou decisoes ao usuario |

**Parametros:**

| Param | Tipo | Obrigatorio | Descricao |
|-------|------|:-----------:|-----------|
| question | string | sim | A pergunta a fazer ao usuario |
| options | string[] | nao | Opcoes de resposta (se aplicavel) |

**Retorno:** string com a resposta do usuario.

**Mecanismo de entrega:** A ferramenta deve emitir um evento do tipo `"ask_user"` no `AsyncGenerator<AiAgentEvent>` e aguardar a resposta antes de retornar. O consumidor do SDK (CLI, API, UI) e responsavel por apresentar a pergunta e devolver a resposta.

**Novo evento necessario em `AiAgentEvent`:**

```
{ type: "ask_user", question: string, options?: string[] }
```

---

#### T02: WebFetch

O agente consegue ler conteudo de URLs.

| Campo | Valor |
|-------|-------|
| Nome da tool | `WebFetch` |
| Arquivo | `src/tools/web-fetch.ts` |
| Proposito | Buscar conteudo de uma URL e retornar como texto/markdown |

**Parametros:**

| Param | Tipo | Obrigatorio | Descricao |
|-------|------|:-----------:|-----------|
| url | string | sim | URL para buscar |
| prompt | string | nao | Instrucao de extração — o que buscar no conteudo |

**Retorno:** string com o conteudo convertido para markdown/texto.

**Comportamento:**
- Converter HTML para markdown (usar biblioteca como `turndown` ou similar)
- Timeout de 30 segundos
- Limite de 50KB no conteudo retornado
- Truncar se exceder

---

#### T03: WebSearch

O agente consegue pesquisar na web.

| Campo | Valor |
|-------|-------|
| Nome da tool | `WebSearch` |
| Arquivo | `src/tools/web-search.ts` |
| Proposito | Pesquisar na web e retornar resultados |

**Parametros:**

| Param | Tipo | Obrigatorio | Descricao |
|-------|------|:-----------:|-----------|
| query | string | sim | Termo de busca |
| numResults | number | nao | Quantidade de resultados (default: 5) |

**Retorno:** string formatada com titulo, URL e snippet de cada resultado.

**Decisao de provider:** O default e a [Brave Search API](https://brave.com/search/api/) — indice proprio, estavel, sem bloqueio, $5/mes em creditos gratis (~1.000 buscas). O provider e plugavel via opcao em `AiAgentOptions` caso o consumidor queira usar outro (Tavily, Serper, SearXNG, etc.).

**Ativacao condicional:** WebSearch requer `BRAVE_API_KEY` (ou chave do provider configurado) em variavel de ambiente. Se a chave nao existir, a ferramenta **nao e registrada** em `codingTools` — o agente funciona normalmente sem ela, apenas sem capacidade de busca web. Isso segue o mesmo padrao do Backbone com `OPENAI_API_KEY` e memories.

---

### Sprint 2 — Autonomia (o agente decompoe e organiza trabalho)

#### T04: Task (Sub-agente)

O agente consegue delegar tarefas a sub-agentes.

| Campo | Valor |
|-------|-------|
| Nome da tool | `Task` |
| Arquivo | `src/tools/task.ts` |
| Proposito | Lancar um sub-agente para executar uma tarefa autonomamente |

**Parametros:**

| Param | Tipo | Obrigatorio | Descricao |
|-------|------|:-----------:|-----------|
| description | string | sim | Descricao curta da tarefa (3-5 palavras) |
| prompt | string | sim | Instrucoes detalhadas para o sub-agente |

**Retorno:** string com o resultado do sub-agente.

**Comportamento:**
- O sub-agente recebe as mesmas ferramentas (`codingTools`) que o agente principal
- Executa numa sessao isolada (sem acesso ao historico do agente pai)
- Herda model e apiKey do agente pai
- Usa `runAiAgent()` internamente — a AI chama a si mesma
- Respeita o `maxSteps` configurado (ou um sub-limite menor)

---

#### T05: TodoWrite

O agente consegue criar e atualizar uma lista de tarefas.

| Campo | Valor |
|-------|-------|
| Nome da tool | `TodoWrite` |
| Arquivo | `src/tools/todo.ts` |
| Proposito | Criar/atualizar lista de tarefas para tracking de progresso |

**Parametros:**

| Param | Tipo | Obrigatorio | Descricao |
|-------|------|:-----------:|-----------|
| todos | array | sim | Array de `{ id: string, content: string, status: "pending" \| "in_progress" \| "completed", priority: "high" \| "medium" \| "low" }` |

**Retorno:** string confirmando a atualizacao.

**Comportamento:**
- A lista vive em memoria durante a sessao
- Emitir evento `"todo_update"` no AsyncGenerator para que o consumidor possa renderizar
- Substituicao completa a cada chamada (o agente envia a lista inteira)

**Novo evento necessario em `AiAgentEvent`:**

```
{ type: "todo_update", todos: Array<{ id, content, status, priority }> }
```

---

#### T06: TodoRead

O agente consegue ler a lista de tarefas atual.

| Campo | Valor |
|-------|-------|
| Nome da tool | `TodoRead` |
| Arquivo | `src/tools/todo.ts` (mesmo arquivo que TodoWrite) |
| Proposito | Ler a lista de tarefas atual da sessao |

**Parametros:** nenhum.

**Retorno:** string com a lista formatada, ou "Nenhuma tarefa registrada." se vazia.

---

### Sprint 3 — Qualidade (o agente edita melhor e entende o codigo)

#### T07: MultiEdit

O agente consegue fazer multiplas edicoes atomicas num mesmo arquivo.

| Campo | Valor |
|-------|-------|
| Nome da tool | `MultiEdit` |
| Arquivo | `src/tools/multi-edit.ts` |
| Proposito | Aplicar multiplas substituicoes num unico arquivo em uma operacao atomica |

**Parametros:**

| Param | Tipo | Obrigatorio | Descricao |
|-------|------|:-----------:|-----------|
| file_path | string | sim | Caminho absoluto do arquivo |
| edits | array | sim | Array de `{ old_string: string, new_string: string, replace_all?: boolean }` |

**Retorno:** string confirmando quantas edicoes foram aplicadas.

**Comportamento:**
- Edicoes aplicadas sequencialmente na ordem do array
- Se qualquer edicao falhar (old_string nao encontrado), nenhuma e aplicada (atomico)
- Reutilizar a logica do Edit existente internamente

---

#### T08: ListDir

O agente consegue listar o conteudo de um diretorio de forma estruturada.

| Campo | Valor |
|-------|-------|
| Nome da tool | `ListDir` |
| Arquivo | `src/tools/list-dir.ts` |
| Proposito | Listar arquivos e pastas de um diretorio como arvore |

**Parametros:**

| Param | Tipo | Obrigatorio | Descricao |
|-------|------|:-----------:|-----------|
| path | string | sim | Caminho absoluto do diretorio |
| depth | number | nao | Profundidade maxima (default: 3) |
| ignore | string[] | nao | Padroes glob para ignorar (default: `["node_modules", ".git", "dist", "build"]`) |

**Retorno:** string com arvore de diretorio indentada.

---

#### T09: Diagnostics

O agente consegue verificar erros no codigo apos edicoes.

| Campo | Valor |
|-------|-------|
| Nome da tool | `Diagnostics` |
| Arquivo | `src/tools/diagnostics.ts` |
| Proposito | Executar checagem de tipos/lint e retornar erros |

**Parametros:**

| Param | Tipo | Obrigatorio | Descricao |
|-------|------|:-----------:|-----------|
| command | string | nao | Comando de diagnostico (default: `"npx tsc --noEmit"`) |
| file_path | string | nao | Filtrar erros para um arquivo especifico |

**Retorno:** string com os erros encontrados, ou "Nenhum erro encontrado." se limpo.

**Decisao:** Essa ferramenta e um wrapper inteligente sobre o Bash que formata a saida de checadores de tipo/lint de forma estruturada para o agente. Nao e LSP — e pragmatico.

---

### Sprint 4 — Diferencial (o agente ganha superpoderes)

#### T10: Batch

O agente consegue executar multiplas ferramentas em paralelo.

| Campo | Valor |
|-------|-------|
| Nome da tool | `Batch` |
| Arquivo | `src/tools/batch.ts` |
| Proposito | Executar 2-10 chamadas de ferramentas simultaneamente |

**Parametros:**

| Param | Tipo | Obrigatorio | Descricao |
|-------|------|:-----------:|-----------|
| tool_calls | array | sim | Array de `{ tool: string, parameters: object }` (min 2, max 10) |

**Retorno:** string com o resultado de cada chamada, indexado.

**Comportamento:**
- Executar todas as chamadas com `Promise.all()`
- Falhas parciais nao cancelam as outras
- Nao permitir Batch dentro de Batch
- Referenciar ferramentas pelo nome registrado em `codingTools`

---

#### T11: ApplyPatch

O agente consegue aplicar patches multi-arquivo num formato diff simplificado.

| Campo | Valor |
|-------|-------|
| Nome da tool | `ApplyPatch` |
| Arquivo | `src/tools/apply-patch.ts` |
| Proposito | Criar, modificar, mover e deletar multiplos arquivos numa unica operacao |

**Parametros:**

| Param | Tipo | Obrigatorio | Descricao |
|-------|------|:-----------:|-----------|
| patch | string | sim | Texto do patch no formato envelope |

**Formato do patch:**

```
*** Begin Patch
*** Add File: path/to/new-file.ts
+linha adicionada
+outra linha
*** Update File: path/to/existing.ts
@@ context line
-linha removida
+linha adicionada
*** Delete File: path/to/old.ts
*** End Patch
```

**Retorno:** string com resumo das operacoes executadas.

---

#### T12: CodeSearch

O agente consegue buscar exemplos de codigo e documentacao online.

| Campo | Valor |
|-------|-------|
| Nome da tool | `CodeSearch` |
| Arquivo | `src/tools/code-search.ts` |
| Proposito | Buscar exemplos de codigo, docs de APIs e padroes de bibliotecas |

**Parametros:**

| Param | Tipo | Obrigatorio | Descricao |
|-------|------|:-----------:|-----------|
| query | string | sim | Busca sobre APIs, bibliotecas, padroes |

**Retorno:** string com exemplos de codigo e trechos de documentacao encontrados.

**Decisao de provider:** Usa o mesmo provider de WebSearch (Brave Search API por default). Plugavel via opcao no SDK.

**Ativacao condicional:** Mesma regra de WebSearch — so registrada se a chave do provider existir.

---

## Limites

### O que este PRP NAO cobre

- **Nao muda a arquitetura do SDK.** As ferramentas novas seguem exatamente o mesmo padrao das 6 existentes. Nao ha refatoracao.
- **Nao muda o `runAiAgent()`.** A unica mudanca na funcao e suportar os novos eventos (`ask_user`, `todo_update`). O loop de streaming continua igual.
- **Nao implementa multi-agente com coordenacao.** O `Task` (T04) lanca sub-agentes fire-and-forget. Nao ha comunicacao bidirecional, times, ou broadcasts.
- **Nao implementa LSP real.** O `Diagnostics` (T09) executa comandos de CLI (tsc, eslint), nao conecta num Language Server.
- **Nao cria CLI ou UI.** As ferramentas sao SDK-only. Quem consome o SDK e responsavel pela apresentacao.
- **Nao adiciona testes.** O projeto nao tem framework de testes configurado (conforme CLAUDE.md).

### Restricoes tecnicas

- Todas as ferramentas devem ser ESM-only (`.js` extensions em imports)
- Todos os parametros validados com Zod
- Ferramentas que dependem de API key externa (WebSearch, CodeSearch) sao de **ativacao condicional** — so registradas em `codingTools` se a chave existir em variavel de ambiente. O SDK deve funcionar out-of-the-box sem nenhuma chave externa
- Providers de busca devem ser plugaveis via `AiAgentOptions`
- Output de ferramentas limitado a 50KB (consistente com o padrao existente de 30KB no Bash/Grep, com margem)
- Ferramentas nao devem ter estado global mutavel (exceto TodoRead/TodoWrite que compartilham estado de sessao)

---

## Validacao

### Criterios de Aceite

Para cada ferramenta:

- [ ] Arquivo `.ts` criado em `src/tools/`
- [ ] Exportado e registrado em `src/tools/index.ts` dentro de `codingTools`
- [ ] Schema Zod com `description` em todos os parametros
- [ ] Funcao `execute` retorna string
- [ ] Build passa sem erros (`npm run build` no workspace)

### Para o milestone completo:

- [ ] `codingTools` exporta no minimo 13 ferramentas sem chave externa (6 existentes + 7 novas obrigatorias)
- [ ] Com `BRAVE_API_KEY` configurada, exporta 15 ferramentas (+WebSearch, +CodeSearch)
- [ ] Sem `BRAVE_API_KEY`, o SDK funciona normalmente sem WebSearch e CodeSearch
- [ ] Novos eventos (`ask_user`, `todo_update`) tipados em `AiAgentEvent`
- [ ] O agente consegue usar todas as ferramentas disponiveis numa sessao real via OpenRouter
- [ ] Nenhuma ferramenta existente quebrou

### Comando de validacao

```bash
npm run build --workspace=packages/ai-sdk
```

---

## Exemplos

### Antes (agente tenta buscar documentacao e nao consegue)

```
User: "como usar o zod v4?"
Agent: *nao tem como buscar na web*
Agent: "Baseado no meu conhecimento ate [cutoff]..."
```

### Depois (agente busca, le, e responde com informacao atualizada)

```
User: "como usar o zod v4?"
Agent: [chama WebSearch("zod v4 migration guide")]
Agent: [chama WebFetch("https://zod.dev/v4")]
Agent: "De acordo com a documentacao oficial do Zod v4..."
```

### Antes (agente nao sabe o que o usuario quer)

```
User: "refatora o modulo de auth"
Agent: *assume decisoes sozinho, faz errado*
```

### Depois (agente pergunta antes de agir)

```
User: "refatora o modulo de auth"
Agent: [chama AskUser("Qual aspecto da auth voce quer refatorar?", ["Extrair middleware", "Trocar JWT por sessions", "Separar routes"])]
User: "Extrair middleware"
Agent: *age com precisao*
```
