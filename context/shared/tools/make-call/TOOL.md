---
name: make-call
description: Liga pro usuário via telefone quando precisa de resposta urgente
---

# Make Call

Inicia uma ligação telefônica para o usuário via Twilio.
Use quando precisar de uma resposta urgente e o usuário não respondeu no WhatsApp.

## Uso

  bash <tool_dir>/make-call.sh "<motivo_da_ligacao>"

O motivo é falado pro usuário quando ele atender.

Exemplo:

  bash <tool_dir>/make-call.sh "Preciso da sua aprovação sobre o deploy do projeto X"
