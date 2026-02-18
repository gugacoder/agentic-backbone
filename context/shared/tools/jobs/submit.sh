#!/bin/bash
COMMAND="$1"
TIMEOUT="${2:-1800}"
PORT="${BACKBONE_PORT:?BACKBONE_PORT not set}"
curl -s -X POST "http://localhost:$PORT/api/jobs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "{\"agentId\":\"$AGENT_ID\",\"command\":$(printf '%s' "$COMMAND" | jq -Rs .),\"timeout\":$TIMEOUT}"
