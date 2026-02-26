#!/usr/bin/env bash
# Mata processos que ocupam as portas do projeto, identificados por PID.
# Uso: npm run killports
#
# Portas verificadas: BACKBONE_PORT e HUB_PORT (lidas do .env via dotenv-cli).

set -euo pipefail

ports=("${BACKBONE_PORT}" "${HUB_PORT}")
killed=0

for port in "${ports[@]}"; do
  pid=$(lsof -ti :"$port" 2>/dev/null || true)
  if [[ -z "$pid" ]]; then
    echo "[killports] porta $port — livre"
    continue
  fi
  for p in $pid; do
    echo "[killports] porta $port — matando PID $p"
    kill "$p" 2>/dev/null || true
    ((killed++))
  done
done

if [[ $killed -eq 0 ]]; then
  echo "[killports] nenhum processo encontrado nas portas do projeto"
else
  echo "[killports] $killed processo(s) finalizado(s)"
fi
