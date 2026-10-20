const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('game', { savePlayData:raw=>ipcRenderer.invoke('play:save',raw),openPlayData:()=>ipcRenderer.invoke('play:open'),project: () => ipcRenderer.invoke('game:project') });
