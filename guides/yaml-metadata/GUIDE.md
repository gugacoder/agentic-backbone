# Guia: Gestão de Metadata YAML

## Princípios

### Dois tipos de arquivo

| Tipo | Extensão | Conteúdo | Vai para prompt? |
|---|---|---|---|
| Metadata puro | `.yml` | Config, credenciais, flags | Nunca |
| Prompt puro | `.md` | Texto para o agente ler | Sempre |
| Híbrido | `.md` com frontmatter | Metadata + texto | O corpo vai; o frontmatter é processado programaticamente |

**Regra:** se o arquivo não tem corpo de texto útil para o agente, ele é `.yml`. Arquivos híbridos existem quando o mesmo recurso tem metadata E conteúdo de prompt (ex: `SKILL.md`, `SERVICE.md`, `USER.md`).

---

## Arquivos de metadata por recurso

| Arquivo | Schema | Descrição |
|---|---|---|
| `AGENT.yml` | `AgentYmlSchema` | Config do agente (enabled, heartbeat, handoff, etc.) |
| `CHANNEL.yml` | `ChannelYmlSchema` | Config do canal (adapter, agent, options) |
| `ADAPTER.yml` | `AdapterYmlSchema` | Config de conector (credential, options, policy) |
| `SESSION.yml` | `SessionYmlSchema` | Estado de sessão de conversa |
| `cron/{slug}.yml` | `CronYmlSchema` | Definição de job agendado |

## Arquivos híbridos (frontmatter + corpo)

| Arquivo | Schema do frontmatter | Corpo |
|---|---|---|
| `SKILL.md` | `SkillMdSchema` | Prompt da skill |
| `SERVICE.md` | `ServiceMdSchema` | Prompt do serviço |
| `USER.md` | `UserMdSchema` | Perfil narrativo do usuário |

---

## API de leitura e escrita

Todos os acessos a arquivos de metadata passam por `context/readers.ts`. **Nunca use `fs` diretamente** para ler ou escrever metadata.

### Arquivos `.yml` (metadata puro)

#### Criar (arquivo não existe)

```ts
writeYamlAs(path, data, Schema)
```

Valida `data` contra o schema Zod antes de gravar. Falha se o schema não for satisfeito.

#### Atualizar campos específicos (PATCH)

```ts
patchYamlAs(path, patch, Schema)
```

Fluxo interno: `load → merge → validate → save`.

- `patch` contém **apenas os campos que mudaram**
- Todos os outros campos do arquivo ficam intactos
- O schema Zod valida o documento **completo após o merge**
- Retorna o documento atualizado

**Exemplo:**
```ts
// Só altera o displayName.
patchYamlAs(adapterPath, { name: "Novo Nome" }, AdapterYmlSchema);
```

#### Ler

```ts
readYamlAs(path, Schema)   // retorna T validado
readYaml(path)             // retorna Record<string, unknown> sem validação (uso interno)
```

---

### Arquivos híbridos `.md` com frontmatter (ex: `SKILL.md`, `SERVICE.md`, `USER.md`)

#### Criar (arquivo não existe)

```ts
writeMarkdownAs(path, metadata, body, Schema)
```

Valida `metadata` contra o schema Zod antes de gravar. O `body` é o conteúdo markdown após o frontmatter.

**Exemplo:**
```ts
writeMarkdownAs(mdPath, { name: "Minha Skill", enabled: true }, "# Minha Skill\n", SkillMdSchema);
```

#### Atualizar campos específicos (PATCH)

```ts
patchMarkdownAs(path, patch, Schema, body?)
```

Fluxo interno: `read → merge frontmatter → validate → save`.

- `patch` contém **apenas os campos do frontmatter que mudaram**
- Campos não mencionados no `patch` ficam intactos
- `body` é opcional: se omitido, o corpo atual é preservado; se fornecido, substitui o corpo inteiro
- O schema Zod valida o frontmatter **completo após o merge**
- Campos desconhecidos são descartados pelo schema (sem `.passthrough()`)
- Retorna `{ metadata: T, content: string }`

**Exemplo:**
```ts
// Só altera o name. Body e demais campos do frontmatter não são tocados.
patchMarkdownAs(mdPath, { name: "Novo Nome" }, SkillMdSchema);

// Altera o name E substitui o corpo.
patchMarkdownAs(mdPath, { name: "Novo Nome" }, SkillMdSchema, "# Novo Nome\nConteúdo novo.\n");
```

#### Ler

```ts
readMarkdownAs(path, Schema)   // retorna { metadata: T, content: string } validado
readMarkdown(path)             // retorna { metadata: Record<string,unknown>, content: string } sem validação
```

---

## Encriptação automática

Campos cujo nome contém `key`, `secret`, `token`, `password` ou `pass` são **auto-criptografados** em repouso via AES-256-GCM. O valor é armazenado como `ENC(base64...)`.

- `writeYaml` / `writeYamlAs` / `patchYamlAs` — encriptam na escrita
- `readYaml` / `readYamlAs` — decriptam na leitura
- A chave é derivada de `JWT_SECRET` via scrypt

Credenciais de usuário ficam em `credentials/users/{slug}.yml` (separado do `USER.md`).

---

## Separação de concerns: USER

O usuário tem dois arquivos com responsabilidades distintas:

| Arquivo | Conteúdo | Quem lê |
|---|---|---|
| `USER.md` | Frontmatter (metadata estruturado) + corpo (perfil narrativo) | `users/manager.ts` (metadata) + `context/resolver.ts` (metadata + corpo → prompt do agente) |
| `credentials/users/{slug}.yml` | Credencial (password encriptado) | `users/manager.ts` — nunca vai para o agente |

O `resolveUserProfile()` injeta no prompt do agente tanto os dados estruturados (displayName, email, phoneNumber, role, location, timezone) quanto o corpo narrativo do `USER.md`.

---

## Regras de schema

- **Sem `.passthrough()`** — campos desconhecidos não são aceitos silenciosamente
- Campos variáveis por conector vão em `options: z.record(z.string(), z.unknown())` no schema
- Todo schema tem campos canônicos explícitos; extensões entram em `options`
- `writeYamlAs` e `patchYamlAs` sempre validam o documento completo antes de gravar
