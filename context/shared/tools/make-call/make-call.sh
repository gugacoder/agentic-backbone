#!/bin/bash
REASON="$1"
PORT="${BACKBONE_PORT:?BACKBONE_PORT not set}"

curl -s -X POST "http://localhost:$PORT/modules/twilio/calls" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"to\": \"+5532998055022\", \"channelId\": \"voice\", \"reason\": $(printf '%s' "$REASON" | jq -Rs .)}"
