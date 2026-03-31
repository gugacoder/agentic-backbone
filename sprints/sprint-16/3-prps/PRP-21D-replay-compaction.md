# PRP-21D — Replay com Filtro de Mídia Antiga + Compaction

Implementar filtro que substitui binários antigos por placeholders no replay e atualizar estimativa de tokens para content parts de mídia.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Ao retomar uma sessão com histórico de attachments, `loadSession()` resolve todos os `_ref` de volta para base64 (PRP-21B). Isso significa que binários de mensagens antigas são reenviados ao modelo, desperdiçando tokens sem valor contextual. Além disso, `countMessageTokens()` ignora parts não-texto, fazendo com que compaction nunca dispare em sessões com muitos uploads.

### Estado desejado

- Mensagens anteriores do usuário têm binários substituídos por placeholders textuais informativos
- Última mensagem do usuário mantém todos os parts (modelo precisa ver o que acabou de ser enviado)
- `countMessageTokens()` estima tokens de mídia para que compaction dispare corretamente

### Dependencias

- **PRP-21B** — persistência `_ref` e resolução de referências
- **PRP-21C** — `sendMessage` com content array

## Especificacao

### Feature F-334: Filtro de mídia antiga no replay

**Spec:** S-092 seção 2.1

Criar em `apps/packages/ai-sdk/src/session.ts`:

#### `filterOldMedia(messages, lastUserIndex): ModelMessage[]`

Regras de filtragem:
- **Última mensagem do usuário** (`i === lastUserIndex`): manter todos os parts intactos
- **Mensagens anteriores do usuário** com `content` array:
  - `ImagePart` → substituir por `TextPart` com `[imagem enviada: {_ref ou "imagem"}]`
  - `FilePart` com `data` → substituir por `TextPart` com `[arquivo enviado: {_ref ou "arquivo"}]`
  - `TextPart` → sempre manter
- **Mensagens do assistant**: não alterar (não contêm uploads)

**Onde chamar:** Após `loadSession()` + `resolveRefs()` (F-330), antes de passar `previousMessages` para `runAgent()` / `streamText()`.

**`lastUserIndex`:** índice da última mensagem com `role: "user"` no array.

### Feature F-335: Estimativa de tokens para mídia na compaction

**Spec:** S-092 seção 2.2

Modificar `apps/packages/ai-sdk/src/context/compaction.ts`:

Expandir `countMessageTokens()` para estimar tokens de content parts:

| Part type | Estimativa |
|---|---|
| `TextPart` | `countTokens(text)` (como antes) |
| `ImagePart` | ~300 tokens (média de imagens redimensionadas pelo provider) |
| `FilePart` PDF | ~1500 tokens (estimativa conservadora: ~500/página × 3 páginas) |
| `FilePart` áudio | ~200 tokens (estimativa: ~100/min × 2 minutos) |
| Part desconhecido | ~500 tokens (fallback) |

Quando `content` é `string`, retornar mesmo valor de antes (retrocompatível).

#### Regras

- Estimativas não precisam ser exatas — objetivo é que compaction dispare num momento razoável
- Estimativas conservadoras — melhor compactar cedo demais que tarde demais
- `content: string` retorna exatamente o mesmo valor de antes

## Limites

- **NÃO** filtrar mensagens do assistant
- **NÃO** remover TextParts de mensagens antigas — texto extraído de DOCX/XLSX tem valor contextual duradouro
- **NÃO** implementar contagem exata de tokens de mídia — estimativas são suficientes
- **NÃO** alterar o mecanismo de compaction em si — apenas a estimativa de tokens

## Validacao

- [ ] `filterOldMedia()` substitui `ImagePart` por placeholder em mensagens anteriores do usuário
- [ ] `filterOldMedia()` substitui `FilePart` binário por placeholder em mensagens anteriores
- [ ] `filterOldMedia()` mantém todos os parts da última mensagem do usuário
- [ ] `filterOldMedia()` mantém `TextPart` em todas as mensagens
- [ ] `filterOldMedia()` não altera mensagens do assistant
- [ ] `countMessageTokens()` retorna ~300 para `ImagePart`
- [ ] `countMessageTokens()` retorna ~1500 para `FilePart` PDF
- [ ] `countMessageTokens()` retorna ~200 para `FilePart` áudio
- [ ] `countMessageTokens()` retorna ~500 para parts desconhecidos
- [ ] `countMessageTokens()` com `content: string` retorna mesmo valor de antes
- [ ] TypeScript compila sem erros em `apps/packages/ai-sdk`

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-334 filtro mídia antiga replay | S-092 | D-007 |
| F-335 estimativa tokens mídia compaction | S-092 | D-007 |
