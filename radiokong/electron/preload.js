const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Audio engine controls
  engineStart: (config) => ipcRenderer.invoke('engine:start', config),
  engineStop: () => ipcRenderer.invoke('engine:stop'),
  engineCommand: (command) => ipcRenderer.invoke('engine:command', command),

  // Engine message listener
  onEngineMessage: (callback) => {
    ipcRenderer.on('engine:message', (_event, message) => callback(message));
  },

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Subscription / PesaPal IPC
  subscriptionInitiate: (data) => ipcRenderer.invoke('subscription:initiate', data),
  subscriptionVerify: (trackingId) => ipcRenderer.invoke('subscription:verify', trackingId),
  subscriptionCancel: () => ipcRenderer.invoke('subscription:cancel'),

  // Open external URL (for PesaPal payment redirect)
  openExternal: (url) => ipcRenderer.invoke('open:external', url),

  // Auth
  authLogin: (data) => ipcRenderer.invoke('auth:login', data),
  authSignup: (data) => ipcRenderer.invoke('auth:signup', data),
  authLogout: () => ipcRenderer.invoke('auth:logout'),

  // File dialogs
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:open', options),
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:save', options),

  // File system
  showItemInFolder: (path) => ipcRenderer.invoke('shell:showInFolder', path),
  openPath: (path) => ipcRenderer.invoke('shell:openPath', path),
  deleteFile: (path) => ipcRenderer.invoke('shell:deleteFile', path),
});
