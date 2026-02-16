#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
# Evolution Connector — Send (envia mensagem via POST)
#
# Uso:
#   bash send.sh <adapter-dir> <endpoint> <json-body>
#
# Exemplos:
#   bash send.sh ../../adapters/evolution "/message/sendText/evolution" '{"number":"5511999999999","text":"Olá!"}'
#   bash send.sh ../../adapters/evolution "/message/sendMedia/evolution" '{"number":"5511...","mediatype":"image","media":"https://..."}'
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

CONNECTOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ADAPTER_DIR="${1:?Uso: send.sh <adapter-dir> <endpoint> <json-body>}"
ENDPOINT="${2:?Uso: send.sh <adapter-dir> <endpoint> <json-body>}"
BODY="${3:?Uso: send.sh <adapter-dir> <endpoint> <json-body>}"

if [[ "$ENDPOINT" != /* ]]; then
  echo "Erro: endpoint deve começar com /. Recebido: $ENDPOINT" >&2
  exit 1
fi

node "$CONNECTOR_DIR/exec.mjs" "$ADAPTER_DIR" send "$ENDPOINT" "$BODY"
