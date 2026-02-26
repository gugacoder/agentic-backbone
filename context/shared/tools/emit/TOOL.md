---
name: emit
description: Emite eventos em canais SSE do backbone
---

# Emit

Emita mensagens em canais SSE. Consumidores conectados ao canal recebem em tempo real.

## Uso

  bash <tool_dir>/emit.sh <channel_slug> <content_json>

Exemplo:

  bash <tool_dir>/emit.sh my-agent.events '{"action":"created","type":"band_change","title":"Pedro Silva: vermelho"}'
