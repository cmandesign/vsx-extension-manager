import type { Request } from "express";
import type { ExtensionQueryResponse } from "../types/marketplace.js";

/**
 * Derive the public-facing base URL from the incoming request so that
 * rewritten URLs match the protocol, host and port the client actually uses.
 */
export function getBaseUrl(req: Request): string {
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  const host = req.get("x-forwarded-host") || req.get("host") || "localhost";
  return `${proto}://${host}`;
}

function buildProxyAssetUri(baseUrl: string, publisher: string, extension: string, version: string): string {
  return `${baseUrl}/assets/${publisher}/${extension}/${version}`;
}

function rewriteSourceUrl(baseUrl: string, source: string, publisher: string, extension: string, version: string, originalAssetUri?: string): string {
  const proxyBase = buildProxyAssetUri(baseUrl, publisher, extension, version);

  // Match vsassets.io URLs with assetbyname suffix
  const vsassetsMatch = source.match(
    /https?:\/\/[^.]+\.gallery\.vsassets\.io\/_apis\/public\/gallery\/publisher\/[^/]+\/extension\/[^/]+\/[^/]+\/assetbyname\/(.+)/
  );
  if (vsassetsMatch) {
    return `${proxyBase}/assetbyname/${vsassetsMatch[1]}`;
  }

  // Match marketplace.visualstudio.com URLs with assetbyname suffix
  const marketplaceMatch = source.match(
    /https?:\/\/marketplace\.visualstudio\.com\/_apis\/public\/gallery\/publisher\/[^/]+\/extension\/[^/]+\/[^/]+\/assetbyname\/(.+)/
  );
  if (marketplaceMatch) {
    return `${proxyBase}/assetbyname/${marketplaceMatch[1]}`;
  }

  // Handle relative URLs (e.g. "assetbyname/..." or "/assetbyname/...")
  const relativeMatch = source.match(/^\/?assetbyname\/(.+)/);
  if (relativeMatch) {
    return `${proxyBase}/assetbyname/${relativeMatch[1]}`;
  }

  // Handle other relative URLs by resolving against the original assetUri
  if (originalAssetUri && !source.match(/^https?:\/\//)) {
    const resolvedUrl = new URL(source, originalAssetUri.replace(/\/?$/, "/")).href;
    // Try to rewrite the resolved absolute URL
    return rewriteSourceUrl(baseUrl, resolvedUrl, publisher, extension, version);
  }

  return source;
}

export function rewriteUrls(response: ExtensionQueryResponse, baseUrl: string): ExtensionQueryResponse {
  if (!response.results) return response;

  for (const result of response.results) {
    if (!result.extensions) continue;

    for (const ext of result.extensions) {
      const publisher = ext.publisher?.publisherName;
      const extensionName = ext.extensionName;

      if (!publisher || !extensionName || !ext.versions) continue;

      for (const ver of ext.versions) {
        const version = ver.version;
        const proxyUri = buildProxyAssetUri(baseUrl, publisher, extensionName, version);

        // Preserve original assetUri before overwriting so relative file
        // sources can be resolved against it
        const originalAssetUri = ver.assetUri || ver.fallbackAssetUri;

        if (ver.assetUri) {
          ver.assetUri = proxyUri;
        }
        if (ver.fallbackAssetUri) {
          ver.fallbackAssetUri = proxyUri;
        }

        if (ver.files) {
          for (const file of ver.files) {
            if (file.source) {
              file.source = rewriteSourceUrl(baseUrl, file.source, publisher, extensionName, version, originalAssetUri);
            }
          }
        }
      }
    }
  }

  return response;
}
