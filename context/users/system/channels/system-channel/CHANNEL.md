---
slug: system-channel
owner: system
type: system
agent: system.main
description: "Canal built-in do sistema para output de agentes system-level"
---

# System Channel

Canal padrão do backbone para mensagens de nível de sistema.

## Uso

- Recebe output de heartbeat do `system.main` e outros agentes do sistema.
- Entrega respostas de conversas iniciadas via API com o usuário `system`.
- Acessível via SSE em `/api/v1/ai/channels/system-channel/events`.

## Comportamento

- Tipo `system` — não é vinculado a nenhum conector externo (WhatsApp, Twilio, etc.).
- Mensagens são entregues exclusivamente via SSE para clientes conectados ao Hub.
