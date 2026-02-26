---
name: send-message
description: Envia mensagens para canais do backbone (SSE) ou WhatsApp (Evolution API)
---

# send-message

Ferramenta unificada para envio de mensagens. Suporta dois destinos:

- **Canal backbone** — entrega via SSE para consumidores conectados ao Hub
- **WhatsApp** — entrega via Evolution API

## Uso

### Enviar para canal backbone

```bash
node <tool_dir>/send-message.mjs --channel <slug> --message "texto da mensagem"
```

Exemplo:

```bash
node <tool_dir>/send-message.mjs --channel handerson --message "CPU em 95% — possível sobrecarga"
```

### Enviar para WhatsApp

```bash
node <tool_dir>/send-message.mjs --whatsapp <numero> --message "texto da mensagem"
```

O número deve estar no formato internacional sem `+` (ex: `5532988889819`).

Para usar uma instância Evolution diferente da configurada no ADAPTER.yaml, passe `--instance`:

```bash
node <tool_dir>/send-message.mjs --whatsapp 5532988889819 --instance 988889819 --message "Alerta: disco C abaixo de 10%"
```

### Enviar para ambos ao mesmo tempo

```bash
node <tool_dir>/send-message.mjs --channel handerson --whatsapp 5532988889819 --instance 988889819 --message "Relatório de saúde do sistema"
```

## Variáveis de Ambiente

O script usa variáveis já disponíveis no runtime do agente:

| Variável | Descrição |
|----------|-----------|
| `BACKBONE_PORT` | Porta do backbone (obrigatória para canais) |
| `AUTH_TOKEN` | Token JWT interno (obrigatório para canais) |
| `AGENT_ID` | ID do agente que envia (opcional, default: `system.main`) |

Para WhatsApp, o script lê as credenciais do `ADAPTER.yaml` do adapter Evolution mais próximo no chain de resolução.
