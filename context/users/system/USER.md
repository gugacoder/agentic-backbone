---
slug: system
displayName: System
email: ""
role: sysadmin
canCreateAgents: true
canCreateChannels: true
maxAgents: 10
---

# System User

Usuário built-in do backbone. Representa o próprio sistema — não é uma pessoa.

## Propósito

- Dono dos agentes de nível de sistema (`system.main`, `system.probe`, etc.).
- Dono do `system-channel` — canal padrão para output de heartbeat e respostas do sistema.
- Contexto de autenticação para operações internas (cron jobs, heartbeat, startup hooks).

## Escopo

- Acesso total a todos os agentes, canais e configurações.
- Sem restrições de quota — o sistema opera sem limites artificiais.
- Credenciais gerenciadas via `context/credentials/users/system.yml`.
