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
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
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
  const enginePath = getEnginePath();
  try {
    engineProcess = spawn(enginePath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    engineProcess.stdout.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString().trim());
        if (mainWindow) {
          mainWindow.webContents.send('engine:message', message);
        }
      } catch (e) {
        // Non-JSON output, ignore or log
        console.log('[Engine]', data.toString().trim());
      }
    });

    engineProcess.stderr.on('data', (data) => {
      console.error('[Engine Error]', data.toString().trim());
    });

    engineProcess.on('close', (code) => {
      console.log(`[Engine] Process exited with code ${code}`);
      engineProcess = null;
    });
  } catch (err) {
    console.error('[Engine] Failed to start audio engine:', err.message);
  }
}

function sendToEngine(command) {
  if (engineProcess && engineProcess.stdin.writable) {
    engineProcess.stdin.write(JSON.stringify(command) + '\n');
  } else {
    console.warn('[Engine] Engine not running, command dropped');
  }
}

// IPC Handlers
ipcMain.handle('engine:start', async (_event, config) => {
  startAudioEngine();
  sendToEngine({ type: 'start', config });
  return { status: 'ok' };
});

ipcMain.handle('engine:stop', async () => {
  sendToEngine({ type: 'stop' });
  if (engineProcess) {
    engineProcess.kill('SIGTERM');
    engineProcess = null;
  }
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

app.on('window-all-closed', () => {
  if (engineProcess) {
    engineProcess.kill('SIGTERM');
    engineProcess = null;
  }
  app.quit();
});

app.on('before-quit', () => {
  if (engineProcess) {
    engineProcess.kill('SIGTERM');
  }
});
