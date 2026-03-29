# PRP-15E — Integracao, Refatoracao Hub e Distribuicao

Registrar o pacote no workspace, refatorar o Hub para usar `<Chat />` e configurar publicacao via GitHub Packages.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O pacote `@agentic-backbone/ai-chat` esta completo (PRP-15A a PRP-15D) com todos os componentes, mas:

- O pacote nao esta instalado no workspace — imports cross-workspace nao funcionam
- O Hub continua usando `chat-stream.ts` manual e componentes acoplados
- Nenhum dos dois pacotes (`ai-sdk`, `ai-chat`) tem configuracao de publicacao GitHub Packages

### Estado desejado

1. Pacote registrado no workspace, `npm install` executado, imports cross-workspace funcionais
2. Hub refatorado — `conversation-chat.tsx` usa `<Chat />`, 5 arquivos redundantes removidos
3. GitHub Packages configurado — `publishConfig`, `.npmrc`, scripts de publicacao

### Dependencias

- **PRP-15D** — Chat.tsx e todos os exports devem estar completos
- **PRP-15A** — scaffold com package.json (para configuracao GitHub Packages)

## Especificacao

### Feature F-194: Registrar no Workspace + Instalar Deps

**Spec:** S-070

1. Verificar que glob `"apps/packages/*"` no `package.json` raiz cobre `apps/packages/ai-chat`. Se nao cobrir, adicionar explicitamente.

2. Executar `npm install` para resolver todas as dependencias.

3. Verificar symlink: `node_modules/@agentic-backbone/ai-chat` → `apps/packages/ai-chat`

4. Adicionar dependencia nos consumidores:

```json
// apps/hub/package.json
"dependencies": {
  "@agentic-backbone/ai-chat": "*"
}

// apps/chat/package.json
"dependencies": {
  "@agentic-backbone/ai-chat": "*"
}
```

5. Verificar import cross-workspace:
```typescript
import { Chat } from "@agentic-backbone/ai-chat";  // deve resolver
```

#### Regras

- Nao alterar versoes de deps existentes
- Preferir que glob cubra — adicionar explicitamente so se necessario
- Remover arquivos de teste apos validacao

### Feature F-195: Refatorar Hub para Usar ai-chat

**Spec:** S-071

Modificar `apps/hub/src/components/conversations/conversation-chat.tsx`:

**Antes:**
```typescript
import { MessageBubble } from "../chat/message-bubble";
import { MessageList } from "../chat/message-list";
import { MessageInput } from "../chat/message-input";
import { useChatStream } from "../../lib/chat-stream";
```

**Depois:**
```typescript
import { Chat } from "@agentic-backbone/ai-chat";
import "@agentic-backbone/ai-chat/styles.css";
```

O componente **mantem:**
- Header com info da sessao, botao takeover, breadcrumbs
- Feedback buttons (like/dislike)
- Logica de selecao de sessao e navegacao

E **delega** ao `<Chat />`:
```typescript
<Chat
  endpoint={backboneUrl}
  token={authToken}
  sessionId={selectedSessionId}
  className="flex-1"
/>
```

**Remover arquivos redundantes apos validacao:**
- `apps/hub/src/components/chat/message-bubble.tsx`
- `apps/hub/src/components/chat/message-list.tsx`
- `apps/hub/src/components/chat/message-input.tsx`
- `apps/hub/src/components/chat/streaming-indicator.tsx`
- `apps/hub/src/lib/chat-stream.ts`

**Importar CSS** em `apps/hub/src/main.tsx`:
```typescript
import "@agentic-backbone/ai-chat/styles.css";
```

#### Regras

- Nao remover logica de negocio — header, takeover, feedback permanecem no Hub
- Remover arquivos SOMENTE apos validacao de que Chat funciona
- `conversations-layout.tsx` nao eh afetado — sidebar e navegacao ficam no Hub
- URLs de rotas nao mudam
- CSS do ai-chat nao conflita com Tailwind — namespace `.ai-chat` garante isolamento

### Feature F-196: Configuracao GitHub Packages

**Spec:** S-072

**Modificar `apps/packages/ai-sdk/package.json` e `apps/packages/ai-chat/package.json`:**

```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/gugacoder/agentic-backbone.git",
    "directory": "apps/packages/{pacote}"
  }
}
```

**Criar `.npmrc` na raiz:**
```
@agentic-backbone:registry=https://npm.pkg.github.com
```

**Adicionar scripts na raiz:**
```json
{
  "scripts": {
    "version:packages": "npm version patch --workspace=apps/packages/ai-sdk && npm version patch --workspace=apps/packages/ai-chat",
    "publish:packages": "npm publish --workspace=apps/packages/ai-sdk && npm publish --workspace=apps/packages/ai-chat"
  }
}
```

**Criar `CHANGELOG.md` em cada pacote:**
```markdown
# Changelog

## [0.1.0] - 2026-03-29

### Added
- Initial release
```

#### Regras

- `.npmrc` NAO deve conter tokens — tokens vao em env vars
- Scope `@agentic-backbone` consistente com nomes existentes
- NAO publicar — esta feature apenas configura

## Limites

- **NAO** publicar pacotes — apenas configurar publicacao
- **NAO** alterar logica de negocio do Hub alem do necessario para a migracao
- **NAO** modificar `conversations-layout.tsx` — sidebar eh do Hub
- **NAO** commitar tokens ou secrets no `.npmrc`

## Validacao

- [ ] `npm ls @agentic-backbone/ai-chat` mostra pacote resolvido
- [ ] `node_modules/@agentic-backbone/ai-chat` eh symlink correto
- [ ] `apps/hub` importa `@agentic-backbone/ai-chat` sem erro
- [ ] `apps/chat` importa `@agentic-backbone/ai-chat` sem erro
- [ ] `npm install` completa sem erros
- [ ] `conversation-chat.tsx` usa `<Chat />` do pacote
- [ ] Chat funciona: enviar mensagem, receber resposta com streaming, exibir parts
- [ ] Header, takeover e feedback do Hub funcionam
- [ ] 5 arquivos redundantes removidos do Hub
- [ ] `import "@agentic-backbone/ai-chat/styles.css"` no entry point
- [ ] Typecheck passa em `apps/hub`
- [ ] Build do Hub completa sem erros
- [ ] `publishConfig.registry` aponta para GitHub Packages nos dois pacotes
- [ ] `repository` com URL e directory corretos
- [ ] `.npmrc` com registry do scope `@agentic-backbone`
- [ ] Scripts `version:packages` e `publish:packages` existem
- [ ] `CHANGELOG.md` existe nos dois pacotes
- [ ] Nenhum token ou secret commitado

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-194 Registrar Workspace + Install Deps | S-070 | AC-015 |
| F-195 Refatorar Hub para ai-chat | S-071 | AC-016 |
| F-196 Configuracao GitHub Packages | S-072 | AC-017 |
