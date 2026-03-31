# S-088 — Classificador de Arquivos + Conversão DOCX/XLSX

Implementar o classificador que transforma cada arquivo recebido no content part correto (ImagePart, FilePart, TextPart) e converte DOCX/XLSX para texto.

**Resolve:** D-003 (classificação de arquivos + conversão + montagem de content parts)
**Score de prioridade:** 9
**Dependencia:** S-087 — arquivos já devem estar salvos em `attachments/`
**PRP:** 21 — File Upload: Envio de Arquivos para o Modelo

---

## 1. Objetivo

Definir como cada MIME type se transforma numa Part do Vercel AI SDK. O classificador é o núcleo do pipeline de upload: recebe metadados do arquivo salvo e retorna o content part pronto para envio ao modelo.

---

## 2. Alterações

### 2.1 Arquivo: `apps/backbone/src/conversations/attachments.ts` (NOVO)

Módulo dedicado para classificação e conversão de arquivos.

#### Função principal: `classifyAttachment()`

```typescript
import { readFile } from "node:fs/promises";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

interface AttachmentInfo {
  filename: string;   // nome gerado (att_xxx.ext)
  filepath: string;   // caminho absoluto em attachments/
  mimeType: string;   // MIME type original
  size: number;       // tamanho em bytes
}

interface ClassifiedPart {
  part: ImagePart | FilePart | TextPart;
  ref: string;  // filename para _ref
}

type ImagePart = { type: "image"; image: string; mimeType: string };
type FilePart = { type: "file"; data: string; mimeType: string };
type TextPart = { type: "text"; text: string };

export async function classifyAttachment(info: AttachmentInfo): Promise<ClassifiedPart> {
  const { filename, filepath, mimeType } = info;

  // Inline nativo: imagem
  if (mimeType.startsWith("image/")) {
    const buffer = await readFile(filepath);
    return {
      part: { type: "image", image: buffer.toString("base64"), mimeType },
      ref: filename,
    };
  }

  // Inline nativo: PDF, áudio
  if (mimeType === "application/pdf" || mimeType.startsWith("audio/")) {
    const buffer = await readFile(filepath);
    return {
      part: { type: "file", data: buffer.toString("base64"), mimeType },
      ref: filename,
    };
  }

  // Inline texto: plain, csv, json
  if (["text/plain", "text/csv", "application/json"].includes(mimeType)) {
    const text = await readFile(filepath, "utf-8");
    return {
      part: { type: "text", text: `[📎 ${filename}]\n${text}` },
      ref: filename,
    };
  }

  // Pré-processado: DOCX
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const buffer = await readFile(filepath);
    const result = await mammoth.convertToMarkdown({ buffer });
    return {
      part: { type: "text", text: `[📎 ${filename}]\n${result.value}` },
      ref: filename,
    };
  }

  // Pré-processado: XLSX
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    const buffer = await readFile(filepath);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const csvParts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      csvParts.push(`## ${sheetName}\n${csv}`);
    }
    return {
      part: { type: "text", text: `[📎 ${filename}]\n${csvParts.join("\n\n")}` },
      ref: filename,
    };
  }

  // Fallback — não deve chegar aqui se validação de MIME foi feita em S-087
  throw new Error(`MIME type não suportado: ${mimeType}`);
}
```

#### Função: `buildContentArray()`

Monta o content array completo a partir da mensagem de texto e dos arquivos classificados:

```typescript
export async function buildContentArray(
  message: string | undefined,
  attachments: AttachmentInfo[]
): Promise<Array<ImagePart | FilePart | TextPart>> {
  const parts: Array<ImagePart | FilePart | TextPart> = [];

  // Texto do usuário sempre no início
  if (message?.trim()) {
    parts.push({ type: "text", text: message });
  }

  // Classificar cada arquivo
  for (const att of attachments) {
    const { part } = await classifyAttachment(att);
    parts.push(part);
  }

  return parts;
}
```

### 2.2 Integração com a rota: `apps/backbone/src/routes/conversations.ts` (MODIFICAR)

Após salvar os arquivos (S-087), chamar `buildContentArray()` para montar o content:

```typescript
import { buildContentArray } from "../conversations/attachments.js";

// Dentro do handler multipart, após salvar arquivos:
const content = await buildContentArray(message, savedFiles);
// Passar content para sendMessage (após S-090)
```

---

## 3. Regras de Implementação

- **Texto do usuário sempre primeiro** — se há `message`, `TextPart` é o primeiro elemento do array
- **Prefixo `[📎 filename]`** nos TextParts de arquivos pré-processados e inline texto — para o modelo saber de onde veio o conteúdo
- **Sem prefixo em ImagePart/FilePart** — o modelo recebe o binário diretamente, o tipo MIME é suficiente
- **mammoth → Markdown** (não HTML) — `convertToMarkdown()` produz texto mais limpo para o modelo
- **XLSX → CSV por sheet** — cada sheet é um bloco separado com nome da sheet como header
- **Sem redimensionamento de imagens** — enviar como recebido; o provider faz resize
- **Processamento sequencial** — classificar um arquivo por vez para não sobrecarregar memória com múltiplos buffers base64 simultâneos

---

## 4. Critérios de Aceite

- [ ] Arquivo `apps/backbone/src/conversations/attachments.ts` existe com `classifyAttachment()` e `buildContentArray()`
- [ ] Imagem (png/jpeg/gif/webp) → `ImagePart` com base64 e mimeType
- [ ] PDF → `FilePart` com base64 e mimeType `application/pdf`
- [ ] Áudio (wav/mp3/mpeg/ogg/webm) → `FilePart` com base64 e mimeType
- [ ] Texto (plain/csv/json) → `TextPart` com conteúdo direto
- [ ] DOCX → `TextPart` com Markdown extraído via mammoth
- [ ] XLSX → `TextPart` com CSV extraído via SheetJS (uma sheet por bloco)
- [ ] `buildContentArray()` coloca TextPart do usuário no início do array
- [ ] TextParts de arquivo têm prefixo `[📎 filename]`
- [ ] TypeScript compila sem erros
