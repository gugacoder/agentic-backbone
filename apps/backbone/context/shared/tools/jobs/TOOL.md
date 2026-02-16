---
name: jobs
description: Submete processos longos ao backbone para supervisão
---

# Jobs

Submeta processos que demoram mais que seu turno ao backbone.
O backbone supervisiona e te acorda quando o job terminar.

## Submeter

```bash
bash <tool_dir>/submit.sh "<command>" [timeout_seconds]
```

Retorna JSON com id, pid, status.

## Consultar

```bash
bash <tool_dir>/status.sh [job_id]
```

Sem job_id: lista seus jobs. Com job_id: detalhe do job.

## Matar

```bash
bash <tool_dir>/kill.sh <job_id>
```
