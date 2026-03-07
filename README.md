# vsx-extension-manager

A Node.js proxy server for the VS Code Extension Marketplace. Browse, search, and download extensions through your own self-hosted proxy.

## Quick Start

```bash
npm install
npm run dev
```

The server starts on `http://localhost:3000` by default.

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `UPSTREAM_URL` | `https://marketplace.visualstudio.com` | Upstream marketplace URL |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | Public URL of this proxy (used for URL rewriting) |
| `LOG_LEVEL` | `info` | Log level |

## Configure VS Code

### Option 1: Environment Variables

Launch VS Code with custom gallery environment variables:

```bash
VSCODE_GALLERY_SERVICE_URL="http://localhost:3000/_apis/public/gallery" \
VSCODE_GALLERY_ITEM_URL="http://localhost:3000/items" \
code .
```

### Option 2: product.json

Edit VS Code's `product.json` to point to your proxy:

- **macOS**: `/Applications/Visual Studio Code.app/Contents/Resources/app/product.json`
- **Linux**: `/usr/share/code/resources/app/product.json`
- **Windows**: `C:\Program Files\Microsoft VS Code\resources\app\product.json`

Add or modify the `extensionsGallery` section:

```json
{
  "extensionsGallery": {
    "serviceUrl": "http://localhost:3000/_apis/public/gallery",
    "itemUrl": "http://localhost:3000/items",
    "resourceUrlTemplate": "http://localhost:3000/assets/{publisher}/{name}/{version}/assetbyname/{path}"
  }
}
```

### Option 3: VSCodium / code-server

For VS Code forks that support custom marketplace configuration natively, set the service URL in their respective config files to point to this proxy.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/_apis/public/gallery/extensionquery` | Search/browse extensions |
| `GET` | `/assets/:publisher/:extension/:version/assetbyname/:assetType` | Download extension assets |
| `GET` | `/_apis/public/gallery/publishers/:pub/vsextensions/:ext/:ver/vspackage` | Download VSIX (alternative path) |
| `GET` | `/healthz` | Health check |

## How It Works

1. VS Code sends extension search queries to this proxy
2. The proxy forwards requests to the real VS Code Marketplace
3. Asset URLs in responses are rewritten to point back through the proxy
4. When VS Code downloads an extension, the request goes through the proxy which streams it from the upstream marketplace

## Local HTTPS (Docker + mkcert)

For local development with HTTPS using [mkcert](https://github.com/FiloSottile/mkcert) (locally-trusted certificates).

### 1. Install mkcert

```bash
# macOS
brew install mkcert

# Linux (Debian/Ubuntu)
apt install mkcert

# Windows
choco install mkcert
```

### 2. Generate certificates

```bash
./init-local-certs.sh
```

This creates trusted certs in `./certs/` and installs the local CA into your system trust store.

### 3. Start

```bash
docker compose -f docker-compose.local.yml up -d
```

The proxy is now available at `https://localhost`.

### 4. Configure VS Code

```bash
VSCODE_GALLERY_SERVICE_URL="https://localhost/_apis/public/gallery" \
VSCODE_GALLERY_ITEM_URL="https://localhost/items" \
code .
```

## Production Deployment (Docker + Let's Encrypt)

The project includes Docker Compose with nginx reverse proxy and automatic Let's Encrypt SSL.

### 1. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```
DOMAIN=marketplace.example.com
PUBLIC_BASE_URL=https://marketplace.example.com
```

### 2. Get SSL Certificate

Point your domain's DNS to your server, then run:

```bash
DOMAIN=marketplace.example.com EMAIL=you@example.com ./init-letsencrypt.sh
```

Use `STAGING=1` to test with Let's Encrypt staging servers first.

### 3. Start

```bash
docker compose up -d
```

Certificates auto-renew via the certbot container.

### 4. Configure VS Code

```bash
VSCODE_GALLERY_SERVICE_URL="https://marketplace.example.com/_apis/public/gallery" \
VSCODE_GALLERY_ITEM_URL="https://marketplace.example.com/items" \
code .
```

Or edit `product.json`:

```json
{
  "extensionsGallery": {
    "serviceUrl": "https://marketplace.example.com/_apis/public/gallery",
    "itemUrl": "https://marketplace.example.com/items",
    "resourceUrlTemplate": "https://marketplace.example.com/assets/{publisher}/{name}/{version}/assetbyname/{path}"
  }
}
```

## Scripts

```bash
npm run dev    # Start dev server with hot reload
npm run build  # Compile TypeScript
npm start      # Run compiled JS
```
