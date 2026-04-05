import { app, BrowserWindow } from "electron";
import path from "node:path";
import http from "node:http";

const isDev = !!process.env.ELECTRON_DEV;
const PORT = 7777;
let mainWindow: BrowserWindow | null = null;
let server: http.Server | null = null;

async function startServer(): Promise<void> {
  const logDir = path.join(process.env.HOME || "", ".claude", "hook-logger");

  let htmlPath: string;
  let webDir: string;

  if (app.isPackaged) {
    htmlPath = path.join(process.resourcesPath, "viewer", "index.html");
    webDir = path.join(process.resourcesPath, "web");
  } else {
    htmlPath = path.join(__dirname, "..", "viewer", "index.html");
    webDir = path.join(__dirname, "..", "web");
  }

  const { createServer } = await import(
    /* webpackIgnore: true */
    path.join(__dirname, "..", "viewer", "server.js")
  );
  server = createServer(logDir, htmlPath, webDir) as http.Server;

  return new Promise((resolve) => {
    server!.listen(PORT, () => {
      console.log(`Embedded server running at http://localhost:${PORT}`);
      resolve();
    });
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const url = isDev
    ? "http://localhost:5188"
    : `http://localhost:${PORT}`;
  mainWindow.loadURL(url);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  if (!isDev) {
    await startServer();
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (server) {
    server.close();
  }
  app.quit();
});
