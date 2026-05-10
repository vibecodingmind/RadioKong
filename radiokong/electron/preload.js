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
});
