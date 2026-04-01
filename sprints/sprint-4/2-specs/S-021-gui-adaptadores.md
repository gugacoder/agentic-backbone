# S-021 — GUI de Adaptadores (Gestao Visual de Conectores)

Interface no Hub para criar, editar, testar e remover adaptadores (MySQL, Postgres, Evolution, Twilio, HTTP) sem editar YAML manualmente.

---

## 1. Objetivo

- Expor via API os adaptadores existentes no filesystem (`context/.../adapters/*/ADAPTER.yaml`)
- Pagina `/adapters` com listagem, criacao por formulario dinamico por tipo de conector, edicao de credenciais e teste de conexao
- Credenciais mascaradas na UI usando `utils/sensitive.ts` ja existente no backend
- Resolver D-036 (sem GUI para gerenciar adaptadores), G-037 (GUI de adaptadores)

---

## 2. Sem Schema DB

Adaptadores persistem como YAML no filesystem (`context/{shared,system,agent}/adapters/{slug}/ADAPTER.yaml`), seguindo a convencao atual do backend. Nao ha nova tabela.

---

## 3. API Endpoints

O backend ja tem framework de conectores. Sao necessarias novas rotas para expor gerenciamento via API:

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/adapters` | Listar todos os adaptadores |
| GET | `/adapters/:slug` | Detalhe de um adaptador |
| POST | `/adapters` | Criar novo adaptador |
| PATCH | `/adapters/:slug` | Atualizar adaptador |
| DELETE | `/adapters/:slug` | Remover adaptador |
| POST | `/adapters/:slug/test` | Testar conexao |

### 3.1 GET `/adapters` — Response

```json
{
  "adapters": [
    {
      "slug": "crm-mysql",
      "connector": "mysql",
      "scope": "shared",
      "label": "CRM MySQL",
      "enabled": true,
      "policy": "readwrite",
      "credential": {
        "host": "localhost",
        "port": 3306,
        "user": "root",
        "password": "***",
        "database": "crm"
      }
    }
  ]
}
```

Credenciais sensiveis mascaradas usando `isSensitiveField()` de `utils/sensitive.ts`.

### 3.2 POST `/adapters` — Payload

```json
{
  "slug": "crm-mysql",
  "connector": "mysql",
  "scope": "shared",
  "label": "CRM MySQL",
  "policy": "readwrite",
  "credential": {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "minhasenha",
    "database": "crm"
  },
  "options": {}
}
```

Backend grava `ADAPTER.yaml` no path correspondente ao `scope` (`shared`, `system`, ou `agents/:ownerId`).

Suporte a env var interpolation: se o usuario digitar `${MY_VAR}` no campo de credencial, gravar literalmente (sem resolucao).

### 3.3 POST `/adapters/:slug/test` — Response

```json
{
  "ok": true,
  "latencyMs": 42,
  "message": "Conexao bem-sucedida"
}
```

ou em caso de erro:

```json
{
  "ok": false,
  "error": "ECONNREFUSED — nenhum servico em localhost:3306"
}
```

O backend usa o `ConnectorDef` do conector para instanciar o cliente e executar um ping (ex: `SELECT 1` para MySQL/Postgres, probe HTTP para conectores HTTP).

---

## 4. Formulario Dinamico por Conector

Cada tipo de conector tem campos especificos. O frontend exibe formulario baseado no tipo selecionado:

### MySQL / Postgres

| Campo | Tipo | Obrigatorio |
|-------|------|-------------|
| Host | text | sim |
| Porta | number | sim (default: 3306 / 5432) |
| Usuario | text | sim |
| Senha | password | sim |
| Banco de dados | text | sim |
| SSL | toggle | nao |

### Evolution (WhatsApp)

| Campo | Tipo | Obrigatorio |
|-------|------|-------------|
| URL da instancia | text | sim |
| API Key | password | sim |
| Nome da instancia | text | sim |

### Twilio

| Campo | Tipo | Obrigatorio |
|-------|------|-------------|
| Account SID | text | sim |
| Auth Token | password | sim |
| Numero de telefone | text | sim |

### HTTP (API Generica)

| Campo | Tipo | Obrigatorio |
|-------|------|-------------|
| URL base | text | sim |
| Headers (JSON) | textarea | nao |
| Auth Bearer Token | password | nao |
| Timeout (ms) | number | nao (default: 5000) |

---

## 5. Telas

### 5.1 Pagina de Adaptadores (`/adapters`)

Nova pagina no menu lateral (icone: `Plug`), posicionada em secao "Integrações".

**Layout:**

```
+---sidebar---+--------content------------------------+
| ...         | Adaptadores                [+ Novo]   |
| > Adaptadores|                                      |
| ...         | [Filtro: Todos | MySQL | Postgres...] |
|             |                                       |
|             | crm-mysql            MySQL  [Testar]  |
|             | CRM MySQL — shared   ativo  [...]     |
|             |                                       |
|             | relatorios-pg        Postgres [Testar]|
|             | Relatorios — system  ativo   [...]     |
+-------------+---------------------------------------+
```

Cards de adaptador mostram:
- Slug e label
- Tipo de conector (badge)
- Scope (shared / system / agente)
- Status ativo/inativo (toggle)
- Botao "Testar" com feedback inline (OK verde / ERRO vermelho)
- Menu `[...]` com Editar e Remover

### 5.2 Dialog de Criacao/Edicao (`AdapterDialog`)

Sheet (drawer lateral) com:

1. Campo `connector` — Select com tipos disponiveis (MySQL, Postgres, Evolution, Twilio, HTTP)
2. Campo `label` — nome legivel
3. Campo `slug` — auto-gerado a partir de label, editavel
4. Campo `scope` — Select (shared, system) — agent-scoped nao disponivel na GUI nesta versao
5. Campo `policy` — Select (readonly, readwrite)
6. Formulario dinamico de credenciais baseado no `connector` selecionado
7. Botao "Testar conexao" antes de salvar — deve retornar OK para habilitar "Salvar"

Campos de senha mostram value mascarado se ja salvo. Clicar em "Alterar senha" limpa o campo para novo input.

### 5.3 Feedback de Teste de Conexao

Inline abaixo do formulario:
- Spinner durante teste
- Checkmark verde + latencia em ms se OK
- X vermelho + mensagem de erro se falhar

---

## 6. Componentes

| Componente | Localizacao |
|------------|-------------|
| `AdaptersPage` | `routes/_authenticated/adapters/index.tsx` |
| `AdapterCard` | `components/adapters/adapter-card.tsx` |
| `AdapterDialog` | `components/adapters/adapter-dialog.tsx` |
| `ConnectorForm` | `components/adapters/connector-form.tsx` |
| `ConnectionTestResult` | `components/adapters/connection-test-result.tsx` |

**API module:** `api/adapters.ts`

```typescript
export const adaptersQueryOptions = () =>
  queryOptions({
    queryKey: ["adapters"],
    queryFn: () => request<Adapter[]>("/adapters"),
  });
