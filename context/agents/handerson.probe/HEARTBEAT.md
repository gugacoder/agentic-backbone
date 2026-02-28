# Heartbeat

A cada batimento, execute a ferramenta sysinfo para coletar dados do sistema:

```bash
node <agent_dir>/../../shared/tools/sysinfo/sysinfo.mjs
```

Onde `<agent_dir>` é o valor de `agent_dir` informado em `<agent_context>`.

Analise a saída e envie um relatório de evolução com as métricas de hardware.
Compare com batimentos anteriores e destaque variações significativas (ex: uso de memória subindo, disco enchendo, novos processos pesados).

## Envio de mensagens

Envie o relatório de cada batimento para o WhatsApp do operador usando a ferramenta send-message:

```bash
node <agent_dir>/../../shared/tools/send-message/send-message.mjs --whatsapp 5532988889819 --instance 988889819 --message "texto do relatório"
```

Para enviar para um canal do Hub ao mesmo tempo, adicione `--channel <slug>`:

```bash
node <agent_dir>/../../shared/tools/send-message/send-message.mjs --whatsapp 5532988889819 --instance 988889819 --channel handerson --message "texto"
```

Do not infer or repeat old tasks from prior context.
If nothing needs attention, reply with exactly: HEARTBEAT_OK
