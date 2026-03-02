#!/bin/sh
# ──────────────────────────────────────────────────────────────────────
# Evolution API — Instance Bootstrap
# Waits for Evolution API, creates instance if missing, configures webhook.
# ──────────────────────────────────────────────────────────────────────
set -e

EVOLUTION_URL="${EVOLUTION_URL:?EVOLUTION_URL is required}"
EVOLUTION_API_KEY="${EVOLUTION_API_KEY:?EVOLUTION_API_KEY is required}"
EVOLUTION_INSTANCE_NAME="${EVOLUTION_INSTANCE_NAME:?EVOLUTION_INSTANCE_NAME is required}"
WEBHOOK_URL="${WEBHOOK_URL:?WEBHOOK_URL is required}"

MAX_RETRIES=30
RETRY_INTERVAL=2

log() { echo "[init-evolution] $*"; }

# ── Wait for API ─────────────────────────────────────────────────────

log "Waiting for Evolution API at ${EVOLUTION_URL} ..."

for i in $(seq 1 $MAX_RETRIES); do
  if curl -sf -o /dev/null "${EVOLUTION_URL}/instance/fetchInstances" \
       -H "apikey: ${EVOLUTION_API_KEY}"; then
    log "Evolution API is ready."
    break
  fi
  if [ "$i" -eq "$MAX_RETRIES" ]; then
    log "ERROR: Evolution API not ready after ${MAX_RETRIES} attempts. Aborting."
    exit 1
  fi
  log "Attempt $i/$MAX_RETRIES — retrying in ${RETRY_INTERVAL}s ..."
  sleep $RETRY_INTERVAL
done

# ── Create instance (idempotent) ─────────────────────────────────────

INSTANCES=$(curl -sf "${EVOLUTION_URL}/instance/fetchInstances" \
  -H "apikey: ${EVOLUTION_API_KEY}")

if echo "$INSTANCES" | grep -q "\"instanceName\":\"${EVOLUTION_INSTANCE_NAME}\""; then
  log "Instance '${EVOLUTION_INSTANCE_NAME}' already exists. Skipping creation."
else
  log "Creating instance '${EVOLUTION_INSTANCE_NAME}' ..."
  RESULT=$(curl -sf -X POST "${EVOLUTION_URL}/instance/create" \
    -H "apikey: ${EVOLUTION_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"instanceName\":\"${EVOLUTION_INSTANCE_NAME}\",\"integration\":\"WHATSAPP-BAILEYS\"}")
  log "Instance created: ${RESULT}"
fi

# ── Configure webhook ────────────────────────────────────────────────

log "Configuring webhook -> ${WEBHOOK_URL}"
curl -sf -X POST "${EVOLUTION_URL}/webhook/set/${EVOLUTION_INSTANCE_NAME}" \
  -H "apikey: ${EVOLUTION_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${WEBHOOK_URL}\",\"webhook_by_events\":false,\"events\":[\"MESSAGES_UPSERT\"]}"

log "Done."
