import { config } from "../config.js";

const QUERY_PATH = "/_apis/public/gallery/extensionquery";
const API_ACCEPT = "application/json;api-version=3.0-preview.1";

export async function queryExtensions(body: unknown): Promise<unknown> {
  const url = `${config.upstreamUrl}${QUERY_PATH}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: API_ACCEPT,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Upstream responded with ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export async function fetchAsset(upstreamUrl: string): Promise<{
  body: ReadableStream<Uint8Array> | null;
  headers: Record<string, string>;
  status: number;
}> {
  const res = await fetch(upstreamUrl, {
    redirect: "follow",
  });

  const headers: Record<string, string> = {};
  for (const key of ["content-type", "content-length", "content-disposition"]) {
    const val = res.headers.get(key);
    if (val) headers[key] = val;
  }

  return {
    body: res.body,
    headers,
    status: res.status,
  };
}
