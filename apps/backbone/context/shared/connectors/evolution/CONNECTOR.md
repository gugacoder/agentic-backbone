---
name: Evolution
engine: evolution
description: Conector para WhatsApp via Evolution API v2
---

# Evolution Connector

Conector para WhatsApp via [Evolution API](https://doc.evolution-api.com/) v2.

## Arquivos do Engine

| Arquivo | Função |
|---------|--------|
| `adapter.mjs` | Factory Node.js — `createAdapter(dir)` → `{ send, get, close }` |
| `exec.mjs` | Executor CLI — `node exec.mjs <env-path> <get\|send> <endpoint> [json-body]` |
| `send.sh` | Interface shell — `bash send.sh <adapter-dir> <endpoint> <json-body>` |

## Interface

A interface reflete a natureza do canal:

- **`send(endpoint, body)`** — envia mensagens e executa ações (POST)
- **`get(endpoint)`** — consulta status, listas e dados (GET)

## Endpoints Principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/instance/connectionState/{instance}` | Status da conexão WhatsApp |
| GET | `/instance/list` | Lista instâncias |
| POST | `/message/sendText/{instance}` | Envia mensagem de texto |
| POST | `/message/sendMedia/{instance}` | Envia mídia (imagem, vídeo, documento) |
| POST | `/message/sendAudio/{instance}` | Envia áudio (PTT) |
| GET | `/group/fetchAllGroups/{instance}` | Lista grupos |
| POST | `/webhook/set/{instance}` | Configura webhook |

## Formato de Número WhatsApp

Números devem estar no formato internacional sem `+`, espaços ou traços:

- Brasil: `5511999999999` (55 = país, 11 = DDD, 9 dígitos)
- Grupos: `120363xxxxx@g.us`
