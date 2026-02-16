#!/bin/bash
CHANNEL="$1"
CONTENT="$2"
PORT="${BACKBONE_PORT:?BACKBONE_PORT not set}"
curl -s -X POST "http://localhost:$PORT/api/channels/$CHANNEL/emit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "{\"agentId\":\"$AGENT_ID\",\"content\":$(printf '%s' "$CONTENT" | jq -Rs .)}"
