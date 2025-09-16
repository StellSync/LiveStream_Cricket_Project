const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

let mainWindow;
let backendProcess;
const isDev = !app.isPackaged;

function startBackend() {
  // In dev runs from repo; in packaged app it's copied to process.resourcesPath
  const backendDir = isDev
    ? path.join(__dirname, "backend")
    : path.join(process.resourcesPath, "backend");

  // Use Electron's Node runtime so users don't need Node installed
  backendProcess = spawn(process.execPath, ["server.js"], {
    cwd: backendDir,
    env: { ...process.env, PORT: "4000" }, // keep overlay URL consistent
    stdio: "pipe"
  });

  backendProcess.stdout.on("data", d => console.log(`[backend] ${d}`.trim()));
  backendProcess.stderr.on("data", d => console.error(`[backend] ${d}`.trim()));
  backendProcess.on("exit", code => console.log(`[backend] exited ${code}`));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { nodeIntegration: false }
  });

  if (isDev) {
    // Dev: load Vite server
    mainWindow.loadURL("http://localhost:5173");
  } else {
    // Packaged: load built React files
    mainWindow.loadFile(path.join(__dirname, "frontend", "dist", "index.html"));
  }

  mainWindow.on("closed", () => {
    if (backendProcess) backendProcess.kill();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (backendProcess) backendProcess.kill();
});
