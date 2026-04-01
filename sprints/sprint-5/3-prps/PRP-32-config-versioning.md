# PRP-32 — Config Versioning com Diff e Rollback

Historico automatico de versoes de arquivos de configuracao de agentes (SOUL.md, AGENT.md, etc.) com diff linha a linha, rollback one-click e retencao de ate 50 versoes por arquivo.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Nao ha historico de mudancas em arquivos de agentes. Salvar SOUL.md sobrescreve a versao anterior sem registro. Nao ha como reverter para um estado anterior. Nao ha tabela `config_versions` no SQLite.

### Estado desejado

1. Tabela `config_versions` no SQLite
2. Criacao automatica de versao ao salvar qualquer arquivo de agente via API
3. Endpoints para listar, obter, diff e rollback de versoes
4. Aba "Versoes" na pagina do agente no Hub com diff visual e botao de rollback

## Especificacao

### Feature F-123: Tabela config_versions + migracao + logica de criacao automatica

**Nova tabela em `apps/backbone/src/db/`:**

```sql
CREATE TABLE IF NOT EXISTS config_versions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id     TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  version_num  INTEGER NOT NULL,
  file_path    TEXT NOT NULL,
  size_bytes   INTEGER,
  change_note  TEXT,
  eval_run_id  INTEGER,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  created_by   TEXT
);
CREATE INDEX idx_versions_agent_file ON config_versions(agent_id, file_name);
```

Adicionar migracao no startup do backbone.

**Modelo de versoes em disco:**

```
context/agents/{owner}.{slug}/
  SOUL.md         # arquivo atual (producao)
  .versions/
    SOUL.md/
      v001_2026-03-01T10-00-00Z.md
      v002_2026-03-05T14-30-00Z.md
    AGENT.md/
      v001_2026-03-01T10-00-00Z.md
```

**Modulo `src/versions/version-manager.ts`:**

```typescript
// Cria versao antes de sobrescrever arquivo
createVersion(agentId, fileName, currentContent, opts?: { changeNote, evalRunId, createdBy }): Promise<number>

// Retorna proximo numero de versao sequencial por (agentId, fileName)
nextVersionNum(agentId, fileName): Promise<number>

// Aplica retencao: remove versoes mais antigas alem do limite de 50
pruneVersions(agentId, fileName, keepCount?: number): Promise<void>
```

**Trigger automatico:** estender o endpoint `PATCH /agents/:id/files/:filename` (existente ou a criar) para chamar `createVersion()` antes de sobrescrever. Retencao aplicada apos salvar (remove versoes alem de 50).

### Feature F-124: Endpoints de versoes (list, get, diff, rollback)

**Novas rotas em `apps/backbone/src/routes/versions.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:agentId/versions` | Listar versoes de todos os arquivos |
| GET | `/agents/:agentId/versions/:filename` | Listar versoes de um arquivo |
| GET | `/agents/:agentId/versions/:filename/:versionNum` | Conteudo de versao especifica |
| GET | `/agents/:agentId/versions/:filename/:versionNum/diff` | Diff entre versao e anterior |
| POST | `/agents/:agentId/versions/:filename/:versionNum/rollback` | Rollback para versao |

**GET `/versions/:filename` — response:**
```json
{
  "agentId": "system.main",
  "fileName": "SOUL.md",
  "versions": [
    { "versionNum": 3, "createdAt": "...", "createdBy": "admin", "sizeBytes": 1240, "changeNote": "Ajuste no tom" }
  ]
}
```

**GET `/versions/:filename/:versionNum/diff` — response:**
```json
{
  "fileName": "SOUL.md",
  "from": { "versionNum": 2 },
  "to": { "versionNum": 3 },
  "diff": [
    { "type": "unchanged", "line": 1, "content": "# Identidade" },
    { "type": "removed", "line": 2, "content": "Voce e um assistente formal." },
    { "type": "added", "line": 2, "content": "Voce e um assistente amigavel." }
  ]
}
```

Implementar diff linha a linha sem dependencias externas (split por `\n`, LCS simples ou comparacao sequencial).

**POST `/versions/:filename/:versionNum/rollback`:**
1. Criar versao da situacao atual (`created_by: "system"`, `change_note: "Rollback para v{N}"`)
2. Copiar conteudo da versao target para o arquivo de producao
3. Inserir registro em `config_versions`
4. Disparar hot reload do agente (watcher existente)
5. Retornar `{ rolledBackTo, newVersionCreated, reloadedAt }`

Montar rotas no `index.ts` do backbone.

**Hub — `apps/hub/src/api/versions.ts`:**

```typescript
export const versionsQueryOptions = (agentId: string, fileName: string) =>
  queryOptions({
    queryKey: ["versions", agentId, fileName],
    queryFn: () => request<VersionList>(`/agents/${agentId}/versions/${fileName}`),
  });
```

### Feature F-125: Telas Hub — aba Versoes, diff visual, rollback

**Nova aba "Versoes"** na pagina do agente (`/agents/:id`) com rota `routes/_authenticated/agents/$agentId/versions.tsx`.

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `VersionsTab` | `routes/_authenticated/agents/$agentId/versions.tsx` |
| `VersionList` | `components/versions/version-list.tsx` |
| `DiffModal` | `components/versions/diff-modal.tsx` |
| `RollbackDialog` | `components/versions/rollback-dialog.tsx` |

**VersionsTab:**
- Select de arquivo: SOUL.md | AGENT.md | HEARTBEAT.md | CONVERSATION.md
- Lista de versoes: Numero, Data, Autor, Tamanho, Nota de mudanca, Eval score (se `eval_run_id`)
- Badge "Atual" na versao mais recente
- Por versao: botoes "Ver conteudo", "Ver diff", "Restaurar"

**DiffModal:**
- Header: "v{N-1} → v{N}"
- Diff visual linha a linha: verde (adicionado), vermelho (removido), cinza (inalterado)
- Botao "Restaurar para esta versao" no rodape (abre RollbackDialog)

**RollbackDialog:**
- Texto: "Voce esta prestes a restaurar {fileName} para a versao {N} ({data}). O estado atual sera salvo como versao {M}."
- Botao "Restaurar" (destrutivo) + "Cancelar"

**Integracao com editor de agente:**
- Ao salvar qualquer arquivo de agente via Hub, campo opcional "Nota sobre esta mudanca" (text input)
- Nota salva no `change_note` da versao criada

## Limites

- **NAO** implementar diff entre versoes nao-consecutivas via GUI (apenas versao vs. anterior)
- **NAO** implementar branching de versoes
- **NAO** versionamento de arquivos fora do diretorio do agente (ex: skills, tools)

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado
- **PRP-03** (Gestao de Agentes) deve estar implementado — nova aba adicionada

## Validacao

- [ ] Salvar SOUL.md ou AGENT.md via API cria automaticamente nova versao em `.versions/`
- [ ] Historico lista versoes em ordem decrescente com data, autor e tamanho
- [ ] Diff exibe linhas adicionadas/removidas/inalteradas corretamente
- [ ] Rollback restaura conteudo do arquivo e cria versao de seguranca do estado anterior
- [ ] Rollback dispara hot reload do agente
- [ ] Publicar rascunho (PRP-31) cria versao antes de sobrescrever producao
- [ ] Retencao de ate 50 versoes por arquivo (versoes mais antigas removidas automaticamente)
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-123 Tabela + migracao + logica de versao | S-032 sec 2, 3, 4 | D-047 |
| F-124 Endpoints list/get/diff/rollback | S-032 sec 5 | G-048 |
| F-125 Telas Hub versoes + diff + rollback | S-032 sec 6 | G-048 |
