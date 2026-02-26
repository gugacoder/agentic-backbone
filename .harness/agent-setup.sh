#!/usr/bin/env bash
# agent-setup.sh — Bootstrap para worktree chat-history-mongodb
# Executar da raiz da worktree: bash agent-setup.sh

set -e

WT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "[setup] Worktree: $WT_DIR"

# Carregar .env
if [ -f "$WT_DIR/.env" ]; then
  set -a; source "$WT_DIR/.env"; set +a
  echo "[setup] .env carregado (CIA_API_PORT=$CIA_API_PORT, CIA_APP_PORT=$CIA_APP_PORT)"
fi

# Instalar dependencias
echo "[setup] Instalando dependencias..."
cd "$WT_DIR"
npm install --silent 2>/dev/null || echo "[setup] WARN: npm install falhou — verifique manualmente"

# Verificar variaveis MongoDB
if [ -z "${MONGODB_URI}" ]; then
  echo "[setup] WARN: MONGODB_URI nao definida — chat history nao sera persistido"
else
  echo "[setup] MONGODB_URI: definida"
fi

# TypeScript check cia-api
echo "[setup] Verificando TypeScript em cia-api..."
cd "$WT_DIR/apps/cia-api"
npx tsc --noEmit 2>&1 | tail -5 || echo "[setup] WARN: TypeScript com erros em cia-api"

# TypeScript check cia-app
echo "[setup] Verificando TypeScript em cia-app..."
cd "$WT_DIR/apps/cia-app"
npx tsc --noEmit 2>&1 | tail -5 || echo "[setup] WARN: TypeScript com erros em cia-app"

cd "$WT_DIR"
echo ""
echo "=== Resumo do Estado ==="
echo "  Worktree:      $WT_DIR"
echo "  Branch:        $(git branch --show-current)"
echo "  CIA_API_PORT:  ${CIA_API_PORT:-NAO_DEFINIDO}"
echo "  CIA_APP_PORT:  ${CIA_APP_PORT:-NAO_DEFINIDO}"
echo "  MONGODB_URI:   ${MONGODB_URI:-NAO_DEFINIDA}"
echo ""
echo "  Para iniciar o backend:  npm run dev:cia-app:backend"
echo "  Para iniciar o frontend: npm run dev:cia-app:frontend"
echo "  Para rodar e2e:          npx playwright test -w cia-frontend"