```

---

## 7. Criterios de Aceite

- [ ] Rotas de adaptadores implementadas no backend (CRUD + test)
- [ ] GET `/adapters` retorna lista com credenciais mascaradas
- [ ] POST `/adapters` grava `ADAPTER.yaml` no path correto conforme `scope`
- [ ] PATCH `/adapters/:slug` atualiza arquivo existente
- [ ] DELETE `/adapters/:slug` remove arquivo do filesystem
- [ ] POST `/adapters/:slug/test` executa probe do conector e retorna ok/erro
- [ ] Pagina `/adapters` lista adaptadores com cards
- [ ] Formulario dinamico muda campos conforme tipo de conector
- [ ] Teste de conexao funcional antes de salvar — feedback inline
- [ ] Campos de senha mascarados na edicao; "Alterar senha" limpa para redigitar
- [ ] Toggle de ativo/inativo funcional
- [ ] Menu lateral inclui "Adaptadores" com link funcional

---

## 8. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| CRUD de adaptadores via API | D-036 (edicao manual de YAML) |
| Formulario dinamico por conector | G-037 (campos dinamicos por tipo) |
| Teste de conexao | G-037 (test de conexao) |
| Mascaramento de credenciais | G-037 (mascaramento automatico), `utils/sensitive.ts` |
