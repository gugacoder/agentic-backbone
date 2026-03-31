# PRP-18F — Limpeza de Arquivos Individuais e Validacao Final

Remover todos os tool files individuais substituidos pelas domain tools e validar que o build compila e o total de tools fica abaixo de 128.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Apos PRP-18A/B/C/D, o repositorio contem tanto os domain tool files novos quanto os ~135 tool files individuais antigos. Os index files ja foram atualizados para importar as domain tools — os arquivos antigos sao codigo morto.

### Estado desejado

Somente os domain tool files permanecem. Build compila sem erros. Total de tools do agente com todos connectors habilitados <= 128 (idealmente ~45).

### Dependencias

- **PRP-18D** — todos os index files devem estar atualizados antes de remover os arquivos antigos

## Especificacao

### Feature F-321: Remover tools individuais do GitLab

**Spec:** S-085 secao 2.1

Remover 89 arquivos de `apps/backbone/src/connectors/gitlab/tools/`:

| Pattern | Qtd | Domain tool substituta |
|---|---|---|
| `issue-*.ts` | 13 | issues.ts |
| `mr-*.ts` | 16 | mrs.ts |
| `repo-*.ts` | 17 | repo.ts |
| `ci-*.ts` | 12 | ci.ts |
| `label-*.ts` | 5 | labels.ts |
| `milestone-*.ts` | 7 | milestones.ts |
| `release-*.ts` | 5 | releases.ts |
| `wiki-*.ts` | 5 | wiki.ts |
| `user-*.ts` | 3 | users.ts |
| `project-*.ts` | 6 | projects.ts |

Apos remocao, o diretorio `gitlab/tools/` deve conter apenas: issues.ts, mrs.ts, repo.ts, ci.ts, labels.ts, milestones.ts, releases.ts, wiki.ts, users.ts, projects.ts.

### Feature F-322: Remover tools individuais do WhatsApp

**Spec:** S-085 secao 2.2

Remover 36 arquivos de `apps/backbone/src/connectors/evolution/tools/`:

| Pattern | Qtd | Domain tool substituta |
|---|---|---|
| `whatsapp-*.ts` | 35 | messaging.ts, groups.ts, contacts.ts, admin.ts |
| `evolution-api.ts` | 1 | admin.ts (action `api_raw`) |

Apos remocao, o diretorio `evolution/tools/` deve conter: index.ts, messaging.ts, groups.ts, contacts.ts, admin.ts.

### Feature F-323: Remover tools individuais do Email

**Spec:** S-085 secao 2.3

Remover 10 arquivos de `apps/backbone/src/connectors/email/tools/`:
send.ts, search.ts, read.ts, download-attachment.ts, manage-flags.ts, move.ts, delete.ts, list-mailboxes.ts, draft-create.ts, draft-send.ts

Apos remocao, o diretorio `email/tools/` deve conter: index.ts, email.ts.

### Feature F-324: Build e validacao final

**Spec:** S-085 secoes 2.4 e 2.5

1. Executar `npm run build` — deve completar sem erros
2. Verificar que nenhum import em todo o codebase referencia arquivos removidos
3. Confirmar que o total de tools do agente com todos connectors <= 128

#### Validacao de imports

```bash
grep -r "issue-list\|mr-create\|whatsapp-send-text" apps/backbone/src/
```

Deve retornar zero resultados.

## Limites

- **NAO** remover `index.ts` dos diretorios — eles foram atualizados no PRP-18D
- **NAO** remover domain tool files (issues.ts, mrs.ts, etc.)
- **NAO** considerar spec completa sem build verde
- **NAO** remover antes de PRP-18D estar completo

## Validacao

- [ ] 89 tool files individuais do GitLab removidos
- [ ] 36 tool files individuais do WhatsApp removidos (35 whatsapp-*.ts + 1 evolution-api.ts)
- [ ] 10 tool files individuais do Email removidos
- [ ] Total: ~135 arquivos removidos
- [ ] `npm run build` completa sem erros
- [ ] Nenhum import em todo o codebase referencia arquivos removidos
- [ ] Contagem total de tools do agente com todos connectors <= 128 (idealmente ~45)

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-321 Limpeza GitLab | S-085 | D-010 |
| F-322 Limpeza WhatsApp | S-085 | D-010 |
| F-323 Limpeza Email | S-085 | D-010 |
| F-324 Build e validacao | S-085 | D-013 |
