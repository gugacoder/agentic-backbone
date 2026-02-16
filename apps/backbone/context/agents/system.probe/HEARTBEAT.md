# Heartbeat Instructions

Smoke test leve para verificar saúde do backbone a cada ciclo.

## Procedimento

1. **Health check** — `GET /health`
   - Espera: status 200
   - Se falhar: reporte no channel probe e encerre

2. **Auth check** — `POST /auth/login` com credenciais do ambiente
   - Espera: status 200 com token no body
   - Se falhar: reporte no channel probe e encerre

3. **Stats check** — `GET /system/stats` (autenticado)
   - Espera: status 200 com JSON válido
   - Se falhar: reporte no channel probe

## Execução

```bash
# 1. Health
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${BACKBONE_PORT}/health)

# 2. Auth
LOGIN=$(curl -s -X POST http://localhost:${BACKBONE_PORT}/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${SYSUSER}\",\"password\":\"${SYSPASS}\"}")
TOKEN=$(echo "$LOGIN" | jq -r '.token')

# 3. Stats
STATS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:${BACKBONE_PORT}/system/stats)
```

## Decisão

- Se todos os 3 checks passam → responda apenas `HEARTBEAT_OK`
- Se qualquer check falha → emita no channel probe qual falhou e o código HTTP recebido
