import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getData: (key) => ipcRenderer.invoke('get-data', key),
  setData: (key, val) => ipcRenderer.invoke('set-data', key, val),
  syncAde: (url) => ipcRenderer.invoke('sync-ade', url),
  on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args))
});
