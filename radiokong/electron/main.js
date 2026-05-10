const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let engineProcess = null;

// Get the path to the Rust audio engine binary
function getEnginePath() {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(__dirname, '..', 'engine', 'target', 'release', 'radiokong-engine');
  }
  return path.join(process.resourcesPath, 'engine', 'radiokong-engine');
}

function createWindow() {
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    // macOS: use titleBarStyle 'hiddenInset' for native traffic lights
    // Windows/Linux: use frameless with custom titlebar
    frame: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isMac ? { x: 16, y: 18 } : undefined,
    backgroundColor: '#020617',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startAudioEngine() {
  // Don't start if already running
  if (engineProcess) return;

  const enginePath = getEnginePath();
  try {
    engineProcess = spawn(enginePath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Buffer for handling multi-line JSON output
    let stdoutBuffer = '';

    engineProcess.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      // Process complete lines
      const lines = stdoutBuffer.split('\n');
      // Keep the last incomplete line in the buffer
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const message = JSON.parse(trimmed);
          if (mainWindow) {
            mainWindow.webContents.send('engine:message', message);
          }
        } catch (e) {
          console.log('[Engine]', trimmed);
        }
      }
    });

    engineProcess.stderr.on('data', (data) => {
      console.error('[Engine Log]', data.toString().trim());
    });

    engineProcess.on('close', (code) => {
      console.log(`[Engine] Process exited with code ${code}`);
      engineProcess = null;
    });

    engineProcess.on('error', (err) => {
      console.error('[Engine] Failed to start:', err.message);
      engineProcess = null;
    });

  } catch (err) {
    console.error('[Engine] Failed to start audio engine:', err.message);
  }
}

function sendToEngine(command) {
  if (engineProcess && engineProcess.stdin && engineProcess.stdin.writable) {
    engineProcess.stdin.write(JSON.stringify(command) + '\n');
  } else {
    console.warn('[Engine] Engine not running, command dropped');
  }
}

function stopEngine() {
  if (engineProcess) {
    // Send stop command first
    sendToEngine({ type: 'stop' });
    // Give it a moment to clean up
    setTimeout(() => {
      if (engineProcess) {
        engineProcess.kill('SIGTERM');
        engineProcess = null;
      }
    }, 1000);
  }
}

// IPC Handlers
ipcMain.handle('engine:start', async (_event, config) => {
  startAudioEngine();
  // Small delay to let engine initialize
  await new Promise(resolve => setTimeout(resolve, 100));
  sendToEngine({ type: 'start', config });
  return { status: 'ok' };
});

ipcMain.handle('engine:stop', async () => {
  sendToEngine({ type: 'stop' });
  stopEngine();
  return { status: 'ok' };
});

ipcMain.handle('engine:command', async (_event, command) => {
  sendToEngine(command);
  return { status: 'ok' };
});

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());

app.whenReady().then(createWindow);

// macOS: keep app running when all windows are closed (click dock icon to re-open)
app.on('window-all-closed', () => {
  stopEngine();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopEngine();
});
