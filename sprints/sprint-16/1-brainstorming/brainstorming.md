# Brainstorming — Sprint 16
## PRP 21: File Upload — Envio de Arquivos para o Modelo

---

## Contexto

O objetivo desta wave é implementar o suporte completo a upload de arquivos na conversa. O usuário pode anexar imagens, áudio, PDFs, documentos (DOCX/XLSX) e texto no chat. Os arquivos são enviados ao modelo como content parts (Vercel AI SDK), armazenados no filesystem da conversa (`attachments/`), e suportados tanto no chat web quanto via WhatsApp (Evolution).

### Estado atual confirmado por leitura de código

| Área | Estado |
|---|---|
| `MessageInput.tsx` | Já coleta attachments (plus menu, drag & drop, paste, gravação de áudio) |
| `Chat.tsx` `handleSubmit` | Recebe `attachments[]` mas não envia — usa `useChatContext` que ignora |
| `POST /conversations/:id/messages` | Aceita apenas `application/json` com `{ message: string }` |
| `sendMessage()` em `conversations/index.ts` | Recebe `message: string` — sem suporte a content array |
| `persistence.ts` `appendModelMessage()` | Persiste `content: string` apenas |
| `ai-sdk/src/session.ts` `loadSession()` | Carrega mensagens sem resolver `_ref` (mecanismo não existe) |
| `compaction.ts` `countMessageTokens()` | Conta só TextParts — ignora ImagePart/FilePart |
| `InboundMessage.content` | Tipado como `string` em `channels/delivery/types.ts` |
| Evolution `routes.ts` | Processa só `audioMessage`/`pttMessage` — descarta `imageMessage`, `documentMessage` |
| `guides/file-upload/` | Não existe |
| `ideacao/upload/MEDIATYPES.txt` | Existe — define formatos suportados (base para o guide) |

### Dependências de PRPs anteriores

- **PRP 17** (Unified Persistence) — formato `content: Part[]` no `messages.jsonl` já suportado na escrita, mas o mecanismo `_ref` ainda não existe
- **PRP 14** (Rich Content) — `display_file`/`display_image` são para direção oposta (modelo→usuário), não interferem

---

## Funcionalidades Mapeadas (já implementadas)

1. **UI de coleta de attachments** — `MessageInput.tsx` já tem: plus menu, drag & drop, paste, gravação de áudio, `AttachmentPreview` component. Interface pronta.
2. **Audio Whisper via Evolution** — `routes.ts` já baixa áudio via `getBase64FromMediaMessage` e transcreve com Whisper. Pipeline de mídia parcialmente existente.
3. **Content array no JSONL** — formato `content: string | Part[]` já suportado pelo schema (PRP 17).
4. **SSE streaming** — pipeline completo de streaming existe; upload só adiciona o passo de pré-processamento antes.

---

## Lacunas e Oportunidades

### Lacunas técnicas críticas (bloqueiam a feature)

1. **Rota não aceita multipart** — `POST /conversations/:id/messages` rejeita `multipart/form-data`. Sem isso, nenhum arquivo chega ao backend.

2. **`sendMessage()` não aceita content array** — Assinatura `message: string` precisa ser expandida para `content: string | ContentPart[]`. Ponto central de integração.

3. **Nenhum storage de attachments** — Diretório `attachments/` nunca é criado. Sem persistência, os arquivos somem após o request.

4. **`_ref` não existe no JSONL** — A convenção de substituir `data`/`image` base64 por `_ref: "att_xxx.png"` ainda não foi implementada. Sem isso, base64 vai direto ao JSONL inflando o arquivo.

5. **`loadSession()` não resolve referências** — Mesmo que `_ref` fosse salvo, o `ai-sdk` não sabe reconstruir as parts binárias ao recarregar o histórico.

6. **Compaction subestima tokens** — `countMessageTokens()` ignora partes de imagem/áudio/arquivo, podendo não disparar compaction quando necessário.

