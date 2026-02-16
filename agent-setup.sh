#!/usr/bin/env bash
# =============================================================================
# agent-setup.sh — Bootstrap script for KAI SDK development
# Milestone: 01-better-kay (Expanded toolset: 6 -> 18 tools)
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_DIR="$SCRIPT_DIR/packages/kai-sdk"

echo -e "${CYAN}=======================================${NC}"
echo -e "${CYAN}  KAI SDK — Agent Setup${NC}"
echo -e "${CYAN}  Milestone: 01-better-kay${NC}"
echo -e "${CYAN}=======================================${NC}"
echo ""

# 1. Detect package manager and install dependencies
echo -e "${CYAN}[1/4] Installing dependencies...${NC}"
cd "$SCRIPT_DIR"

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
if [ -f "$SCRIPT_DIR/docker-compose.yml" ] || [ -f "$SCRIPT_DIR/docker-compose.platform.yml" ]; then
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
cd "$SDK_DIR"
npm run build 2>&1 || {
    echo -e "${RED}Build failed! Check TypeScript errors above.${NC}"
    exit 1
}
echo -e "${GREEN}Build succeeded.${NC}"
echo ""

# 4. Smoke test — verify build output and tool count
echo -e "${CYAN}[4/4] Smoke test...${NC}"
if [ -f "$SDK_DIR/dist/index.js" ]; then
    echo -e "${GREEN}dist/index.js exists.${NC}"
else
    echo -e "${RED}dist/index.js not found! Build may have failed.${NC}"
    exit 1
fi

if [ -f "$SDK_DIR/dist/index.d.ts" ]; then
    echo -e "${GREEN}dist/index.d.ts exists.${NC}"
else
    echo -e "${YELLOW}dist/index.d.ts not found (declarations may be missing).${NC}"
fi

# Count tools registered in codingTools
TOOL_KEYS=$(node -e "
import('$SDK_DIR/dist/tools/index.js')
  .then(m => {
    const keys = Object.keys(m.codingTools);
    console.log(keys.length + ' tools: ' + keys.join(', '));
  })
  .catch(() => console.log('(could not inspect tools)'));
" 2>/dev/null || echo "(could not inspect tools)")
echo -e "${CYAN}Tools: ${TOOL_KEYS}${NC}"
echo ""

# Summary
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
echo -e "  Workspace:  $SDK_DIR"
echo -e "  Milestone:  01-better-kay"
echo -e "  Goal:       Expand KAI toolset from 6 to 18 tools"
echo -e "  Build:      npm run build --workspace=packages/kai-sdk"
echo -e "  Dev:        npm run dev (tsc --watch)"
echo -e "  Validate:   npm run build --workspace=packages/kai-sdk"
echo ""
