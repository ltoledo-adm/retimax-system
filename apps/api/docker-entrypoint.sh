#!/bin/sh
set -e
cd /app/apps/api
echo "[retimax] Ejecutando migraciones..."
prisma migrate deploy
echo "[retimax] Ejecutando seed..."
node prisma/seed.js || echo "[retimax] Seed omitido o ya aplicado"
echo "[retimax] Iniciando API en puerto ${PORT:-4000}..."
exec node dist/src/main.js
