#!/bin/bash
# Generate local HTTPS certificates using mkcert
# Prerequisites: Install mkcert first (https://github.com/FiloSottile/mkcert)
#   macOS:   brew install mkcert
#   Linux:   apt install mkcert  (or see GitHub for other methods)
#   Windows: choco install mkcert

set -e

# Install the local CA into system trust store (one-time)
mkcert -install

# Generate certs
mkdir -p certs
mkcert -cert-file certs/localhost.pem -key-file certs/localhost-key.pem localhost 127.0.0.1 ::1

echo ""
echo "Certificates created in ./certs/"
echo ""
echo "Start the server:"
echo "  docker compose -f docker-compose.local.yml up -d"
echo ""
echo "Configure VS Code:"
echo '  VSCODE_GALLERY_SERVICE_URL="https://localhost/_apis/public/gallery" \'
echo '  VSCODE_GALLERY_ITEM_URL="https://localhost/items" \'
echo '  code .'
