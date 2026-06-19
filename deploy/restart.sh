#!/bin/sh
# Перезапуск CRM на проде без docker-compose up (обход ContainerConfig на compose 1.29.x).
# Использование на сервере:
#   cd /opt/smena && git pull && docker-compose build && sh deploy/restart.sh

set -e

APP_DIR="${APP_DIR:-/opt/smena}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
IMAGE="${IMAGE:-smena_app:latest}"
CONTAINER="${CONTAINER:-smena-crm}"

cd "$APP_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found: $ENV_FILE" >&2
  exit 1
fi

docker stop "$CONTAINER" 2>/dev/null || true
docker rm -f "$CONTAINER" 2>/dev/null || true

docker run -d \
  --name "$CONTAINER" \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -e NODE_ENV=production \
  -p 127.0.0.1:3000:3000 \
  "$IMAGE"

echo "Waiting for health..."
sleep 3
docker logs --tail=30 "$CONTAINER" 2>&1 || true

if curl -sf http://127.0.0.1:3000/api/health >/dev/null; then
  echo "OK: health check passed"
else
  echo "WARN: health check failed — see logs above" >&2
  exit 1
fi

docker ps --filter "name=$CONTAINER"
