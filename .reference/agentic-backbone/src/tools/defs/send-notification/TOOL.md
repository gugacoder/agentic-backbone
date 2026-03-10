---
enabled: true
name: send_notification
description: "Envia uma notificacao para um contato do sistema usando o gateway centralizado. Respeita listas de controle configuradas (interceptacao, bloqueios). Nao envia diretamente para WhatsApp ou email."
---

# send_notification

Envia uma notificacao para um contato do sistema.
Usa o gateway centralizado — respeita listas de controle configuradas (interceptacao, bloqueios).
Nao envia diretamente para WhatsApp ou email.

## Parametros

| param        | tipo                                    | obrigatorio |
|--------------|-----------------------------------------|-------------|
| source       | string                                  | sim         |
| event        | string                                  | sim         |
| contact_type | "funcionario"\|"cliente"\|"responsavel" | sim         |
| contact_id   | number                                  | sim         |
| message      | string                                  | sim         |
| media        | "whatsapp"\|"email"\|"both"             | sim         |
| attachments  | string[]                                | nao         |

## Resultado

Retorna `{ delivered, intercepted, suppressed, channels }`.

- `delivered`: true se entregue ao menos em um canal
- `intercepted`: true se redirecionado para interceptadores
- `suppressed`: true se suprimido (sem lista configurada, ou interceptado sem interceptadores)
- `channels`: canais efetivamente usados
