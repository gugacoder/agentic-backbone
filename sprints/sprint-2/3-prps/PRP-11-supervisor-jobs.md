# PRP-11 — Supervisor de Jobs

Interface para monitorar, gerenciar e cancelar processos de longa duracao com stdout/stderr em streaming e metricas de recursos.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O Hub nao tem pagina de jobs. O backbone expoe:

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/jobs` | Listar jobs (opcional `?agentId=`) |
| GET | `/jobs/:id` | Detalhe de um job |
| POST | `/jobs` | Submeter novo job |
| POST | `/jobs/:id/kill` | Matar job em execucao |
| DELETE | `/jobs/:id` | Limpar job concluido |

SSE: evento `job:status` emitido quando job muda de estado.

Modelo existente:

```typescript
interface JobSummary {
  id: string;
  agentId: string;
  command: string;
  cwd?: string;
  status: "running" | "completed" | "failed" | "killed" | "timeout";
  pid?: number;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
  stdout: string;
  stderr: string;
  cpu?: number;
  memory?: number;
  timeout?: number;
}
```

### Estado desejado

1. Endpoint `GET /jobs/:id/stream` (SSE de stdout/stderr em tempo real)
2. Pagina `/jobs` com lista filtrada por status e agente
3. Drawer de detalhe com terminal view, metricas e acoes (kill, limpar)
4. "Jobs" no menu lateral

## Especificacao

### Feature F-041: Endpoint /jobs/:id/stream + API module

**Backend — novo handler em `routes/jobs.ts`:**

Endpoint SSE `GET /jobs/:id/stream` que emite linhas de stdout/stderr conforme chegam:

```
event: stdout
data: {"line": "Processing item 42/100...", "ts": "2026-03-07T14:00:01Z"}

event: stderr
data: {"line": "Warning: deprecated API", "ts": "2026-03-07T14:00:02Z"}

event: status
data: {"status": "completed", "exitCode": 0, "finishedAt": "2026-03-07T14:05:00Z"}
```

Para jobs ja concluidos, retorna imediatamente stdout/stderr acumulados + evento `status` e encerra.

**Hub — API module `api/jobs.ts`:**

```typescript
export const jobsQueryOptions = (agentId?: string) =>
  queryOptions({
    queryKey: agentId ? ["jobs", { agentId }] : ["jobs"],
    queryFn: () => request<JobSummary[]>(
      agentId ? `/jobs?agentId=${agentId}` : "/jobs"
    ),
  });

export const jobQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["jobs", id],
    queryFn: () => request<JobSummary>(`/jobs/${id}`),
  });
```

### Feature F-042: Lista de jobs em /jobs

**Nova rota** `routes/_authenticated/jobs.tsx`:

- Fetch via `jobsQueryOptions()`
- SSE evento `job:status` invalida `["jobs"]`

**Tabela (shadcn Table, desktop) / cards (mobile):**

| Coluna | Fonte | Visual |
|--------|-------|--------|
| Status | `job.status` | Badge colorido (running=azul, completed=verde, failed=vermelho, killed=cinza) |
| Agente | `job.agentId` | Badge com nome |
| Comando | `job.command` | Texto truncado (tooltip completo) |
| Inicio | `job.startedAt` | Timestamp relativo |
| Duracao | calculado | "5m 32s" ou "rodando ha 2m" |
| CPU | `job.cpu` | Texto "12%" |
| Memoria | `job.memory` | Texto formatado "45 MB" |

**Filtros (PageHeader):**
- Por status: todos / rodando / concluidos / falhos (toggle group)
- Por agente (Select)

**Click na linha** → drawer de detalhe (rota `/jobs/:id`)

**Navegacao — adicionar "Jobs" ao menu lateral:**

| Item | Icone | Rota |
|------|-------|------|
| Jobs | Cpu | `/jobs` |

### Feature F-043: Detalhe do job com TerminalOutput

**Rota** `/jobs/:id` renderiza drawer sobre lista.

**Header:**
- Status badge grande
- Agente, comando, PID
- Botoes: "Cancelar" (se running → `POST /jobs/:id/kill`), "Limpar" (se concluido → `DELETE /jobs/:id`)

**components/jobs/terminal-output.tsx:**

```typescript
interface TerminalOutputProps {
  stdout: string;
  stderr: string;
  streaming?: boolean;
  streamUrl?: string;
}
```

- Fundo escuro, fonte monoespaco
- Linhas de stderr em vermelho
- Auto-scroll com toggle
- Para jobs ativos: conecta no SSE `/jobs/:id/stream`
- Para jobs concluidos: exibe stdout/stderr acumulados
- Maximo 10.000 linhas visiveis

**Metricas (secao abaixo do terminal):**
- CPU: valor atual
- Memoria: valor formatado
- Exit code (se concluido)
- Duracao total

**Acoes:**
- Cancelar: `POST /jobs/:id/kill` → toast, invalida `["jobs"]` e `["jobs", id]`
- Limpar: `ConfirmDialog` → `DELETE /jobs/:id` → toast, invalida `["jobs"]`, fecha drawer

## Limites

- **NAO** implementar submissao de jobs pela UI — apenas visualizacao e gerenciamento de jobs criados pelos agentes.
- **NAO** implementar graficos de CPU/memoria ao longo do tempo — apenas valor instantaneo.
- **NAO** implementar virtualizacao no terminal a menos que necessario — manter simples com limite de 10.000 linhas.
- **NAO** usar polling — SSE para streaming e atualizacao de lista.

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado.

## Validacao

- [ ] Rota `/jobs` exibe lista de todos os jobs
- [ ] Filtro por status funciona (todos / rodando / concluidos / falhos)
- [ ] Filtro por agente funciona
- [ ] Click na linha abre drawer com detalhe
- [ ] Stdout/stderr exibidos em terminal view com cores distintas
- [ ] Jobs ativos mostram stdout em streaming via SSE `/jobs/:id/stream`
- [ ] Auto-scroll funciona e pode ser desabilitado
- [ ] Botao "Cancelar" mata job e atualiza status
- [ ] Botao "Limpar" remove job concluido
- [ ] SSE `job:status` atualiza lista automaticamente
- [ ] CPU e memoria exibidos para jobs ativos
- [ ] Layout responsivo: tabela (desktop), cards (mobile)
- [ ] Menu lateral inclui "Jobs"
- [ ] `npm run build:hub` compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-041 Stream endpoint | S-011 sec 2.2 | D-019, G-019 |
| F-042 Lista jobs | S-011 sec 3.1 | D-019, G-019 |
| F-043 Detalhe + terminal | S-011 sec 3.2 | D-019, G-019 |
