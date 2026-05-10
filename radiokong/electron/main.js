const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let engineProcess = null;

// PesaPal configuration
const PESAPAL_CONFIG = {
  consumerKey: process.env.PESAPAL_CONSUMER_KEY || '',
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET || '',
  baseUrl: process.env.PESAPAL_ENV === 'sandbox'
    ? 'https://cybqa.pesapal.com/pesapalv3/api'
    : 'https://pay.pesapal.com/v3/api',
  ipnUrl: process.env.PESAPAL_IPN_URL || 'https://api.radiokong.com/api/pesapal/ipn',
  callbackUrl: 'radiokong://subscription/callback',
};

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

// ============================================================
// IPC Handlers
// ============================================================

// Audio Engine
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

// Window controls
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());

// Open external URL (for PesaPal payment page)
ipcMain.handle('open:external', async (_event, url) => {
  try {
    await shell.openExternal(url);
    return { status: 'ok' };
  } catch (err) {
    console.error('[PesaPal] Failed to open external URL:', err.message);
    return { status: 'error', message: err.message };
  }
});

// PesaPal Subscription - Initiate Payment
ipcMain.handle('subscription:initiate', async (_event, data) => {
  const { tier, email } = data;
  const planPrices = { pro: 9.99, studio: 24.99, enterprise: 49.99 };
  const planNames = { pro: 'Pro', studio: 'Studio', enterprise: 'Enterprise' };

  const price = planPrices[tier];
  const name = planNames[tier];

  if (!price) {
    return { status: 'error', message: 'Invalid plan tier' };
  }

  try {
    // Step 1: Get PesaPal access token
    const tokenRes = await fetch(`${PESAPAL_CONFIG.baseUrl}/Auth/RequestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        consumer_key: PESAPAL_CONFIG.consumerKey,
        consumer_secret: PESAPAL_CONFIG.consumerSecret,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.token) {
      throw new Error(tokenData.error?.message || 'Failed to get PesaPal access token. Check your API credentials.');
    }

    // Step 2: Register IPN URL
    const ipnRes = await fetch(`${PESAPAL_CONFIG.baseUrl}/URLSetup/RegisterIPN`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${tokenData.token}`,
      },
      body: JSON.stringify({
        url: PESAPAL_CONFIG.ipnUrl,
        ipn_notification_type: 'GET',
      }),
    });
    const ipnData = await ipnRes.json();
    const ipnId = ipnData.ipn_id || ipnData.IPNId;

    // Step 3: Submit order
    const orderId = `RK-${tier.toUpperCase()}-${Date.now()}`;
    const orderRes = await fetch(`${PESAPAL_CONFIG.baseUrl}/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${tokenData.token}`,
      },
      body: JSON.stringify({
        id: orderId,
        currency: 'USD',
        amount: price,
        description: `RadioKong ${name} Subscription - Monthly`,
        callback_url: PESAPAL_CONFIG.callbackUrl,
        notification_id: ipnId,
        billing_address: {
          email_address: email || 'user@radiokong.com',
          first_name: 'RadioKong',
          last_name: 'User',
          country_code: '',
          phone_number: '',
          line_1: '',
          line_2: '',
          city: '',
          state: '',
          postal_code: '',
          zip_code: '',
        },
      }),
    });
    const orderData = await orderRes.json();

    if (orderData.redirect_url) {
      // Open the PesaPal payment page in the default browser
      await shell.openExternal(orderData.redirect_url);

      return {
        status: 'ok',
        trackingId: orderData.order_tracking_id,
        redirectUrl: orderData.redirect_url,
        orderId,
      };
    }

    throw new Error(orderData.error?.message || 'Failed to create PesaPal order');
  } catch (err) {
    console.error('[PesaPal] Payment initiation failed:', err.message);
    return { status: 'error', message: err.message };
  }
});

// PesaPal Subscription - Verify Payment
ipcMain.handle('subscription:verify', async (_event, trackingId) => {
  try {
    // Get access token
    const tokenRes = await fetch(`${PESAPAL_CONFIG.baseUrl}/Auth/RequestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        consumer_key: PESAPAL_CONFIG.consumerKey,
        consumer_secret: PESAPAL_CONFIG.consumerSecret,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.token) {
      throw new Error('Failed to get PesaPal access token');
    }

    // Check transaction status
    const statusRes = await fetch(
      `${PESAPAL_CONFIG.baseUrl}/Transactions/GetTransactionStatus?orderTrackingId=${trackingId}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${tokenData.token}`,
        },
      }
    );
    const statusData = await statusRes.json();

    const isCompleted = statusData.payment_status === 'COMPLETED';

    // Determine tier from the order description
    let tier = 'pro';
    if (statusData.description && statusData.description.toLowerCase().includes('studio')) {
      tier = 'studio';
    }

    return {
      status: 'ok',
      paymentStatus: statusData.payment_status,
      completed: isCompleted,
      tier: isCompleted ? tier : null,
      amount: statusData.amount,
      currency: statusData.currency,
    };
  } catch (err) {
    console.error('[PesaPal] Verification failed:', err.message);
    return { status: 'error', message: err.message, completed: false };
  }
});

// PesaPal Subscription - Cancel
ipcMain.handle('subscription:cancel', async () => {
  // In production, this would call the backend API to cancel
  // For now, just return ok - the renderer will handle local state
  return { status: 'ok' };
});

// Auth - Login
ipcMain.handle('auth:login', async (_event, data) => {
  const { email, password } = data;
  try {
    // In production, this would validate against a backend API
    // For now, return a simulated user
    if (!email || !password) {
      return { status: 'error', message: 'Email and password are required' };
    }
    if (password.length < 6) {
      return { status: 'error', message: 'Invalid email or password' };
    }

    const user = {
      id: `user-${Date.now()}`,
      email,
      displayName: email.split('@')[0],
      createdAt: new Date().toISOString(),
      tier: 'free',
    };

    return { status: 'ok', user };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
});

// Auth - Signup
ipcMain.handle('auth:signup', async (_event, data) => {
  const { email, password, displayName } = data;
  try {
    if (!email || !password || !displayName) {
      return { status: 'error', message: 'All fields are required' };
    }
    if (password.length < 6) {
      return { status: 'error', message: 'Password must be at least 6 characters' };
    }

    const user = {
      id: `user-${Date.now()}`,
      email,
      displayName,
      createdAt: new Date().toISOString(),
      tier: 'free',
    };

    return { status: 'ok', user };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
});

// Auth - Logout
ipcMain.handle('auth:logout', async () => {
  return { status: 'ok' };
});

// File dialogs
ipcMain.handle('dialog:open', async (_event, options) => {
  if (!mainWindow) return { canceled: true, filePaths: [] };
  const result = await dialog.showOpenDialog(mainWindow, options || {});
  return result;
});

ipcMain.handle('dialog:save', async (_event, options) => {
  if (!mainWindow) return { canceled: true, filePath: '' };
  const result = await dialog.showSaveDialog(mainWindow, options || {});
  return result;
});

// Shell - Show file in folder
ipcMain.handle('shell:showInFolder', async (_event, filePath) => {
  try {
    await shell.showItemInFolder(filePath);
    return { status: 'ok' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
});

// Shell - Open path (file/URL)
ipcMain.handle('shell:openPath', async (_event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { status: 'ok' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
});

// Shell - Delete a file (used for deleting recordings)
ipcMain.handle('shell:deleteFile', async (_event, filePath) => {
  try {
    const fs = require('fs');
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return { status: 'ok' };
    }
    return { status: 'ok', message: 'File not found (already deleted)' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
});

// App lifecycle
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
