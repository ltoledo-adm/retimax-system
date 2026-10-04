#!/bin/bash
# Comprobaciones rápidas post-despliegue (ejecutar en el VPS como root).
set -euo pipefail

ROOT="${RETIMAX_ROOT:-/opt/retimax-system}"
cd "$ROOT"

echo "== Docker stack =="
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

echo ""
echo "== Puertos locales (solo 127.0.0.1 para app) =="
ss -tlnp | grep -E ':3000|:4000|:5432|:80|:443' || true

echo ""
echo "== Caddy =="
systemctl is-active caddy
caddy validate --config /etc/caddy/Caddyfile 2>&1 | tail -1

echo ""
echo "== HTTP origen =="
curl -sf -o /dev/null -w "web_local:%{http_code}\n" http://127.0.0.1:3000/login
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:4000/auth/login \
  -H 'Content-Type: application/json' -d '{}')
echo "api_local:${code} (400/401 = API viva)"

echo ""
echo "== HTTPS vía dominio (requiere DNS/proxy) =="
curl -sf -o /dev/null -w "web_public:%{http_code}\n" https://retimax.tryviax.com/login || echo "web_public:FAIL"
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://retimax-api.tryviax.com/auth/login \
  -H 'Content-Type: application/json' -d '{}')
echo "api_public:${code} (400/401 = API viva)"

echo ""
echo "OK — revisa códigos 200/307/404 según ruta."
