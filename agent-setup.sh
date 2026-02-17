#!/usr/bin/env bash
set -euo pipefail

echo "=== Agent Setup: agenticbackbone-06-kai-structured-outputs ==="

# ── Detect package manager ───────────────────────────────────
if command -v npm &>/dev/null; then
  PKG="npm"
elif command -v pnpm &>/dev/null; then
  PKG="pnpm"
elif command -v yarn &>/dev/null; then
  PKG="yarn"
elif command -v bun &>/dev/null; then
  PKG="bun"
else
  echo "FATAL: no package manager found (npm, pnpm, yarn, bun)"
  exit 1
fi

echo "[setup] package manager: $PKG"

# ── Install dependencies ─────────────────────────────────────
echo "[setup] installing dependencies..."
$PKG install

# ── Check .env exists ────────────────────────────────────────
if [ ! -f .env ]; then
  echo "WARN: .env file not found — backbone will fail to start without required env vars"
fi

# ── Platform services (Docker Compose) ───────────────────────
if command -v docker &>/dev/null && [ -f docker-compose.platform.yml ]; then
  echo "[setup] starting platform services..."
  npm run platform:up || echo "WARN: platform:up failed — some modules may not work"
else
  echo "[setup] skipping docker (not available or no compose file)"
fi

# ── Build check ──────────────────────────────────────────────
echo "[setup] building kai-sdk..."
npm run build --workspace=packages/kai-sdk || {
  echo "WARN: kai-sdk build failed"
}

echo "[setup] building backbone..."
npm run build --workspace=apps/backbone || {
  echo "WARN: backbone build failed"
}

echo "[setup] building hub..."
npm run build --workspace=apps/hub || {
  echo "WARN: hub build failed"
}

# ── Start dev server (background) ────────────────────────────
echo "[setup] starting backbone dev server..."
npm run dev:backbone &
BACKBONE_PID=$!
sleep 3

# ── Smoke test ───────────────────────────────────────────────
BACKBONE_PORT="${BACKBONE_PORT:-7700}"
echo "[setup] smoke test: GET http://localhost:$BACKBONE_PORT/health"

if curl -sf "http://localhost:$BACKBONE_PORT/health" > /dev/null 2>&1; then
  echo "[setup] backbone health: OK"
else
  echo "WARN: backbone health check failed (may still be starting)"
fi

# ── Stop dev server ──────────────────────────────────────────
kill $BACKBONE_PID 2>/dev/null || true
wait $BACKBONE_PID 2>/dev/null || true

# ── Summary ──────────────────────────────────────────────────
echo ""
echo "=== Setup Summary ==="
echo "Package manager: $PKG"
echo "Dependencies: installed"
echo "Backbone build: attempted"
echo "Hub build: attempted"
echo "Harness: .harness/agenticbackbone-06-kai-structured-outputs--cc/"
echo "Features: 6 (all failing)"
echo "First feature: F-001 kai-generate-object"
echo "=== Ready for vibe:code ==="
