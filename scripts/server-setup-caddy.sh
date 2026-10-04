#!/bin/bash
set -euo pipefail

if ! command -v caddy >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y caddy
fi

cat > /etc/caddy/Caddyfile <<'EOF'
# HTTP explícito: evita bucle 308 si Cloudflare usa SSL "Flexible" (origen en :80).
http://retimax.tryviax.com {
	encode gzip
	reverse_proxy 127.0.0.1:3000
}

https://retimax.tryviax.com {
	encode gzip
	reverse_proxy 127.0.0.1:3000
}

http://retimax-api.tryviax.com {
	encode gzip
	reverse_proxy 127.0.0.1:4000
}

https://retimax-api.tryviax.com {
	encode gzip
	reverse_proxy 127.0.0.1:4000
}
EOF

systemctl enable caddy
systemctl reload caddy || systemctl restart caddy
systemctl is-active caddy

ufw allow 80/tcp
ufw allow 443/tcp
ufw status numbered
