#!/bin/bash
# Generate local HTTPS certificates using mkcert inside Docker
# No local mkcert installation required — only Docker.

set -e

mkdir -p certs

echo "Generating certificates via Docker..."
docker run --rm -v "$(pwd)/certs:/certs" golang:alpine sh -c '
  apk add --no-cache mkcert nss-tools > /dev/null 2>&1
  mkcert -cert-file /certs/localhost.pem -key-file /certs/localhost-key.pem localhost 127.0.0.1 ::1
'

echo ""
echo "Certificates created in ./certs/"
echo ""
echo "NOTE: These are self-signed certificates. Your browser will show a warning."
echo "      Accept the warning to proceed, or install mkcert locally to add the CA"
echo "      to your system trust store: https://github.com/FiloSottile/mkcert"
echo ""
echo "Start the server:"
echo "  docker compose -f docker-compose.local.yml up -d"
echo ""
echo "Configure VS Code:"
echo '  VSCODE_GALLERY_SERVICE_URL="https://localhost/_apis/public/gallery" \'
echo '  VSCODE_GALLERY_ITEM_URL="https://localhost/items" \'
echo '  code .'
