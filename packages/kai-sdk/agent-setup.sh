#!/usr/bin/env bash
# =============================================================================
# agent-setup.sh — Bootstrap script for KAI SDK development
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${CYAN}=======================================${NC}"
echo -e "${CYAN}  KAI SDK — Agent Setup${NC}"
echo -e "${CYAN}=======================================${NC}"
echo ""

# 1. Detect package manager and install dependencies
echo -e "${CYAN}[1/4] Installing dependencies...${NC}"
cd "$ROOT_DIR"

if [ -f "package-lock.json" ]; then
    npm install
elif [ -f "pnpm-lock.yaml" ]; then
    pnpm install
elif [ -f "yarn.lock" ]; then
    yarn install
elif [ -f "bun.lockb" ]; then
    bun install
else
    echo -e "${YELLOW}No lockfile found, using npm...${NC}"
    npm install
fi
echo -e "${GREEN}Dependencies installed.${NC}"
echo ""

# 2. Docker (optional — only if docker-compose exists at root)
echo -e "${CYAN}[2/4] Checking Docker...${NC}"
if [ -f "$ROOT_DIR/docker-compose.yml" ] || [ -f "$ROOT_DIR/docker-compose.platform.yml" ]; then
    if command -v docker &>/dev/null; then
        echo -e "${YELLOW}Docker compose files found. Skipping auto-start (use 'npm run platform:up' manually if needed).${NC}"
    else
        echo -e "${YELLOW}Docker not found. Skipping.${NC}"
    fi
else
    echo -e "${YELLOW}No docker-compose found. Skipping.${NC}"
fi
echo ""

# 3. Build the SDK
echo -e "${CYAN}[3/4] Building KAI SDK...${NC}"
cd "$SCRIPT_DIR"
npm run build 2>&1 || {
    echo -e "${RED}Build failed! Check TypeScript errors above.${NC}"
    exit 1
}
echo -e "${GREEN}Build succeeded.${NC}"
echo ""

# 4. Smoke test — verify build output exists
echo -e "${CYAN}[4/4] Smoke test...${NC}"
if [ -f "$SCRIPT_DIR/dist/index.js" ]; then
    echo -e "${GREEN}dist/index.js exists.${NC}"
else
    echo -e "${RED}dist/index.js not found! Build may have failed.${NC}"
    exit 1
fi

if [ -f "$SCRIPT_DIR/dist/index.d.ts" ]; then
    echo -e "${GREEN}dist/index.d.ts exists.${NC}"
else
    echo -e "${YELLOW}dist/index.d.ts not found (declarations may be missing).${NC}"
fi

# Count tools in source
TOOL_COUNT=$(grep -c "Tool\|tool" "$SCRIPT_DIR/src/tools/index.ts" 2>/dev/null | head -1 || echo "?")
echo -e "${CYAN}Tools index entries (approx): ${TOOL_COUNT}${NC}"
echo ""

# Summary
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
echo -e "  Workspace:  $SCRIPT_DIR"
echo -e "  Build:      npm run build"
echo -e "  Dev:        npm run dev (tsc --watch)"
echo -e "  Validate:   npm run build --workspace=packages/kai-sdk"
echo ""
