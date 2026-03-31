# Brainstorming — Sprint 15
## PRP 18: Domain Tools — Agrupamento de Tools por Dominio

---

## Contexto

O objetivo desta wave é consolidar as tools de connectors de alto volume (GitLab ~89, WhatsApp ~37, Email ~11) em "domain tools" — uma tool por domínio com parâmetro `action` discriminado via Zod. O resultado esperado é reduzir o agente `guga.kai` de ~168 tools para ~45 tools, eliminando o bloqueio do Groq (limite 128 tools) e melhorando qualidade de seleção do modelo.

A tarefa não altera `@agentic-backbone/gitlab-v4`, `ConnectorDef.createTools()`, nem `composeAgentTools`. O agrupamento é interno a cada connector. O padrão é `z.discriminatedUnion("action", [...])` com campo `adapter`/`instance` no `.and()`.

---

## Funcionalidades Mapeadas (estado atual do código)

### GitLab (`apps/backbone/src/connectors/gitlab/tools/`)
- **89 arquivos individuais** confirmados via `ls`: ci-*.ts (12), issue-*.ts (13), label-*.ts (5), milestone-*.ts (7), mr-*.ts (16), project-*.ts (6), release-*.ts (5), repo-*.ts (17), user-*.ts (3), wiki-*.ts (5)
- `gitlab/index.ts` importa cada tool individualmente com `createGitLab*Tool(adapters)`
- **Nenhuma domain tool criada** — tudo ainda em arquivos individuais

### WhatsApp/Evolution (`apps/backbone/src/connectors/evolution/tools/`)
- **35 arquivos whatsapp-*.ts + 1 evolution-api.ts** confirmados
- `tools/index.ts` existente (exporta todas individualmente)
- **Nenhuma domain tool criada**

### Email (`apps/backbone/src/connectors/email/tools/`)
- **10 arquivos individuais**: send.ts, search.ts, read.ts, download-attachment.ts, draft-create.ts, draft-send.ts, list-mailboxes.ts, manage-flags.ts, move.ts, delete.ts + index.ts
- **Nenhuma domain tool criada**

### Implantacao (`apps/backbone/src/connectors/implantacao/index.ts`)
- Wrapper do GitLab: importa 28 das 89 tools individuais do GitLab
- Precisará ser atualizado para importar as 10 domain tools do GitLab

### Settings (`apps/backbone/src/settings/llm.ts`)
- `PROVIDER_CONFIGS` tem tipo `Record<LlmProvider, { baseURL: string; apiKeyEnv: string }>` — **sem `maxTools`**
- `getProviderConfig()` expõe o objeto — já é a interface a estender

### Agent (`apps/backbone/src/agent/index.ts`)
- `tools` é passado como `options?.tools` direto para o ai-sdk
- **Nenhum warning de maxTools** implementado

---

## Lacunas e Oportunidades

### Lacunas técnicas identificadas

1. **Policy check no execute**: Os arquivos individuais atuais já têm lógica de policy (readonly/readwrite). As domain tools precisam reimplementar esse check internamente — risco de regressão se omitido.

2. **Discriminated union Zod com `.and()`**: O Vercel AI SDK usa `parameters` do Zod para gerar o JSON Schema da tool. Combinações `z.discriminatedUnion().and(z.object())` geram JSON Schema com `allOf` — comportamento precisa ser validado com o AI SDK antes do build final.

3. **`implantacao` passa a expor mais actions**: Antes expunha 28 tools individuais; depois importa domain tools completas (~89 actions agrupadas em 10 tools). Comportamento diferente mas aceitável — documentado no TASK.md.

4. **Remoção dos arquivos antigos (Fase 5)**: Os 89 arquivos GitLab + 36 evolution + 10 email precisam ser deletados. Se `gitlab/index.ts` e `implantacao/index.ts` ainda tiverem imports dos arquivos antigos, o build vai falhar. A ordem de execução deve garantir que as fases 2a-2d precedam a fase 5.

5. **Groq não está em `LlmProvider` enum**: `PROVIDER_CONFIGS` pode não ter uma entrada `groq` ainda — confirmar antes de adicionar `maxTools: 128`.

### Oportunidades

6. **Pattern reutilizável**: O `createGitLabIssuesTool` pattern (factory function recebendo `adapters[]`) já está estabelecido nos arquivos individuais. As domain tools seguem exatamente o mesmo contrato — risco baixo de quebra de interface.

7. **whatsapp_api_raw migração**: O `evolution-api.ts` (fallback genérico) migra para action `api_raw` no `whatsapp_admin` — oportunidade de simplificar o fallback sem perder funcionalidade.

---

## Priorizacao

| Rank | Discovery | Score | Justificativa |
|---|---|---|---|
| 1 | D-001: GitLab domain tools (10 arquivos) | 10 | Maior impacto — 89→10; desbloqueador principal do limite Groq |
| 2 | D-002: WhatsApp domain tools (4 arquivos) | 9 | Segundo maior volume — 37→4; independente do GitLab |
| 3 | D-003: Email domain tool (1 arquivo) | 8 | 11→1; menor esforço; completa cobertura dos 3 connectors-alvo |
| 4 | D-004: Atualizar gitlab/index.ts | 8 | Ativa as domain tools no connector; depende de D-001 |
| 5 | D-005: Atualizar evolution/tools/index.ts | 8 | Ativa as domain tools WhatsApp; depende de D-002 |
| 6 | D-006: Atualizar email/tools/index.ts | 7 | Ativa domain tool email; depende de D-003 |
| 7 | D-007: Atualizar implantacao/index.ts | 7 | Remove 28 imports individuais; depende de D-001 |
| 8 | D-008: maxTools em PROVIDER_CONFIGS (llm.ts) | 6 | Infraestrutura para warning; independente das domain tools |
| 9 | D-009: Warning em agent/index.ts | 6 | Alerta operacional; depende de D-008 |
| 10 | D-010: Remover arquivos individuais antigos | 9 | Limpeza crítica — sem isso o repo fica com código morto; depende das fases 2a-2d |
| 11 | D-011: Validar Zod discriminatedUnion + .and() com AI SDK | 7 | Risco técnico — JSON Schema gerado pode ter allOf incompatível |
| 12 | D-012: Policy check readonly nas domain tools | 7 | Regressão potencial — ações de escrita precisam verificar policy |
| 13 | D-013: Build e smoke test com plano Groq | 8 | Validação final do objetivo principal (limite 128 tools) |
