# S-086 — Guide File Upload

Criar `guides/file-upload/GUIDE.md` como fonte da verdade da feature de upload de arquivos.

**Resolve:** D-001 (Guide file-upload)
**Score de prioridade:** 9
**Dependencia:** Nenhuma — pode rodar em paralelo com S-087
**PRP:** 21 — File Upload: Envio de Arquivos para o Modelo

---

## 1. Objetivo

Documentar o contrato completo da feature de file upload: media types suportados, pipeline de processamento, formato de referência `_ref` no JSONL, API da rota multipart, limites por tipo e por mensagem. O guide serve como referência canônica para os agentes de implementação das demais specs.

---

## 2. Alterações

### 2.1 Arquivo: `guides/file-upload/GUIDE.md` (NOVO)

Criar guide com as seguintes seções:

#### Seção 1: Visão Geral

Explicar que o upload permite enviar arquivos (imagens, áudio, PDFs, documentos, texto) na conversa. Arquivos são processados no backend, convertidos em content parts (Vercel AI SDK), persistidos em `attachments/` na pasta da conversa, e enviados ao modelo via `streamText`.

#### Seção 2: Media Types Suportados

Três categorias baseadas em `ideacao/upload/MEDIATYPES.txt`:

**Inline nativo** — enviado como `ImagePart` ou `FilePart` com binário base64:

| MIME type | Part type |
|---|---|
| `image/png`, `image/jpeg`, `image/gif`, `image/webp` | `ImagePart` |
| `application/pdf` | `FilePart` |
| `audio/wav`, `audio/mp3`, `audio/mpeg`, `audio/ogg`, `audio/webm` | `FilePart` |

**Inline texto** — conteúdo lido e enviado como `TextPart`:

| MIME type | Tratamento |
|---|---|
| `text/plain` | Conteúdo direto |
| `text/csv` | Conteúdo direto |
| `application/json` | Conteúdo direto |

**Pré-processado** — convertido para texto:

| MIME type | Lib | Saída |
|---|---|---|
| `.docx` | `mammoth` | Markdown |
| `.xlsx` | `xlsx` (SheetJS) | CSV (uma sheet por bloco) |

#### Seção 3: Limites

| Tipo | Tamanho máximo |
|---|---|
| Imagem | 20 MB |
| Áudio | 25 MB |
| PDF | 30 MB |
| DOCX | 15 MB |
| XLSX | 10 MB |
| Texto (plain/csv/json) | 5 MB |
| **Total por mensagem** | **50 MB** |
| **Arquivos por mensagem** | **10** |

#### Seção 4: Pipeline de Upload (diagrama)

```
multipart/form-data
  ↓
  validar: MIME type permitido? tamanho dentro do limite?
  ↓
  salvar em {sessionDir}/attachments/{id}.{ext}
  ↓
  classificar: imagem→ImagePart, pdf/audio→FilePart, texto→TextPart, docx→mammoth→TextPart, xlsx→SheetJS→TextPart
  ↓
  montar content: Array<Part> (TextPart do usuário no início)
  ↓
  persistir no JSONL com _ref (sem base64)
  ↓
  passar content array para sendMessage → runAgent → streamText
```

#### Seção 5: Formato de Referência no JSONL

Documentar a convenção `_ref`:

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "analise esse documento" },
    { "type": "file", "_ref": "att_1711792800123_b4e3d2.pdf", "mimeType": "application/pdf" }
  ]
}
```

- `_ref` substitui `data`/`image` na persistência
- Na leitura, resolver `_ref` carregando o arquivo do disco → base64
- Se arquivo não existir, substituir por `TextPart` placeholder

#### Seção 6: API da Rota Multipart

Documentar `POST /conversations/:sessionId/messages`:
- Aceita `application/json` (retrocompatível) e `multipart/form-data`
- Campos: `message` (string, opcional), `files` (File[], opcional)
- Respostas de erro: `413` (limite excedido), `415` (MIME não suportado)

#### Seção 7: Rota de Servir Arquivos

Documentar `GET /conversations/:sessionId/attachments/:filename`:
- Auth JWT obrigatória
- Retorna arquivo com `Content-Type` correto

#### Seção 8: Replay e Compaction

- Última mensagem do usuário: manter todos os parts
- Mensagens anteriores: substituir binários por placeholder `[imagem enviada: foto.png]`
- Estimativas de tokens: ImagePart ~300, PDF ~500/pág, áudio ~100/min

---

## 3. Regras de Implementação

- Usar `ideacao/upload/MEDIATYPES.txt` como semente para a lista de media types
- Seguir o formato de guides existentes em `guides/` (título, seções claras, exemplos de código)
- Não incluir detalhes de implementação internos — apenas contratos e formatos
- Guide deve ser compreensível standalone (sem precisar ler o PRP)

---

## 4. Critérios de Aceite

- [ ] Arquivo `guides/file-upload/GUIDE.md` existe com todas as 8 seções
- [ ] Todos os media types de `MEDIATYPES.txt` estão documentados com sua categoria
- [ ] Limites por tipo e total estão documentados
- [ ] Diagrama do pipeline de upload está presente
- [ ] Formato `_ref` documentado com exemplo JSON
- [ ] API da rota multipart documentada (campos, content-types, erros)
- [ ] Rota GET attachments documentada
- [ ] Regras de replay/compaction documentadas
