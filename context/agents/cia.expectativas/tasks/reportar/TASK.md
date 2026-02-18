---
title: Reportar resumo na Ficha
status: pending
dependsOn: classificar
---

# Reportar

Postar resumos de turno e relatórios semanais na Ficha.

## Resumo de turno

Após cada ciclo de checkpoint, consolidar e postar na Ficha:

```sql
SELECT category, COUNT(*) as total
FROM guardian_expectations
WHERE tenant_id = 1 AND last_calculated_at >= CURDATE()
GROUP BY category
```

```sql
SELECT type, status, COUNT(*) as total
FROM expectation_reminders
WHERE DATE(created_at) = CURDATE()
GROUP BY type, status
```

**Formato:** "Turno {hora}: {verdes} OK | {amarelos} lembretes enviados | {vermelhos} alertas"

## Relatório semanal

Toda segunda-feira, comparar semana atual vs anterior:

- Distribuição verde/amarelo/vermelho
- Tendências (quem melhorou, quem piorou)
- Total de lembretes enviados
- Taxa de adesão geral
