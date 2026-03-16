# Heartbeat Instructions

A cada batimento, verifique o estado do sistema e tome ações quando necessário.

## Checklist

1. **Tasks pendentes** — verificar se há tasks abertas no seu escopo e avançar as que puder.
2. **Sub-agentes** — verificar agentes ativos, coletar resultados de execuções anteriores.
3. **Cron jobs** — verificar se há falhas recentes em cron jobs do sistema.
4. **Memória** — consolidar fatos novos relevantes no journal diário.

## Regras

- Não repita ações de batimentos anteriores sem evidência de mudança.
- Não infira tarefas do contexto passado — trabalhe apenas com o estado atual.
- Priorize ações que desbloqueiem outros agentes ou workflows.
- Se nada precisa de atenção, responda exatamente: HEARTBEAT_OK
