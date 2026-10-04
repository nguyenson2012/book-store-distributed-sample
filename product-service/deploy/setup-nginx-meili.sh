#!/usr/bin/env bash
# ============================================================
# Cài nginx reverse proxy cho Meilisearch trên GCE VM
# Chạy SAU khi đã cài Meilisearch với install-meilisearch-vm.sh
#
# Usage:
#   sudo DOMAIN=meili.yourdomain.com bash setup-nginx-meili.sh
#   # Nếu chưa có domain, bỏ qua HTTPS:
#   sudo bash setup-nginx-meili.sh
# ============================================================
set -euo pipefail

DOMAIN="${DOMAIN:-}"
MEILI_PORT="${MEILI_PORT:-7700}"

apt-get install -y nginx

# Cập nhật Meilisearch để bind 127.0.0.1 (localhost only)
# (nếu đang dùng 0.0.0.0, đổi lại)
sed -i 's/MEILI_HTTP_ADDR=0.0.0.0:7700/MEILI_HTTP_ADDR=127.0.0.1:7700/' \
  /etc/systemd/system/meilisearch.service 2>/dev/null || true
systemctl daemon-reload
systemctl restart meilisearch

if [[ -n "$DOMAIN" ]]; then
  # HTTPS với Let's Encrypt
  apt-get install -y certbot python3-certbot-nginx

  cat >/etc/nginx/sites-available/meilisearch <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass         http://127.0.0.1:7700;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }
}
EOF

  ln -sf /etc/nginx/sites-available/meilisearch /etc/nginx/sites-enabled/meilisearch
  nginx -t && systemctl reload nginx

  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m admin@${DOMAIN}

  echo ""
  echo "✅ Meilisearch có thể truy cập qua HTTPS:"
  echo "   MEILI_HOST=https://${DOMAIN}"

else
  # HTTP trên port 7700 (dev/test — không dùng prod)
  cat >/etc/nginx/sites-available/meilisearch <<EOF
server {
    listen ${MEILI_PORT};
    server_name _;

    location / {
        proxy_pass         http://127.0.0.1:7700;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 30s;
    }
}
EOF

  # Xóa default site nginx
  rm -f /etc/nginx/sites-enabled/default
  ln -sf /etc/nginx/sites-available/meilisearch /etc/nginx/sites-enabled/meilisearch
  nginx -t && systemctl enable --now nginx && systemctl reload nginx

  VM_IP=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/externalIp" \
    -H "Metadata-Flavor: Google" 2>/dev/null || echo "<VM_EXTERNAL_IP>")

  echo ""
  echo "✅ Nginx proxy đang chạy trên port ${MEILI_PORT}"
  echo "   MEILI_HOST=http://${VM_IP}:${MEILI_PORT}"
  echo ""
  echo "⚠️  Nhớ mở GCP firewall:"
  echo "   gcloud compute firewall-rules create allow-meili \\"
  echo "     --allow tcp:${MEILI_PORT} --target-tags=meilisearch"
fi
