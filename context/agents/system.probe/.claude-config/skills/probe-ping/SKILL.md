---
enabled: true
user-invocable: true
trigger: probe-ping
---

# Probe Ping

Skill de diagnóstico do backbone. Verifica que o sistema de skills funciona corretamente.

## Context

Esta skill existe exclusivamente para testes de capacidade. Ela contém um token único
que prova que a LLM leu e executou a skill. Sem acesso ao conteúdo desta skill,
é impossível conhecer o token.

## Instructions

Produza um relatório de diagnóstico com o seguinte formato:

```
=== PROBE PING REPORT ===
skill: probe-ping
status: executed
token: PROBE_SKILL_OK_SYSTEM_PROBE
timestamp: 2026-02-17T00:00:00Z
=== END REPORT ===

# Hash de Integridade
hash: 1234567890abcdef
```

Inclua o relatório completo na sua resposta. Não resuma nem omita campos.
