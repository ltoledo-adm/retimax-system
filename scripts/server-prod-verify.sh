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
curl -sf -o /dev/null -w "api_local:%{http_code}\n" http://127.0.0.1:4000/auth/login || echo "api_local:404_ok_if_no_root"

echo ""
echo "== HTTPS vía dominio (requiere DNS/proxy) =="
curl -sf -o /dev/null -w "web_public:%{http_code}\n" https://retimax.tryviax.com/login || echo "web_public:FAIL"
curl -sf -o /dev/null -w "api_public:%{http_code}\n" https://retimax-api.tryviax.com/auth/login || echo "api_public:FAIL"

echo ""
echo "OK — revisa códigos 200/307/404 según ruta."
