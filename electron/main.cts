import { app, BrowserWindow, Tray, nativeImage, ipcMain } from "electron";
import os from "node:os";
import path from "node:path";
import http from "node:http";

const isDev = !!process.env.ELECTRON_DEV;
const PORT = 7777;
let mainWindow: BrowserWindow | null = null;
let server: http.Server | null = null;
let tray: Tray | null = null;
let trayPopup: BrowserWindow | null = null;
let trayPollTimer: ReturnType<typeof setInterval> | null = null;
let isQuitting = false;

async function startServer(): Promise<void> {
  const logDir = path.join(os.homedir(), ".claude", "claude-pulse");

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

interface AgentInfo {
  sessionId: string;
  sessionName: string | null;
  projectName: string | null;
  branch: string | null;
  status: "active" | "idle" | "waiting" | "ended";
  permissionMessage: string | null;
}

function getRuntimeResourcePath(...segments: string[]): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...segments);
  }

  // Electron dev runs `dist/electron/main.cjs`, so tray assets live two levels up.
  return path.join(__dirname, "..", "..", ...segments);
}

function fetchAgents(): Promise<AgentInfo[]> {
  return new Promise((resolve) => {
    const req = http.get(
      `http://localhost:${PORT}/api/agents?threshold=5&includeEnded=false`,
      (res) => {
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(Array.isArray(parsed) ? parsed : parsed.agents || []);
          } catch {
            resolve([]);
          }
        });
      }
    );
    req.on("error", () => resolve([]));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve([]);
    });
  });
}

function openTmux(agentId: string): void {
  const postData = JSON.stringify({});
  const req = http.request({
    hostname: "localhost",
    port: PORT,
    path: `/api/agents/${agentId}/open-tmux`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  req.on("error", () => {});
  req.write(postData);
  req.end();
}

async function updateTray(): Promise<void> {
  if (!tray) return;
  try {
    const agents = await fetchAgents();
    const waiting = agents.filter((a) => a.status === "waiting");
    tray.setTitle(waiting.length > 0 ? `${waiting.length}` : "");

    // Send data to popup if visible
    if (trayPopup && !trayPopup.isDestroyed()) {
      trayPopup.webContents.send("agents-update", agents);
    }
  } catch {
    // Server not ready yet
  }
}

function createTrayPopup(): BrowserWindow {
  const popupPath = app.isPackaged
    ? getRuntimeResourcePath("tray-popup.html")
    : getRuntimeResourcePath("electron", "tray-popup.html");

  const popup = new BrowserWindow({
    width: 320,
    height: 400,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, "tray-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  void popup.loadFile(popupPath).catch((error) => {
    console.error("Failed to load tray popup", { popupPath, error });
  });

  popup.on("blur", () => {
    popup.hide();
  });

  return popup;
}

function toggleTrayPopup(): void {
  if (!tray) return;

  if (trayPopup && trayPopup.isVisible()) {
    trayPopup.hide();
    return;
  }

  if (!trayPopup || trayPopup.isDestroyed()) {
    trayPopup = createTrayPopup();
  }

  // Position below tray icon
  const trayBounds = tray.getBounds();
  const popupBounds = trayPopup.getBounds();
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - popupBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height);

  trayPopup.setPosition(x, y);
  trayPopup.show();

  // Send current data immediately
  updateTray();
}

function createTray(): void {
  const iconPath = app.isPackaged
    ? getRuntimeResourcePath("trayIconTemplate.png")
    : getRuntimeResourcePath("build", "trayIconTemplate.png");

  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    console.error("Failed to load tray icon", { iconPath });
  }
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip("Claude Pulse");

  tray.on("click", () => {
    toggleTrayPopup();
  });

  // Start polling
  updateTray();
  trayPollTimer = setInterval(updateTray, 10_000);

  // IPC handlers for tray popup
  ipcMain.on("tray-open-tmux", (_event, agentId: string) => {
    openTmux(agentId);
    trayPopup?.hide();
  });

  ipcMain.on("tray-open-dashboard", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
    trayPopup?.hide();
  });

  ipcMain.on("tray-hide", () => {
    if (trayPopup && !trayPopup.isDestroyed()) {
      trayPopup.hide();
    }
  });

  ipcMain.on("tray-quit", () => {
    isQuitting = true;
    app.quit();
  });

  ipcMain.on("tray-set-height", (_event, h: number) => {
    if (trayPopup && !trayPopup.isDestroyed()) {
      const clamped = Math.min(Math.max(h, 80), 500);
      trayPopup.setSize(320, clamped);
    }
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

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  if (!isDev) {
    await startServer();
  }
  createTray();
  createWindow();

  app.on("activate", () => {
    // Only handle dock icon click, not tray click
    if (trayPopup?.isVisible()) return;
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  // Don't quit — tray keeps running
});

app.on("quit", () => {
  if (trayPollTimer) {
    clearInterval(trayPollTimer);
  }
  if (server) {
    server.close();
  }
});
