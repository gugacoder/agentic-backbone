#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
# PostgreSQL Connector — Mutation executor (DML only)
#
# Uso:
#   bash mutate.sh <adapter_dir> "<sql>"
#
# Exemplos:
#   bash mutate.sh ../../adapters/my-db "INSERT INTO ... VALUES (...)"
#   bash mutate.sh ../../adapters/my-db "UPDATE ... SET ... WHERE ..."
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

CONNECTOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADAPTER_DIR="${1:?Uso: mutate.sh <adapter_dir> \"<sql>\"}"
SQL="${2:?Uso: mutate.sh <adapter_dir> \"<sql>\"}"

# DML-only guard — no DDL allowed
SQL_UPPER=$(echo "$SQL" | tr '[:lower:]' '[:upper:]' | sed 's/^[[:space:]]*//')
case "$SQL_UPPER" in
  DROP*|ALTER*|TRUNCATE*|CREATE*|RENAME*|GRANT*|REVOKE*)
    echo "Erro: operações DDL não são permitidas." >&2
    exit 1
    ;;
  SELECT*|SHOW*|DESCRIBE*|EXPLAIN*)
    echo "Erro: use query.sh para consultas." >&2
    exit 1
    ;;
esac

node "$CONNECTOR_DIR/exec.mjs" "$ADAPTER_DIR" mutate "$SQL"
