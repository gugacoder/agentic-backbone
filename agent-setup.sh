#!/usr/bin/env bash
# =============================================================================
# agent-setup.sh — Bootstrap script for Evolution Module
# Milestone: 02-evolution-module (Gestao robusta de conectividade Evolution API)
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
echo -e "${CYAN}  Milestone: 02-evolution-module${NC}"
echo -e "${CYAN}=======================================${NC}"
echo ""

# 1. Detect package manager and install dependencies
echo -e "${CYAN}[1/5] Installing dependencies...${NC}"
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

# 2. Docker platform (Evolution API needs postgres + redis + evolution)
echo -e "${CYAN}[2/5] Checking Docker platform...${NC}"
if [ -f "$SCRIPT_DIR/docker-compose.platform.yml" ]; then
    if command -v docker &>/dev/null; then
        # Check if platform services are running
        if docker compose -f docker-compose.platform.yml ps --quiet 2>/dev/null | head -1 &>/dev/null; then
            echo -e "${GREEN}Docker platform services detected.${NC}"
            echo -e "  To start: npm run platform:up"
            echo -e "  To check: npm run platform:ps"
        else
            echo -e "${YELLOW}Docker available but platform not running.${NC}"
            echo -e "  Start with: npm run platform:up"
        fi
    else
        echo -e "${YELLOW}Docker not found. Evolution API requires docker platform.${NC}"
    fi
else
    echo -e "${YELLOW}No docker-compose.platform.yml found.${NC}"
fi
echo ""

# 3. Check .env for required Evolution variables
echo -e "${CYAN}[3/5] Checking environment...${NC}"
if [ -f "$SCRIPT_DIR/.env" ]; then
    MISSING_VARS=""
    for VAR in EVOLUTION_API_URL EVOLUTION_API_KEY BACKBONE_PORT JWT_SECRET SYSUSER SYSPASS; do
        if ! grep -q "^${VAR}=" "$SCRIPT_DIR/.env" 2>/dev/null; then
            MISSING_VARS="$MISSING_VARS $VAR"
        fi
    done
    if [ -z "$MISSING_VARS" ]; then
        echo -e "${GREEN}.env has all required variables.${NC}"
    else
        echo -e "${YELLOW}Missing in .env:${MISSING_VARS}${NC}"
    fi
else
    echo -e "${RED}.env file not found! Copy .env.example and configure.${NC}"
fi
echo ""

# 4. Build the backbone
echo -e "${CYAN}[4/5] Building Backbone...${NC}"
npm run build --workspace=apps/backbone 2>&1 || {
    echo -e "${RED}Build failed! Check TypeScript errors above.${NC}"
    exit 1
}
echo -e "${GREEN}Build succeeded.${NC}"
echo ""

# 5. Smoke test
echo -e "${CYAN}[5/5] Smoke test...${NC}"

# Check build output
if [ -f "$BACKBONE_DIR/dist/index.js" ]; then
    echo -e "${GREEN}  dist/index.js exists.${NC}"
else
    echo -e "${RED}  dist/index.js not found! Build may have failed.${NC}"
    exit 1
fi

# Check modules directory
if [ -d "$BACKBONE_DIR/src/modules" ]; then
    MODULE_FILES=$(find "$BACKBONE_DIR/src/modules" -name "*.ts" | wc -l)
    echo -e "${GREEN}  src/modules/ exists with ${MODULE_FILES} TypeScript files.${NC}"
else
    echo -e "${YELLOW}  src/modules/ does not exist yet (expected after F-001).${NC}"
fi

# Check evolution module
if [ -d "$BACKBONE_DIR/src/modules/evolution" ]; then
    EVO_FILES=$(find "$BACKBONE_DIR/src/modules/evolution" -name "*.ts" | wc -l)
    echo -e "${GREEN}  src/modules/evolution/ exists with ${EVO_FILES} TypeScript files.${NC}"
else
    echo -e "${YELLOW}  src/modules/evolution/ does not exist yet (expected after F-005).${NC}"
fi

# Check context config
if [ -f "$BACKBONE_DIR/context/modules/evolution/CONFIG.yaml" ]; then
    echo -e "${GREEN}  context/modules/evolution/CONFIG.yaml exists.${NC}"
else
    echo -e "${YELLOW}  context/modules/evolution/CONFIG.yaml does not exist yet (expected after F-006).${NC}"
fi

echo ""

# Summary
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
echo -e "  Workspace:    $BACKBONE_DIR"
echo -e "  Milestone:    02-evolution-module"
echo -e "  Goal:         Gestao robusta de conectividade Evolution API"
echo -e "  Build:        npm run build --workspace=apps/backbone"
echo -e "  Dev:          npm run dev:backbone"
echo -e "  Platform:     npm run platform:up"
echo -e "  Validate:     npm run build --workspace=apps/backbone"
echo ""
echo -e "  Features:     13 total (4 module system infra + 8 evolution + 1 build validation)"
echo -e "  First task:   F-001 — Module System Types (src/modules/types.ts)"
echo ""
