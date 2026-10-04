# RETIMAX en Contabo (producción)

VPS: **77.237.234.222** · App: **`/opt/retimax-system`**

## URLs

| Servicio | URL |
|----------|-----|
| Web | https://retimax.tryviax.com |
| API | https://retimax-api.tryviax.com |

## Componentes instalados

- **Docker** + Compose (stack `retimax`: postgres, api, web, backup)
- **Caddy** (TLS Let's Encrypt, `/etc/caddy/Caddyfile`)
- **UFW**: solo **22**, **80**, **443**
- **fail2ban** (SSH)
- **unattended-upgrades** (parches de seguridad)

Puertos **3000**, **4000** y **5432** solo en `127.0.0.1` (no expuestos a Internet).

## Secretos y datos

| Qué | Dónde |
|-----|--------|
| Variables de entorno | `/opt/retimax-system/.env` (`chmod 600`) |
| Backups Postgres (14 días) | volumen Docker del servicio `backup` → `/backups` dentro del contenedor |
| Fotos / uploads | volumen `uploads` de la API |

Generar `.env` inicial (solo una vez): `scripts/server-bootstrap-env.sh`

## Compose

```bash
cd /opt/retimax-system
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Variables clave en `.env`:

- `CORS_ORIGIN=https://retimax.tryviax.com`
- `NEXT_PUBLIC_API_URL=https://retimax-api.tryviax.com` (requiere **rebuild** de `web` si cambia)

## Caddy

```bash
# Instalar / actualizar sitios
bash /opt/retimax-system/scripts/server-setup-caddy.sh
systemctl status caddy
```

Bloques actuales: web → `127.0.0.1:3000`, API → `127.0.0.1:4000`.

## Actualizar app

```bash
cd /opt/retimax-system
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Cloudflare (paso humano)

1. Registros **A** `retimax` y `retimax-api` → `77.237.234.222` (DNS only hasta que HTTPS funcione).
2. Cuando https://retimax.tryviax.com abra bien, activar **proxy naranja** solo en esos hostnames si lo deseas.
3. No cambiar SSL de toda la zona `tryviax.com` (otros servicios en `31.220.95.208`).

## Post-despliegue obligatorio

1. Cambiar contraseña del usuario **admin** en la app.
2. Rotar contraseña **root** SSH y secretos JWT/Postgres si alguna vez se compartieron.
3. Configurar copia de backups **fuera del VPS** (S3, otro servidor, etc.) — pendiente de destino.

## Nuevo proyecto en el mismo VPS

1. `/opt/<proyecto>` + `docker-compose` con puertos en `127.0.0.1:<puerto libre>`.
2. Añadir bloque en `/etc/caddy/Caddyfile` → `reverse_proxy 127.0.0.1:<puerto>`.
3. `systemctl reload caddy`
4. DNS **A** en Cloudflare hacia este VPS.
