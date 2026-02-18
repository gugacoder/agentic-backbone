#!/bin/bash
PORT="${BACKBONE_PORT:?BACKBONE_PORT not set}"
curl -s -X POST "http://localhost:$PORT/api/jobs/$1/kill" \
  -H "Authorization: Bearer $AUTH_TOKEN"
