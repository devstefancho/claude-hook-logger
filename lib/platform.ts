import os from "node:os";
import path from "node:path";

export const isWindows = process.platform === "win32";
export const homeDir = (): string => os.homedir();
export const claudeDir = (): string => path.join(homeDir(), ".claude");
