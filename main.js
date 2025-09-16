// main.js (root)
const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

let mainWindow;
let backendProcess;
const isDev = !app.isPackaged;

// Ensure single instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function startBackend() {
  const backendDir = isDev
    ? path.join(__dirname, "backend")
    : path.join(process.resourcesPath, "backend");

  const script = path.join(backendDir, "server.js");

  // Where the built React files live once packaged
  const FRONTEND_DIST = isDev ? null : path.join(__dirname, "frontend", "dist");

  const env = {
    ...process.env,
    PORT: "4000",
    ...(FRONTEND_DIST ? { FRONTEND_DIST } : {}),
    ...(isDev ? {} : { ELECTRON_RUN_AS_NODE: "1" }), // prod: run Electron as Node
  };

  // dev: use system node; prod: use electron binary in node mode
  const cmd = isDev
    ? (process.platform === "win32" ? "node.exe" : "node")
    : process.execPath;

  backendProcess = spawn(cmd, [script], {
    cwd: backendDir,
    env,
    stdio: "pipe",
    windowsHide: true,
  });

  backendProcess.stdout.on("data", d =>
    console.log(`[backend] ${String(d).trim()}`)
  );
  backendProcess.stderr.on("data", d =>
    console.error(`[backend] ${String(d).trim()}`)
  );
  backendProcess.on("exit", code =>
    console.log(`[backend] exited ${code}`)
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { nodeIntegration: false },
    title: "Scoreboard Admin",
  });

  if (isDev) {
    // Vite serves the UI in dev
    mainWindow.loadURL("http://localhost:5173");
  } else {
    // In production, backend serves the UI at /
    mainWindow.loadURL("http://localhost:4000/");
  }

  // Uncomment for debugging white screens:
  // mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    if (backendProcess) backendProcess.kill();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackend(); // start in dev & prod
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  if (backendProcess) backendProcess.kill();
});
