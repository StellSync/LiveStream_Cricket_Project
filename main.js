// main.js (root)
const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

let mainWindow;
let backendProcess;
const isDev = !app.isPackaged;

// single instance
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

  // ⬇️ In prod, serve UI from resources/frontend_dist (copied by extraResources)
  const FRONTEND_DIST = isDev
    ? null
    : path.join(process.resourcesPath, "frontend_dist");

  const env = {
    ...process.env,
    PORT: "5000",
    ...(FRONTEND_DIST ? { FRONTEND_DIST } : {}),
    ...(isDev ? {} : { ELECTRON_RUN_AS_NODE: "1" })
  };

  const cmd = isDev
    ? (process.platform === "win32" ? "node.exe" : "node")
    : process.execPath;

  // log backend output to a file
  const logDir = app.getPath("userData");
  const logFile = path.join(logDir, "backend.log");
  const logStream = fs.createWriteStream(logFile, { flags: "a" });

  backendProcess = spawn(cmd, [script], {
    cwd: backendDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });

  const pipe = (p, tag) =>
    p.on("data", (d) => {
      const line = `[backend] ${String(d).trim()}\n`;
      console[tag === "err" ? "error" : "log"](line);
      logStream.write(line);
    });
  pipe(backendProcess.stdout, "out");
  pipe(backendProcess.stderr, "err");
  backendProcess.on("exit", (code) => {
    const line = `[backend] exited ${code}\n`;
    console.log(line);
    logStream.write(line);
  });

  return { logFile };
}

function waitFor(url, timeoutMs = 25000, intervalMs = 500) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on("error", retry);
      function retry() {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timeout waiting for ${url}`));
        } else {
          setTimeout(poll, intervalMs);
        }
      }
    };
    poll();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { nodeIntegration: false },
    title: "Scoreboard Admin"
  });

  const target = isDev ? "http://localhost:5173" : "http://localhost:5000";
  const health = isDev ? target : `${target}/healthz`;

  try {
    if (!isDev) await waitFor(health);
    await mainWindow.loadURL(target + "/");
  } catch (err) {
    const msg = `
<pre style="font:14px/1.4 Consolas,monospace;padding:16px">
Server failed to start: ${health}
Error: ${err?.message || err}

Check backend log:
${app.getPath("userData")}\\backend.log
</pre>`;
    mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(msg));
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
