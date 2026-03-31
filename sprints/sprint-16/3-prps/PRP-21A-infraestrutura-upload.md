# PRP-21A — Infraestrutura de Upload

Criar o guide de referência, instalar dependências, refatorar a rota de mensagens para aceitar multipart/form-data, e implementar storage e validação completa de limites.

## Execution Mode

`implementar`

## Contexto

### Estado atual

A rota `POST /conversations/:sessionId/messages` aceita apenas `application/json` com `{ message: string }`. Não há suporte a upload de arquivos no backend. Não existem as dependências `mammoth` (DOCX) nem `xlsx` (SheetJS). Não há guide documentando o contrato da feature de file upload.

### Estado desejado

- Guide `guides/file-upload/GUIDE.md` como fonte da verdade da feature
- Dependências `mammoth` e `xlsx` instaladas em `apps/backbone`
- Rota aceita `multipart/form-data` com campos `message` (string) e `files` (File[])
- Arquivos salvos em `{sessionDir}/attachments/` com IDs no formato `att_{ts}_{hex}.{ext}`
- Validação completa: MIME type (415), tamanho por tipo (413), total 50MB (413), max 10 arquivos (413)
- `application/json` retrocompatível

### Dependencias

- **Nenhuma** — desbloqueador de todas as fases seguintes

## Especificacao

### Feature F-325: Guide file-upload

**Spec:** S-086

Criar `guides/file-upload/GUIDE.md` com 8 seções:

1. **Visão Geral** — upload permite enviar arquivos na conversa, processados como content parts (Vercel AI SDK), persistidos em `attachments/`
2. **Media Types Suportados** — 3 categorias: inline nativo (imagem→ImagePart, pdf/audio→FilePart), inline texto (plain/csv/json→TextPart), pré-processado (docx→mammoth→TextPart, xlsx→SheetJS→TextPart)
3. **Limites** — imagem 20MB, áudio 25MB, PDF 30MB, DOCX 15MB, XLSX 10MB, texto 5MB, total 50MB, max 10 arquivos
4. **Pipeline de Upload** — diagrama: multipart → validar → salvar → classificar → montar content array → persistir com _ref → sendMessage → streamText
5. **Formato `_ref` no JSONL** — exemplo JSON mostrando substituição de base64 por `_ref` na persistência e resolução na leitura
6. **API da Rota Multipart** — documentação de `POST /conversations/:sessionId/messages` com campos, content-types, e respostas de erro
7. **Rota de Servir Arquivos** — documentação de `GET /conversations/:sessionId/attachments/:filename` com auth e content-type
8. **Replay e Compaction** — regras de filtro de mídia antiga e estimativas de tokens

#### Regras

- Usar `ideacao/upload/MEDIATYPES.txt` como semente para a lista de media types
- Seguir formato de guides existentes em `guides/`
- Não incluir detalhes de implementação internos — apenas contratos e formatos
- Guide deve ser compreensível standalone

### Feature F-326: Dependências mammoth e xlsx

**Spec:** S-087 seção 2.1

Instalar no workspace `apps/backbone`:

```bash
npm install mammoth xlsx --workspace=apps/backbone
```

- `mammoth` — conversão DOCX → Markdown
- `xlsx` (SheetJS) — conversão XLSX → CSV

### Feature F-327: Rota multipart + storage + validação

**Spec:** S-087 seções 2.2–2.5

Refatorar `apps/backbone/src/routes/conversations.ts`:

1. **Detecção de content type** — `multipart/form-data` → processar multipart; caso contrário → JSON retrocompatível
2. **Parser multipart** — `c.req.parseBody({ all: true })` (nativo Hono). Campos: `message` (string, opcional) e `files` (File[], opcional). Ao menos um deve estar presente (400 se nenhum)
3. **Validação de MIME** — conjunto derivado das chaves de `SIZE_LIMITS`. MIME fora do conjunto → 415 com lista de tipos aceitos
4. **Validação de limites** — por tipo individual (413), total 50MB (413), max 10 arquivos (413). Mensagens claras indicando qual limite foi violado
5. **Storage** — criar `{sessionDir}/attachments/` com `mkdir({ recursive: true })` no primeiro upload
6. **Geração de ID** — formato `att_{timestamp}_{random6hex}.{ext}` via `crypto.randomBytes(3).toString("hex")`
7. **Salvar arquivos** — `Buffer.from(await file.arrayBuffer())` → `writeFile(filepath, buffer)`

Limites por tipo:

| Tipo | Limite |
|---|---|
| Imagem (png/jpeg/gif/webp) | 20 MB |
| Áudio (wav/mp3/mpeg/ogg/webm) | 25 MB |
| PDF | 30 MB |
| DOCX | 15 MB |
| XLSX | 10 MB |
| Texto (plain/csv/json) | 5 MB |
| **Total por mensagem** | **50 MB** |
| **Arquivos por mensagem** | **10** |

Exportar `generateAttachmentId()` para reuso em S-093 (Evolution).

#### Regras

- Validação no backend — não confiar no frontend
- Parser nativo do Hono — não instalar lib externa de multipart
- Erro 415 inclui lista de tipos aceitos
- Erro 413 indica qual limite foi violado (tipo individual, total, ou contagem)
- Não processar arquivos se validação falhar — retornar erro imediatamente
- Retrocompatibilidade obrigatória — `application/json` com `{ message: string }` funciona identicamente

## Limites

- **NÃO** criar storage central (`data/uploads/`) — arquivos vivem na pasta da conversa
- **NÃO** comprimir/redimensionar imagens no backend
- **NÃO** suportar vídeo
- **NÃO** implementar virus scanning ou content moderation
- **NÃO** instalar lib externa de multipart — usar parser nativo do Hono

## Validacao

- [ ] Guide `guides/file-upload/GUIDE.md` existe com todas as 8 seções
- [ ] `mammoth` e `xlsx` instalados em `apps/backbone/package.json`
- [ ] `POST /conversations/:id/messages` aceita `multipart/form-data` com campos `message` e `files`
- [ ] `POST /conversations/:id/messages` com `application/json` continua funcionando
- [ ] Diretório `attachments/` criado automaticamente no primeiro upload
- [ ] ID de attachment no formato `att_{ts}_{hex}.{ext}`
- [ ] Arquivos salvos em `{sessionDir}/attachments/`
- [ ] MIME type não suportado → 415 com lista de tipos aceitos
- [ ] Arquivo acima do limite individual → 413 com mensagem indicando tipo e limite
- [ ] Total acima de 50MB → 413
- [ ] Mais de 10 arquivos → 413
- [ ] Mensagem sem texto nem arquivos → 400
- [ ] `generateAttachmentId()` exportado para reuso
- [ ] TypeScript compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-325 guide file-upload | S-086 | D-001 |
| F-326 deps mammoth xlsx | S-087 | D-002 |
| F-327 rota multipart storage validação | S-087 | D-002, D-010 |
