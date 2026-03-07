# vsx-extension-manager

A Node.js proxy server for the VS Code Extension Marketplace. Browse, search, and download extensions through your own self-hosted proxy.

## Quick Start

```bash
npm install
npm run build
npm start
```

The server starts on `http://localhost:3000` by default.

## HTTPS with Caddy

Download [Caddy](https://caddyserver.com/download) and run it as a reverse proxy in front of the Node server:

```bash
./caddy.exe reverse-proxy --to :3000
```

Caddy will serve on `https://localhost` with an auto-generated certificate.

## Configure VS Code

Edit VS Code's `product.json`:

- **macOS**: `/Applications/Visual Studio Code.app/Contents/Resources/app/product.json`
- **Linux**: `/usr/share/code/resources/app/product.json`
- **Windows**: `C:\Program Files\Microsoft VS Code\resources\app\product.json`

Add or modify the `extensionsGallery` section:

```json
{
  "extensionsGallery": {
    "serviceUrl": "https://localhost/_apis/public/gallery",
    "itemUrl": "https://localhost/items",
    "resourceUrlTemplate": "https://localhost/assets/{publisher}/{name}/{version}/assetbyname/{path}"
  }
}
```

Or launch VS Code with environment variables:

```bash
VSCODE_GALLERY_SERVICE_URL="https://localhost/_apis/public/gallery" \
VSCODE_GALLERY_ITEM_URL="https://localhost/items" \
code .
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/_apis/public/gallery/extensionquery` | Search/browse extensions |
| `GET` | `/assets/:publisher/:extension/:version/assetbyname/:assetType` | Download extension assets |
| `GET` | `/_apis/public/gallery/publishers/:pub/vsextensions/:ext/:ver/vspackage` | Download VSIX (alternative path) |
| `GET` | `/healthz` | Health check |

## Scripts

```bash
npm run dev    # Start dev server with hot reload
npm run build  # Compile TypeScript
npm start      # Run compiled JS
```
