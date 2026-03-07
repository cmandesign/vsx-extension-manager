# Generate local HTTPS certificates using mkcert
# Prerequisites: Install mkcert first
#   choco install mkcert
#   OR scoop install mkcert
#   OR winget install FiloSottile.mkcert

$ErrorActionPreference = "Stop"

# Install the local CA into system trust store (one-time)
mkcert -install

# Generate certs
New-Item -ItemType Directory -Force -Path certs | Out-Null
mkcert -cert-file certs/localhost.pem -key-file certs/localhost-key.pem localhost 127.0.0.1 ::1

Write-Host ""
Write-Host "Certificates created in ./certs/"
Write-Host ""
Write-Host "Start the server:"
Write-Host "  docker compose -f docker-compose.local.yml up -d"
Write-Host ""
Write-Host "Configure VS Code:"
Write-Host '  $env:VSCODE_GALLERY_SERVICE_URL="https://localhost/_apis/public/gallery"'
Write-Host '  $env:VSCODE_GALLERY_ITEM_URL="https://localhost/items"'
Write-Host '  code .'
