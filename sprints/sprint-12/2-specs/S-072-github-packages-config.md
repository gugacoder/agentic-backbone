# S-072 — Configuração GitHub Packages

Configurar publicação dos pacotes `ai-sdk` e `ai-chat` no GitHub Packages.

**Resolve:** AC-017 (configuração GitHub Packages ausente)
**Score de prioridade:** 6
**Dependência:** S-056 (scaffold ai-chat)
**PRP:** 15 — ai-chat: Pacote React de Chat Rico

---

## 1. Objetivo

- Configurar `publishConfig` e `repository` nos `package.json` de `ai-sdk` e `ai-chat`
- Criar `.npmrc` na raiz do monorepo com registry GitHub Packages para o scope `@agentic-backbone`
- Adicionar scripts `publish:packages` e `version:packages` no `package.json` raiz
- Criar `CHANGELOG.md` template em cada pacote

---

## 2. Alterações

### 2.1 Modificar: `apps/packages/ai-sdk/package.json`

Adicionar:
```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/gugacoder/agentic-backbone.git",
    "directory": "apps/packages/ai-sdk"
  }
}
```

### 2.2 Modificar: `apps/packages/ai-chat/package.json`

Adicionar mesma configuração com `directory: "apps/packages/ai-chat"`.

### 2.3 Criar: `.npmrc` na raiz (NOVO)

```
@agentic-backbone:registry=https://npm.pkg.github.com
```

### 2.4 Modificar: `package.json` raiz — scripts de publicação

```json
{
  "scripts": {
    "version:packages": "npm version patch --workspace=apps/packages/ai-sdk && npm version patch --workspace=apps/packages/ai-chat",
    "publish:packages": "npm publish --workspace=apps/packages/ai-sdk && npm publish --workspace=apps/packages/ai-chat"
  }
}
```

### 2.5 Criar: `CHANGELOG.md` em cada pacote (NOVO)

Template mínimo:
```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-03-29

### Added
- Initial release
```

---

## 3. Regras de Implementação

- **GitHub Packages** requer autenticação — `.npmrc` não deve conter tokens (tokens vão em env)
- **Scope `@agentic-backbone`** consistente com nomes existentes
- **URL do repositório** deve apontar para o repo correto no GitHub
- **Não publicar ainda** — esta spec apenas configura; publicação é ação manual

---

## 4. Critérios de Aceite

- [ ] `publishConfig.registry` aponta para `https://npm.pkg.github.com` nos dois pacotes
- [ ] `repository` com URL e directory corretos nos dois pacotes
- [ ] `.npmrc` na raiz com registry do scope `@agentic-backbone`
- [ ] Scripts `version:packages` e `publish:packages` existem na raiz
- [ ] `CHANGELOG.md` existe em `apps/packages/ai-sdk/` e `apps/packages/ai-chat/`
- [ ] Nenhum token ou secret commitado
