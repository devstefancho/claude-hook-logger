import http from "node:http";
import type { AddressInfo } from "node:net";
import { createServer } from "../../viewer/server.js";

export interface ServerInstance {
  server: http.Server;
  port: number;
  baseUrl: string;
}

export interface JsonResponse {
  status: number;
  headers: Headers;
  body: Record<string, unknown>;
}

export interface RawResponse {
  status: number;
  headers: Headers;
  text: string;
}

export function startServer(logDir: string, htmlPath: string): Promise<ServerInstance> {
  return new Promise((resolve, reject) => {
    const server = createServer(logDir, htmlPath);
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      const baseUrl = `http://localhost:${port}`;
      resolve({ server, port, baseUrl });
    });
    server.on("error", reject);
  });
}

export function stopServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

export async function fetchJson(baseUrl: string, path: string): Promise<JsonResponse> {
  const res = await fetch(`${baseUrl}${path}`);
  const body = await res.json() as Record<string, unknown>;
  return { status: res.status, headers: res.headers, body };
}

export async function fetchRaw(baseUrl: string, path: string): Promise<RawResponse> {
  const res = await fetch(`${baseUrl}${path}`);
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}
