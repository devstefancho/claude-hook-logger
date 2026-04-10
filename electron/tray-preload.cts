import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronTray", {
  onAgentsUpdate: (callback: (agents: unknown[]) => void) => {
    ipcRenderer.on("agents-update", (_event, agents) => callback(agents));
  },
  openTmux: (agentId: string) => {
    ipcRenderer.send("tray-open-tmux", agentId);
  },
  openDashboard: () => {
    ipcRenderer.send("tray-open-dashboard");
  },
  hide: () => {
    ipcRenderer.send("tray-hide");
  },
  quit: () => {
    ipcRenderer.send("tray-quit");
  },
  setHeight: (h: number) => {
    ipcRenderer.send("tray-set-height", h);
  },
});
