import { createServer } from "../../viewer/server.mjs";

export function startServer(logDir, htmlPath) {
  return new Promise((resolve, reject) => {
    const server = createServer(logDir, htmlPath);
    server.listen(0, () => {
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;
      resolve({ server, port, baseUrl });
    });
    server.on("error", reject);
  });
}

export function stopServer(server) {
  return new Promise((resolve) => {
    server.close(resolve);
  });
}

export async function fetchJson(baseUrl, path) {
  const res = await fetch(`${baseUrl}${path}`);
  const body = await res.json();
  return { status: res.status, headers: res.headers, body };
}

export async function fetchRaw(baseUrl, path) {
  const res = await fetch(`${baseUrl}${path}`);
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}
