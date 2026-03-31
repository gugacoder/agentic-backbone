# PRP-21C — Content Array no Backbone + Rota GET Attachments

Refatorar `sendMessage()`, `appendModelMessage()` e `InboundMessage` para aceitar `string | ContentPart[]`, e criar rota para servir arquivos com autenticação.

## Execution Mode

`implementar`

## Contexto

### Estado atual

`sendMessage()` recebe `message: string`. `appendModelMessage()` persiste `content: string`. `InboundMessage.content` é `string`. Não existe rota HTTP para servir os arquivos salvos em `attachments/` — o frontend não consegue exibir thumbnails nem reproduzir áudio.

### Estado desejado

- Toda a call chain (rota → sendMessage → runAgent → streamText) propaga `content: string | ContentPart[]` sem conversão
- `appendModelMessage()` aplica `stripBase64ForStorage()` quando content é array
- `InboundMessage.content` aceita `ContentPart[]` para suportar mídia de canais (Evolution)
- Rota `GET /conversations/:sessionId/attachments/:filename` serve arquivos com auth JWT e content-type correto

### Dependencias

- **PRP-21B** — classificador e persistência `_ref` devem estar prontos

## Especificacao

### Feature F-331: Refatorar sendMessage para content array

**Spec:** S-090 seção 2.1

Modificar `apps/backbone/src/conversations/index.ts`:

Assinatura atual: `sendMessage(userId, sessionId, message: string)`
Nova assinatura: `sendMessage(userId, sessionId, content: string | ContentPart[])`

- Se `content` é `string`, manter comportamento atual
- Se `content` é `ContentPart[]`, passar como content array para `runAgent()`
- Verificar todos os call sites — nenhum precisa mudar (expansão aditiva)
- Verificar que `runAgent()` do ai-sdk já aceita content array (tipagem Vercel AI SDK)

### Feature F-332: Expandir appendModelMessage e InboundMessage

**Spec:** S-090 seções 2.2–2.3

**`appendModelMessage()`** em `apps/backbone/src/conversations/persistence.ts`:

Expandir `content` para `string | ContentPart[]`. Ao serializar:
- Se `string`, serializar normalmente
- Se `ContentPart[]`, aplicar `stripBase64ForStorage()` (F-329) antes de serializar

**`InboundMessage`** em `apps/backbone/src/channels/delivery/types.ts`:

Expandir `content` de `string` para `string | ContentPart[]`. Retrocompatível — canais existentes continuam passando `string`.

**Verificar call chain completa:**
```
Rota POST → sendMessage(content) → runAgent(content) → streamText(content)
Evolution webhook → routeInboundMessage(InboundMessage) → sendMessage(content)
```

Garantir que `routeInboundMessage()` extrai `content` sem forçar `.toString()`.

#### Regras

- Retrocompatibilidade obrigatória — `string` funciona em todos os caminhos
- Não forçar conversão — se recebeu `string`, passa `string`
- Tipo `ContentPart` importado do Vercel AI SDK (`TextPart`, `ImagePart`, `FilePart`)
- Verificar todos os call sites de `sendMessage()`, `appendModelMessage()` e `routeInboundMessage()`

### Feature F-333: Rota GET attachments

**Spec:** S-091

Adicionar em `apps/backbone/src/routes/conversations.ts`:

```
GET /conversations/:sessionId/attachments/:filename
```

**Handler:**
1. Sanitizar filename — rejeitar `..`, `/`, `\` (400)
2. Resolver caminho da sessão via `resolveSessionDir(sessionId)` (404 se inexistente)
3. Verificar existência do arquivo em `attachments/` (404 se inexistente)
4. Derivar content-type da extensão via mapa de MIME types
5. Retornar arquivo com headers: `Content-Type`, `Content-Length`, `Cache-Control: private, max-age=3600`

**Mapa de MIME types:**

| Extensão | MIME type |
|---|---|
| `.png` | `image/png` |
| `.jpg`, `.jpeg` | `image/jpeg` |
| `.gif` | `image/gif` |
| `.webp` | `image/webp` |
| `.pdf` | `application/pdf` |
| `.wav` | `audio/wav` |
| `.mp3` | `audio/mpeg` |
| `.ogg` | `audio/ogg` |
| `.webm` | `audio/webm` |
| `.txt` | `text/plain` |
| `.csv` | `text/csv` |
| `.json` | `application/json` |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| Outros | `application/octet-stream` |

**Segurança:**
- Auth JWT obrigatória (mesmo middleware das demais rotas)
- Path traversal prevention
- Escopo limitado a `attachments/` da sessão
- Cache-Control private

#### Regras

- Reusar middleware de auth existente
- Reusar `resolveSessionDir()` existente
- Não usar `express.static()` ou equivalente — servir manualmente para controle de auth
- Fallback `application/octet-stream` para extensões desconhecidas

## Limites

- **NÃO** alterar assinatura de `runAgent()` do ai-sdk se já aceita content array
- **NÃO** criar auth customizada para a rota de attachments — reusar middleware existente
- **NÃO** servir arquivos fora do diretório `attachments/` da sessão
- **NÃO** implementar streaming de arquivos grandes — `readFile` + `Response` direto é suficiente para os limites atuais (max 30MB)

## Validacao

- [ ] `sendMessage()` aceita `content: string | ContentPart[]`
- [ ] `appendModelMessage()` aceita `content: string | ContentPart[]`
- [ ] `appendModelMessage()` aplica `stripBase64ForStorage()` quando content é array
- [ ] `InboundMessage.content` tipado como `string | ContentPart[]`
- [ ] Chamadas existentes com `string` compilam sem mudança
- [ ] Content array propagado até `streamText()` sem perda
- [ ] Rota `GET /conversations/:sessionId/attachments/:filename` existe
- [ ] Auth JWT obrigatória — sem token retorna 401
- [ ] Path traversal retorna 400
- [ ] Sessão inexistente retorna 404
- [ ] Arquivo inexistente retorna 404
- [ ] Content-Type correto derivado da extensão
- [ ] Header `Cache-Control: private, max-age=3600`
- [ ] TypeScript compila sem erros em `apps/backbone`

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-331 refatorar sendMessage content array | S-090 | D-005 |
| F-332 expandir appendModelMessage e InboundMessage | S-090 | D-005 |
| F-333 rota GET attachments | S-091 | D-006 |
