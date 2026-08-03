const streamBase = () => process.env.STREAM_SERVICE_URL || "http://localhost:8090";

export async function callStream(
  path: string,
  init: RequestInit & { json?: unknown } = {},
) {
  const headers = new Headers(init.headers);
  headers.set("X-Ingest-Secret", process.env.INGEST_SECRET || "");
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${streamBase()}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  const data = await res.json().catch(() => ({}));
  return { res, data };
}
