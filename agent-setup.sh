#!/usr/bin/env bash
set -euo pipefail

echo "=== Agent Setup: agenticbackbone-11-kai-needs-approval ==="

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

# ── Smoke test (build only — no dev server needed for SDK work) ──
echo "[setup] verifying kai-sdk dist output..."
if [ -f packages/kai-sdk/dist/index.js ]; then
  echo "[setup] kai-sdk dist: OK"
else
  echo "WARN: kai-sdk dist/index.js not found"
fi

# ── Summary ──────────────────────────────────────────────────
echo ""
echo "=== Setup Summary ==="
echo "Package manager: $PKG"
echo "Dependencies: installed"
echo "kai-sdk build: attempted"
echo "Harness: .harness/agenticbackbone-11-kai-needs-approval--cc/"
echo "Features: 10 (all failing)"
echo "First feature: F-001 types-tool-approval"
echo "=== Ready for vibe:code ==="
