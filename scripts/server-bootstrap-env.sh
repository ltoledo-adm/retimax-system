#!/bin/bash
set -euo pipefail
cd /opt/retimax-system
PG=$(openssl rand -hex 24)
JA=$(openssl rand -hex 32)
JR=$(openssl rand -hex 32)
BK=$(openssl rand -hex 16)
cat > .env <<EOF
POSTGRES_USER=retimax
POSTGRES_PASSWORD=${PG}
POSTGRES_DB=retimax
DATABASE_URL=postgresql://retimax:${PG}@postgres:5432/retimax
JWT_ACCESS_SECRET=${JA}
JWT_REFRESH_SECRET=${JR}
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CORS_ORIGIN=https://retimax.tryviax.com
NEXT_PUBLIC_API_URL=https://retimax-api.tryviax.com
BACKUP_PASSPHRASE=${BK}
EOF
chmod 600 .env
echo ENV_OK
