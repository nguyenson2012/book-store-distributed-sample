#!/usr/bin/env bash
# ============================================================
# Cài Meilisearch trên GCE e2-micro / e2-small (Debian/Ubuntu)
# Chạy với: sudo MEILI_MASTER_KEY=xxx bash install-meilisearch-vm.sh
# ============================================================
set -euo pipefail

MEILI_MASTER_KEY="${MEILI_MASTER_KEY:?Cần set MEILI_MASTER_KEY trước khi chạy}"
MEILI_VERSION="${MEILI_VERSION:-v1.11.3}"
MEILI_MAX_MEMORY="${MEILI_MAX_MEMORY:-200Mb}"
MEILI_DB_PATH="${MEILI_DB_PATH:-/var/lib/meilisearch}"

echo "🚀 Cài Meilisearch ${MEILI_VERSION}..."
apt-get update -y
apt-get install -y ca-certificates curl

# Download binary
install -m 0755 -d /opt/meilisearch
curl -L "https://github.com/meilisearch/meilisearch/releases/download/${MEILI_VERSION}/meilisearch-linux-amd64" \
  -o /opt/meilisearch/meilisearch
chmod +x /opt/meilisearch/meilisearch
mkdir -p "${MEILI_DB_PATH}"

# Tạo user riêng (không chạy root)
id -u meilisearch &>/dev/null || useradd -r -s /bin/false meilisearch
chown -R meilisearch:meilisearch "${MEILI_DB_PATH}"

# Systemd service
cat >/etc/systemd/system/meilisearch.service <<EOF
[Unit]
Description=Meilisearch Search Engine
After=network.target

[Service]
Type=simple
User=meilisearch
Group=meilisearch
WorkingDirectory=${MEILI_DB_PATH}
Environment=MEILI_ENV=production
Environment=MEILI_MASTER_KEY=${MEILI_MASTER_KEY}
Environment=MEILI_DB_PATH=${MEILI_DB_PATH}
Environment=MEILI_HTTP_ADDR=0.0.0.0:7700
Environment=MEILI_MAX_INDEXING_MEMORY=${MEILI_MAX_MEMORY}
ExecStart=/opt/meilisearch/meilisearch
Restart=always
RestartSec=5
MemoryMax=700M
NoNewPrivileges=yes

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now meilisearch
sleep 2
systemctl --no-pager status meilisearch || true

echo ""
echo "✅ Meilisearch ${MEILI_VERSION} đã cài xong!"
echo ""
echo "⚠️  Meilisearch đang lắng nghe trên 127.0.0.1:7700 (localhost only)"
echo "   Để truy cập từ bên ngoài, cần nginx reverse proxy:"
echo ""
echo "   # Cài nginx"
echo "   apt-get install -y nginx"
echo ""
echo "   # Tạo /etc/nginx/sites-available/meilisearch với nội dung:"
echo "   server {"
echo "     listen 7700;"
echo "     location / { proxy_pass http://127.0.0.1:7700; }"
echo "   }"
echo ""
echo "   Hoặc đổi MEILI_HTTP_ADDR=0.0.0.0:7700 nếu chấp nhận expose trực tiếp (dev only)"
echo ""
echo "   GCP Firewall rule:"
echo "   gcloud compute firewall-rules create allow-meilisearch --allow tcp:7700 --target-tags=meilisearch"
