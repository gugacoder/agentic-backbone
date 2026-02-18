#!/bin/bash
PORT="${BACKBONE_PORT:?BACKBONE_PORT not set}"
if [ -z "$1" ]; then
  curl -s "http://localhost:$PORT/api/jobs?agentId=$AGENT_ID" \
    -H "Authorization: Bearer $AUTH_TOKEN"
else
  curl -s "http://localhost:$PORT/api/jobs/$1" \
    -H "Authorization: Bearer $AUTH_TOKEN"
fi
