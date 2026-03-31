# PRP-21B — Classificação de Arquivos e Persistência _ref

Implementar o classificador que transforma cada arquivo em content part correto e o mecanismo de persistência `_ref` que substitui base64 por referência no JSONL.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Após PRP-21A, arquivos são recebidos via multipart, validados e salvos em `attachments/`. Mas não há lógica para classificar cada arquivo no content part correto (ImagePart, FilePart, TextPart), nem para evitar que base64 infle o `messages.jsonl`.

### Estado desejado

- Classificador em `apps/backbone/src/conversations/attachments.ts` transforma cada MIME type no Part correto
- DOCX convertido para Markdown via mammoth, XLSX para CSV via SheetJS
- Content array montado com TextPart do usuário no início + parts dos arquivos
- Ao salvar no JSONL, base64 substituído por `_ref` (referência ao arquivo em `attachments/`)
- Ao carregar histórico, `_ref` resolvido de volta para base64 (ou placeholder se arquivo ausente)

### Dependencias

- **PRP-21A** — rota multipart, storage e dependências mammoth/xlsx devem estar prontos

## Especificacao

### Feature F-328: Classificador de arquivos + conversão DOCX/XLSX

**Spec:** S-088

Criar `apps/backbone/src/conversations/attachments.ts` com:

#### `classifyAttachment(info: AttachmentInfo): Promise<ClassifiedPart>`

Recebe metadados do arquivo salvo e retorna o content part:

| MIME type | Part produzido |
|---|---|
| `image/png`, `image/jpeg`, `image/gif`, `image/webp` | `ImagePart` com base64 |
| `application/pdf` | `FilePart` com base64 |
| `audio/wav`, `audio/mp3`, `audio/mpeg`, `audio/ogg`, `audio/webm` | `FilePart` com base64 |
| `text/plain`, `text/csv`, `application/json` | `TextPart` com conteúdo direto |
| `.docx` (openxmlformats wordprocessingml) | `TextPart` com Markdown via `mammoth.convertToMarkdown()` |
| `.xlsx` (openxmlformats spreadsheetml) | `TextPart` com CSV por sheet via `XLSX.utils.sheet_to_csv()` |

- TextParts de arquivos pré-processados e inline texto recebem prefixo `[📎 filename]`
- ImagePart/FilePart não recebem prefixo — o tipo MIME é suficiente
- `ClassifiedPart` retorna `{ part, ref: filename }` para uso posterior em `_ref`

#### `buildContentArray(message, attachments): Promise<ContentPart[]>`

Monta o content array completo:
1. Se há `message` com texto, adicionar `TextPart` no início
2. Para cada attachment, chamar `classifyAttachment()` e adicionar o part

#### Regras

- mammoth → Markdown (não HTML) — `convertToMarkdown()` produz texto mais limpo
- XLSX → CSV por sheet — cada sheet é um bloco separado com nome como header
- Processamento sequencial — um arquivo por vez para não sobrecarregar memória
- Sem redimensionamento de imagens — enviar como recebido

### Feature F-329: Persistência _ref no JSONL (escrita)

**Spec:** S-089 seção 2.1

Criar em `apps/backbone/src/conversations/persistence.ts`:

#### `stripBase64ForStorage(content: ContentPart[]): ContentPart[]`

Percorre o content array e substitui campos binários por referências:
- `ImagePart` com `_ref` → remover `image`, manter `_ref` e `mimeType`
- `FilePart` com `_ref` → remover `data`, manter `_ref` e `mimeType`
- `TextPart` → sem alteração

Integrar em `appendModelMessage()`: quando `content` é `ContentPart[]`, aplicar `stripBase64ForStorage()` antes de serializar para JSONL.

Formato persistido:
```json
{"role":"user","content":[{"type":"text","text":"analise isso"},{"type":"file","_ref":"att_xxx.pdf","mimeType":"application/pdf"}]}
```

### Feature F-330: Resolução de referências na leitura

**Spec:** S-089 seção 2.2

Criar em `apps/packages/ai-sdk/src/session.ts`:

#### `resolveRefs(content: unknown[], attachmentsDir: string): Promise<unknown[]>`

Percorre o content array carregado do JSONL e resolve `_ref`:
- `ImagePart` com `_ref` → carregar arquivo, converter base64, restaurar campo `image`
- `FilePart` com `_ref` → carregar arquivo, converter base64, restaurar campo `data`
- Arquivo ausente → substituir por `TextPart` com `[arquivo removido: nome.ext]`

Integrar em `loadSession()`: após carregar mensagens do JSONL, resolver referências para cada mensagem com `content` array.

#### Regras

- `_ref` é convenção interna do JSONL — nunca exposto na API pública
- TextParts nunca têm `_ref` — texto é inline sempre
- Resolução é graceful — arquivo ausente vira placeholder, nunca erro fatal
- JSONL existente (sem `_ref`) continua sendo lido normalmente (retrocompatível)
- Processar sequencialmente — não carregar todos os base64 em memória de uma vez

## Limites

- **NÃO** expor `_ref` na API pública
- **NÃO** criar tabela SQL para attachments — referência direto no JSONL
- **NÃO** duplicar conteúdo de TextPart em arquivo separado — texto é inline sempre
- **NÃO** alterar formato do JSONL para mensagens existentes sem `_ref`

## Validacao

- [ ] `classifyAttachment()` classifica corretamente todos os MIME types suportados
- [ ] Imagem → `ImagePart` com base64 e mimeType
- [ ] PDF/áudio → `FilePart` com base64 e mimeType
- [ ] Texto (plain/csv/json) → `TextPart` com conteúdo direto e prefixo `[📎]`
- [ ] DOCX → `TextPart` com Markdown via mammoth e prefixo `[📎]`
- [ ] XLSX → `TextPart` com CSV por sheet via SheetJS e prefixo `[📎]`
- [ ] `buildContentArray()` coloca TextPart do usuário no início
- [ ] `stripBase64ForStorage()` remove base64 e mantém `_ref`
- [ ] JSONL persistido sem base64 para parts binários
- [ ] `resolveRefs()` carrega arquivo do disco e reconstrói base64
- [ ] Arquivo ausente → `[arquivo removido: nome.ext]`
- [ ] `loadSession()` resolve `_ref` automaticamente
- [ ] JSONL sem `_ref` continua sendo lido normalmente
- [ ] TypeScript compila sem erros em `apps/backbone` e `apps/packages/ai-sdk`

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-328 classificador arquivos + conversão | S-088 | D-003 |
| F-329 persistência _ref escrita | S-089 | D-004 |
| F-330 resolução _ref leitura | S-089 | D-004 |
