import type { ExtensionQueryResponse } from "../types/marketplace.js";
import { config } from "../config.js";

const VSASSETS_PATTERN = /https?:\/\/([^.]+)\.gallery\.vsassets\.io\/_apis\/public\/gallery\/publisher\/[^/]+\/extension\/[^/]+\/([^/]+)/g;
const MARKETPLACE_PATTERN = /https?:\/\/marketplace\.visualstudio\.com\/_apis\/public\/gallery\/publisher\/[^/]+\/extension\/[^/]+\/([^/]+)/g;

function buildProxyAssetUri(publisher: string, extension: string, version: string): string {
  return `${config.publicBaseUrl}/assets/${publisher}/${extension}/${version}`;
}

function rewriteSourceUrl(source: string, publisher: string, extension: string, version: string): string {
  const proxyBase = buildProxyAssetUri(publisher, extension, version);

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

  return source;
}

export function rewriteUrls(response: ExtensionQueryResponse): ExtensionQueryResponse {
  if (!response.results) return response;

  for (const result of response.results) {
    if (!result.extensions) continue;

    for (const ext of result.extensions) {
      const publisher = ext.publisher?.publisherName;
      const extensionName = ext.extensionName;

      if (!publisher || !extensionName || !ext.versions) continue;

      for (const ver of ext.versions) {
        const version = ver.version;
        const proxyUri = buildProxyAssetUri(publisher, extensionName, version);

        if (ver.assetUri) {
          ver.assetUri = proxyUri;
        }
        if (ver.fallbackAssetUri) {
          ver.fallbackAssetUri = proxyUri;
        }

        if (ver.files) {
          for (const file of ver.files) {
            if (file.source) {
              file.source = rewriteSourceUrl(file.source, publisher, extensionName, version);
            }
          }
        }
      }
    }
  }

  return response;
}
