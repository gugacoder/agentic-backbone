# S-085 — Limpeza de Arquivos Individuais e Validação Final

Remover todos os tool files individuais substituídos pelas domain tools e validar que o build compila e o total de tools fica abaixo de 128.

**Resolve:** D-010 (remover arquivos individuais), D-013 (build e smoke test)
**Score de prioridade:** 9
**Dependencia:** S-083 — todos os index files devem estar atualizados antes de remover os arquivos antigos
**PRP:** 18 — Domain Tools: Agrupamento de Tools por Domínio

---

## 1. Objetivo

Eliminar ~136 arquivos TypeScript de tools individuais que foram substituídos pelas domain tools. Após esta spec, o repositório não tem código morto de tools e o build confirma que tudo compila.

---

## 2. Alterações

### 2.1 Remover: Tools individuais do GitLab (89 arquivos)

Diretório: `apps/backbone/src/connectors/gitlab/tools/`

| Pattern | Qtd | Domain tool substituta |
|---|---|---|
| `issue-*.ts` | 13 | `issues.ts` |
| `mr-*.ts` | 16 | `mrs.ts` |
| `repo-*.ts` | 17 | `repo.ts` |
| `ci-*.ts` | 12 | `ci.ts` |
| `label-*.ts` | 5 | `labels.ts` |
| `milestone-*.ts` | 7 | `milestones.ts` |
| `release-*.ts` | 5 | `releases.ts` |
| `wiki-*.ts` | 5 | `wiki.ts` |
| `user-*.ts` | 3 | `users.ts` |
| `project-*.ts` | 6 | `projects.ts` |

**Total: 89 arquivos removidos**

Após remoção, o diretório `gitlab/tools/` deve conter apenas os 10 domain tool files: issues.ts, mrs.ts, repo.ts, ci.ts, labels.ts, milestones.ts, releases.ts, wiki.ts, users.ts, projects.ts.

### 2.2 Remover: Tools individuais do WhatsApp (36 arquivos)

Diretório: `apps/backbone/src/connectors/evolution/tools/`

| Pattern | Qtd | Domain tool substituta |
|---|---|---|
| `whatsapp-*.ts` | 35 | messaging.ts, groups.ts, contacts.ts, admin.ts |
| `evolution-api.ts` | 1 | admin.ts (action `api_raw`) |

**Total: 36 arquivos removidos**

Após remoção, o diretório `evolution/tools/` deve conter: index.ts, messaging.ts, groups.ts, contacts.ts, admin.ts.

### 2.3 Remover: Tools individuais do Email (10 arquivos)

Diretório: `apps/backbone/src/connectors/email/tools/`

Arquivos: send.ts, search.ts, read.ts, download-attachment.ts, manage-flags.ts, move.ts, delete.ts, list-mailboxes.ts, draft-create.ts, draft-send.ts

**Total: 10 arquivos removidos**

Após remoção, o diretório `email/tools/` deve conter: index.ts, email.ts.

### 2.4 Validar: Build completo

```bash
npm run build
```

O build deve completar sem erros. Nenhum import deve referenciar arquivos removidos.

### 2.5 Validar: Contagem de tools

Verificar que o agente `guga.kai` (ou equivalente com todos os connectors habilitados) tem ~45 tools no total, abaixo do limite de 128 do Groq.

Método: iniciar o backbone, fazer login, e verificar o log de composição de tools ou chamar a API de agentes para contar.

---

## 3. Regras de Implementação

- **Só remover arquivos após S-083 estar completa** — os index files devem estar atualizados
- **Verificar que nenhum outro arquivo importa os individuais** antes de remover (grep por imports)
- **Não remover `index.ts`** dos diretórios — ele é atualizado em S-083, não removido
- **Não remover domain tool files** (issues.ts, mrs.ts, etc.) — esses são os novos arquivos
- **Validação de build é obrigatória** — não considerar spec completa sem build verde

---

## 4. Critérios de Aceite

- [ ] 89 tool files individuais do GitLab removidos
- [ ] 36 tool files individuais do WhatsApp removidos (35 whatsapp-*.ts + 1 evolution-api.ts)
- [ ] 10 tool files individuais do Email removidos
- [ ] Total: ~135 arquivos removidos
- [ ] `npm run build` completa sem erros
- [ ] Nenhum import em todo o codebase referencia arquivos removidos (`grep -r "issue-list\|mr-create\|whatsapp-send-text" apps/backbone/src/`)
- [ ] Contagem total de tools do agente com todos connectors ≤ 128 (idealmente ~45)
