# S-032 — Config Versioning com Diff e Rollback

Historico automatico de todas as mudancas em arquivos de configuracao de agentes (SOUL.md, AGENT.md, etc.) com diff visual, rollback one-click e associacao a eval scores.

**Resolve:** D-047 (sem historico de versoes), G-048 (config versioning com diff e rollback)
**Score de prioridade:** 7

---

## 1. Objetivo

- Registrar automaticamente um snapshot ao salvar qualquer arquivo de configuracao de agente
- Exibir historico de versoes com diff linha a linha
- Rollback one-click para qualquer versao anterior
- Associar versao a eval score (referencia cruzada com S-019)

---

## 2. Modelo de Versoes

Versoes armazenadas em disco, proximo ao agente:

```
context/agents/{owner}.{slug}/
  SOUL.md                  # arquivo atual (producao)
  AGENT.md                 # arquivo atual
  .versions/
    SOUL.md/
      v001_2026-03-01T10-00-00Z.md
      v002_2026-03-05T14-30-00Z.md
      v003_2026-03-07T09-00-00Z.md   # versao mais recente antes da atual
    AGENT.md/
      v001_2026-03-01T10-00-00Z.md
```

---

## 3. Schema DB

### 3.1 Tabela `config_versions`

```sql
CREATE TABLE IF NOT EXISTS config_versions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id     TEXT NOT NULL,
  file_name    TEXT NOT NULL,   -- 'SOUL.md' | 'AGENT.md' | 'HEARTBEAT.md' | 'CONVERSATION.md'
  version_num  INTEGER NOT NULL,
  file_path    TEXT NOT NULL,   -- caminho relativo ao diretorio do agente
  size_bytes   INTEGER,
  change_note  TEXT,            -- descricao opcional da mudanca
  eval_run_id  INTEGER,         -- referencia a eval_runs.id (S-019), opcional
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  created_by   TEXT             -- 'system' | user_id
);

CREATE INDEX idx_versions_agent_file ON config_versions(agent_id, file_name);
```

---

## 4. Logica de Versionamento

### 4.1 Trigger de criacao de versao

Uma versao e criada automaticamente quando:
1. Arquivo e salvo via API (`PATCH /agents/:id/files/:filename`)
2. Rascunho e publicado via sandbox (S-031) — versao criada ANTES de sobrescrever
3. Rollback e executado — versao criada da versao atual antes de reverter

### 4.2 Numero de versao

- Sequencial por (agent_id, file_name): v001, v002, v003...
- Versao salva em disco: `{filename}/v{NNN}_{timestamp}.md`

### 4.3 Retencao

- Manter ultimas 50 versoes por arquivo por agente
- Versoes mais antigas sao removidas do disco e DB (FIFO)

---

## 5. API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:agentId/versions` | Listar versoes de todos os arquivos |
| GET | `/agents/:agentId/versions/:filename` | Listar versoes de um arquivo especifico |
| GET | `/agents/:agentId/versions/:filename/:versionNum` | Obter conteudo de versao especifica |
| GET | `/agents/:agentId/versions/:filename/:versionNum/diff` | Diff entre versao e anterior |
| POST | `/agents/:agentId/versions/:filename/:versionNum/rollback` | Rollback para versao |

### 5.1 GET `/agents/:agentId/versions/SOUL.md` — Response

```json
{
  "agentId": "system.main",
  "fileName": "SOUL.md",
  "versions": [
    {
      "versionNum": 3,
      "createdAt": "2026-03-07T09:00:00Z",
      "createdBy": "system",
      "sizeBytes": 1240,
      "changeNote": "Ajuste no tom de voz",
      "evalRunId": null
    },
    {
      "versionNum": 2,
      "createdAt": "2026-03-05T14:30:00Z",
      "createdBy": "admin",
      "sizeBytes": 1100,
      "evalScore": 8.4
    }
  ]
}
```

### 5.2 GET `/agents/:agentId/versions/SOUL.md/2/diff` — Response

```json
{
  "fileName": "SOUL.md",
  "from": { "versionNum": 1, "createdAt": "..." },
  "to": { "versionNum": 2, "createdAt": "..." },
  "diff": [
    { "type": "unchanged", "line": 1, "content": "# Identidade" },
    { "type": "removed", "line": 2, "content": "Voce e um assistente formal." },
    { "type": "added", "line": 2, "content": "Voce e um assistente amigavel e direto." }
  ]
}
```

### 5.3 POST `/agents/:agentId/versions/SOUL.md/2/rollback`

1. Cria versao da situacao atual (antes de reverter)
2. Copia conteudo de `v002_*.md` para `SOUL.md` (producao)
3. Insere registro na tabela `config_versions`
4. Dispara hot reload do agente

**Response 200:**
```json
{
  "rolledBackTo": 2,
  "newVersionCreated": 4,
  "reloadedAt": "2026-03-07T15:00:00Z"
}
```

---

## 6. Telas (Hub)

### 6.1 `/agents/:id` — Aba "Versoes"

- Select de arquivo: SOUL.md | AGENT.md | HEARTBEAT.md | CONVERSATION.md
- Lista de versoes: Numero, Data, Autor, Tamanho, Nota de mudanca, Eval score (se houver)
- Por versao: botoes "Ver conteudo", "Ver diff", "Restaurar"
- Badge "Atual" na versao mais recente (producao)

### 6.2 Modal "Diff de Versao"

- Header: "v{N-1} → v{N}"
- Diff visual linha a linha com cores: verde (adicionado), vermelho (removido), cinza (sem alteracao)
- Botao "Restaurar para esta versao" no rodape

### 6.3 Confirmacao de Rollback

- Dialog: "Voce esta prestes a restaurar SOUL.md para a versao {N} ({data}). O estado atual sera salvo como versao {M}. Continuar?"
- Botao "Restaurar" (destructive) + "Cancelar"

### 6.4 Integracao com Editor de Agente

- Ao salvar qualquer arquivo de agente via Hub, campo opcional "Nota sobre esta mudanca" (text input)
- Nota salva no `change_note` da versao criada

---

## 7. Criterios de Aceite

- [ ] Salvar SOUL.md ou AGENT.md via API cria automaticamente nova versao em `.versions/`
- [ ] Historico lista versoes em ordem decrescente com data, autor e tamanho
- [ ] Diff exibe linhas adicionadas/removidas/inalteradas corretamente
- [ ] Rollback restaura conteudo do arquivo e cria versao de seguranca da situacao anterior
- [ ] Rollback dispara hot reload do agente (watcher ja existente)
- [ ] Publicar rascunho (S-031) cria versao antes de sobrescrever producao
- [ ] Retencao de ate 50 versoes por arquivo (versoes mais antigas removidas automaticamente)
- [ ] Eval score e exibido na versao quando houver `eval_run_id` associado
