#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
# MySQL Connector — Query executor (read-only)
#
# Uso:
#   bash query.sh <adapter_dir> "<sql>"
#
# Exemplos:
#   bash query.sh ../../adapters/cia-prime "SELECT COUNT(*) FROM funcionarios"
#   bash query.sh ../../adapters/cia-prime "SHOW TABLES"
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

CONNECTOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADAPTER_DIR="${1:?Uso: query.sh <adapter_dir> \"<sql>\"}"
SQL="${2:?Uso: query.sh <adapter_dir> \"<sql>\"}"

# Read-only guard
SQL_UPPER=$(echo "$SQL" | tr '[:lower:]' '[:upper:]' | sed 's/^[[:space:]]*//')
case "$SQL_UPPER" in
  INSERT*|UPDATE*|DELETE*|DROP*|ALTER*|TRUNCATE*|CREATE*|MERGE*|REPLACE*|RENAME*|GRANT*|REVOKE*|LOAD*)
    echo "Erro: operações de escrita não são permitidas. Somente SELECT." >&2
    exit 1
    ;;
esac

node "$CONNECTOR_DIR/exec.mjs" "$ADAPTER_DIR" query "$SQL"
