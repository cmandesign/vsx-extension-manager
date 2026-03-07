export interface ExtensionFile {
  assetType: string;
  source: string;
}

export interface ExtensionVersion {
  version: string;
  assetUri: string;
  fallbackAssetUri: string;
  files: ExtensionFile[];
  [key: string]: unknown;
}

export interface Extension {
  publisher: { publisherName: string; [key: string]: unknown };
  extensionName: string;
  versions: ExtensionVersion[];
  [key: string]: unknown;
}

export interface QueryResult {
  extensions: Extension[];
  resultMetadata: unknown[];
}

export interface ExtensionQueryResponse {
  results: QueryResult[];
}
