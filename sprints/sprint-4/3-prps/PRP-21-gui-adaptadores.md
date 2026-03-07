# PRP-21 — GUI de Adaptadores (Gestao Visual de Conectores)

Interface no Hub para criar, editar, testar e remover adaptadores (MySQL, Postgres, Evolution, Twilio, HTTP) sem editar YAML manualmente.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Adaptadores sao gerenciados exclusivamente via edicao manual de arquivos `ADAPTER.yaml` no filesystem. O backend tem o sistema de conectores implementado (`src/connectors/`) e o watcher de adaptadores, mas nao expoe endpoints de gerenciamento via API. A UI nao tem pagina de adaptadores.

### Estado desejado

1. Endpoints CRUD para adaptadores + endpoint de teste de conexao
2. Pagina `/adapters` no Hub com listagem de adaptadores e cards
3. AdapterDialog com formulario dinamico por tipo de conector
4. Mascaramento de credenciais sensiveis na API e UI
5. Teste de conexao inline antes de salvar

## Especificacao

### Feature F-084: Endpoints CRUD de adaptadores + teste de conexao

**Novos endpoints em `apps/backbone/src/routes/adapters.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/adapters` | Listar todos os adaptadores (todos os scopes) |
| GET | `/adapters/:slug` | Detalhe de um adaptador |
| POST | `/adapters` | Criar novo adaptador |
| PATCH | `/adapters/:slug` | Atualizar adaptador existente |
| DELETE | `/adapters/:slug` | Remover adaptador |
| POST | `/adapters/:slug/test` | Testar conexao |

**GET `/adapters` response** — credenciais sensiveis mascaradas com `maskSensitiveFields()` de `utils/sensitive.ts`:

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
      "credential": { "host": "localhost", "port": 3306, "user": "root", "password": "***", "database": "crm" }
    }
  ]
}
```

**POST `/adapters` payload:**

```json
{
  "slug": "crm-mysql",
  "connector": "mysql",
  "scope": "shared",
  "label": "CRM MySQL",
  "policy": "readwrite",
  "credential": { "host": "localhost", "port": 3306, "user": "root", "password": "minhasenha", "database": "crm" },
  "options": {}
}
```

Backend grava `ADAPTER.yaml` no path correto conforme `scope`:
- `shared` → `context/shared/adapters/{slug}/ADAPTER.yaml`
- `system` → `context/system/adapters/{slug}/ADAPTER.yaml`

Suporte a `${VAR}` no valor de credenciais — gravar literalmente sem resolver.

**POST `/adapters/:slug/test` response:**

```json
{ "ok": true, "latencyMs": 42, "message": "Conexao bem-sucedida" }
```
ou
```json
{ "ok": false, "error": "ECONNREFUSED — nenhum servico em localhost:3306" }
```

Usa o `ConnectorDef` do conector para instanciar cliente e executar ping (`SELECT 1` para MySQL/Postgres, probe HTTP para outros).

**Hub — `apps/hub/src/api/adapters.ts`:**

```typescript
export const adaptersQueryOptions = () =>
  queryOptions({
    queryKey: ["adapters"],
    queryFn: () => request<Adapter[]>("/adapters"),
  });
```

Montar rotas no `index.ts` do backbone.

### Feature F-085: Pagina /adapters com listagem e filtros

**Nova rota** `routes/_authenticated/adapters/index.tsx`.

Item "Adaptadores" (icone: `Plug`) no menu lateral em secao "Integracoes".

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `AdaptersPage` | `routes/_authenticated/adapters/index.tsx` |
| `AdapterCard` | `components/adapters/adapter-card.tsx` |
| `ConnectionTestResult` | `components/adapters/connection-test-result.tsx` |

**AdapterCard** exibe:
- Slug e label
- Badge de tipo de conector (MySQL, Postgres, Evolution, Twilio, HTTP)
- Scope (shared / system)
- Toggle de ativo/inativo (PATCH `enabled`)
- Botao "Testar" com feedback inline: spinner → checkmark verde + latencia ou X vermelho + erro
- Menu `[...]` com opcoes Editar e Remover

**Filtros horizontais** no topo da pagina: Todos | MySQL | Postgres | Evolution | Twilio | HTTP

Botao "+ Novo Adaptador" abre `AdapterDialog`.

### Feature F-086: AdapterDialog com formulario dinamico por conector

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `AdapterDialog` | `components/adapters/adapter-dialog.tsx` |
| `ConnectorForm` | `components/adapters/connector-form.tsx` |

**AdapterDialog** — Sheet (drawer lateral) com:

1. `connector` — Select: MySQL, Postgres, Evolution, Twilio, HTTP
2. `label` — nome legivel
3. `slug` — auto-gerado a partir de label (slugify), editavel
4. `scope` — Select: shared, system (agent-scoped nao disponivel nesta versao)
5. `policy` — Select: readonly, readwrite
6. `ConnectorForm` — campos dinamicos conforme conector selecionado (ver abaixo)
7. Botao "Testar conexao" — executa POST `test` antes de salvar; feedback inline
8. Botao "Salvar" — habilitado apos teste OK ou se editando adaptador existente

**ConnectorForm — campos por conector:**

| Conector | Campos |
|----------|--------|
| MySQL / Postgres | Host (text), Porta (number, default 3306/5432), Usuario (text), Senha (password), Banco de dados (text), SSL (toggle) |
| Evolution | URL da instancia (text), API Key (password), Nome da instancia (text) |
| Twilio | Account SID (text), Auth Token (password), Numero de telefone (text) |
| HTTP | URL base (text), Headers JSON (textarea), Auth Bearer Token (password), Timeout ms (number, default 5000) |

Campos do tipo `password` — se adaptador existente: exibir valor mascarado. Botao "Alterar" ao lado limpa o campo para novo input (valor nao enviado ao servidor se nao alterado).

## Limites

- **NAO** gerenciar adaptadores scoped a agentes especificos (apenas shared e system)
- **NAO** implementar importacao/exportacao de adaptadores em bulk
- **NAO** implementar historico de versoes de configuracao de adaptador
- **NAO** suportar conectores customizados via plugin (apenas os 5 built-in)

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado

## Validacao

- [ ] GET `/adapters` retorna lista com credenciais mascaradas
- [ ] POST `/adapters` grava `ADAPTER.yaml` no path correto conforme `scope`
- [ ] PATCH `/adapters/:slug` atualiza arquivo existente
- [ ] DELETE `/adapters/:slug` remove arquivo do filesystem
- [ ] POST `/adapters/:slug/test` executa probe e retorna ok/erro
- [ ] Pagina `/adapters` lista adaptadores com cards
- [ ] Filtros por tipo de conector funcionais
- [ ] Toggle de ativo/inativo funcional
- [ ] Botao "Testar" no card com feedback inline
- [ ] AdapterDialog abre como sheet lateral
- [ ] ConnectorForm muda campos conforme tipo de conector selecionado
- [ ] Campos de senha mascarados na edicao; "Alterar" limpa para redigitar
- [ ] Slug auto-gerado a partir de label
- [ ] Menu lateral inclui "Adaptadores" com link funcional
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-084 Endpoints CRUD + test | S-021 sec 3 | D-036 |
| F-085 Pagina /adapters + cards | S-021 sec 5.1 | G-037 |
| F-086 AdapterDialog + ConnectorForm | S-021 sec 4, 5.2-5.3 | G-037 |