7. **`InboundMessage.content` é string** — Evolution e outros canais não conseguem entregar `ContentPart[]` ao backbone sem mudança de tipo.

8. **Evolution descarta imageMessage/documentMessage** — O webhook só processa `audioMessage`. Imagens e documentos recebidos via WhatsApp são silenciosamente descartados.

### Lacunas de produto

9. **Sem rota `GET /attachments/:filename`** — Frontend não consegue exibir thumbnails nem tocar áudio após o envio. Arquivos salvos no servidor não são acessíveis.

10. **Frontend não envia arquivos** — `handleSubmit` em `Chat.tsx` nunca constrói `FormData`. Toda a UI de coleta é dead code no flow de envio.

11. **`MessageBubble.tsx` não renderiza attachments recebidos** — Só renderiza `text`, `reasoning`, `tool-invocation`. Imagens, áudios, PDFs sem renderização.

12. **Sem filtro de mídia antiga no replay** — Ao continuar uma sessão, binários de mensagens antigas são reenviados ao modelo desperdiçando tokens. Necessário substituir por placeholders.

### Lacunas de documentação

13. **Sem `guides/file-upload/GUIDE.md`** — O guide é a fonte da verdade para a feature. `MEDIATYPES.txt` existe como semente.

### Oportunidades de extensão (não obrigatórias nesta PRP)

14. **Caption de mídia WhatsApp** — Mensagens com `imageMessage` podem ter `caption`. Incluir como `TextPart` melhora o contexto ao modelo.

15. **Audio nativo vs. Whisper no WhatsApp** — Áudio pode ir como `FilePart` nativo se o modelo suportar, ou via Whisper como fallback. A decisão baseada em capabilities do modelo configurado é uma oportunidade de extensibilidade.

---

## Priorização

### Score e ordem lógica de implementação

As features seguem a ordem de execução definida no TASK.md (Fases 1–8). Prioridade = bloqueio sequencial.

| ID | Descrição | Score | Justificativa |
|---|---|---|---|
| D-001 | Guide `guides/file-upload/GUIDE.md` | 9 | Documenta o contrato da feature; base para implementação correta |
| D-002 | Dependências `mammoth` + `xlsx` + rota multipart + storage `attachments/` | 10 | Desbloqueador de tudo. Sem multipart e storage, nenhuma outra fase avança |
| D-003 | Classificação de arquivos + conversão DOCX/XLSX + montagem de content parts | 9 | Núcleo do pipeline. Define como cada MIME type se torna uma Part |
| D-004 | Persistência com `_ref` + resolução na leitura em `loadSession()` | 9 | Sem `_ref`, base64 vai ao JSONL. Crítico para integridade do storage |
| D-005 | Refatorar `sendMessage()` para `content: string \| ContentPart[]` e expandir `InboundMessage` | 9 | Ponto central de integração backbone. Fases 7 e 8 dependem disto |
| D-006 | Rota `GET /conversations/:id/attachments/:filename` | 8 | Necessário para o frontend exibir thumbnails e reproduzir áudio |
| D-007 | Replay com filtro de mídia antiga + compaction com estimativa de tokens | 8 | Evita desperdício de tokens em sessões longas; compaction dispara corretamente |
| D-008 | Evolution: processar `imageMessage` e `documentMessage` inbound | 7 | Expande WhatsApp de áudio-only para multimídia. Paralelo com D-009 |
| D-009 | Frontend: wiring do submit (FormData) + rendering de attachments + progress | 8 | Fecha o loop UX. Paralelo com D-008 após D-004/D-005 |
| D-010 | Validação de limites (413/415) no backend | 7 | Proteção contra abuso. Parte da rota multipart mas merece atenção explícita |
| D-011 | Caption de mídia WhatsApp como `TextPart` | 5 | Melhoria de contexto. Não bloqueia funcionamento básico |
| D-012 | Audio inbound WhatsApp: Whisper vs. FilePart nativo por capability | 4 | Extensibilidade futura. Whisper atual já funciona; native é upgrade |
