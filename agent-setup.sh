#!/usr/bin/env bash
# =============================================================================
# agent-setup.sh — Bootstrap script for Backbone Module System
# Milestone: 01-module-system (Modular extension system for the backbone)
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKBONE_DIR="$SCRIPT_DIR/apps/backbone"

echo -e "${CYAN}=======================================${NC}"
echo -e "${CYAN}  Backbone — Agent Setup${NC}"
echo -e "${CYAN}  Milestone: 01-module-system${NC}"
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

# 3. Build the backbone
echo -e "${CYAN}[3/4] Building Backbone...${NC}"
npm run build --workspace=apps/backbone 2>&1 || {
    echo -e "${RED}Build failed! Check TypeScript errors above.${NC}"
    exit 1
}
echo -e "${GREEN}Build succeeded.${NC}"
echo ""

# 4. Smoke test — verify build output and health endpoint
echo -e "${CYAN}[4/4] Smoke test...${NC}"
if [ -f "$BACKBONE_DIR/dist/index.js" ]; then
    echo -e "${GREEN}dist/index.js exists.${NC}"
else
    echo -e "${RED}dist/index.js not found! Build may have failed.${NC}"
    exit 1
fi

# Check that modules directory exists in source
if [ -d "$BACKBONE_DIR/src/modules" ]; then
    MODULE_FILES=$(ls "$BACKBONE_DIR/src/modules/"*.ts 2>/dev/null | wc -l)
    echo -e "${GREEN}src/modules/ exists with ${MODULE_FILES} TypeScript files.${NC}"
else
    echo -e "${YELLOW}src/modules/ does not exist yet (expected after F-001).${NC}"
fi

echo ""

# Summary
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
echo -e "  Workspace:  $BACKBONE_DIR"
echo -e "  Milestone:  01-module-system"
echo -e "  Goal:       Modular extension system for the backbone"
echo -e "  Build:      npm run build --workspace=apps/backbone"
echo -e "  Dev:        npm run dev:backbone"
echo -e "  Validate:   npm run build --workspace=apps/backbone"
echo ""
