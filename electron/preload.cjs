const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('studio', {
  savePlayData:(raw,title)=>ipcRenderer.invoke('play:save',raw,title),
  openPlayData:()=>ipcRenderer.invoke('play:open'),
  saveNew: content => ipcRenderer.invoke('project:save-new', content),
  requestClose: () => ipcRenderer.invoke('app:close-request'),
  close: () => ipcRenderer.invoke('app:close-confirm'),
  onCloseRequested: callback => { const listener=()=>callback();ipcRenderer.on('app:close-request',listener);void ipcRenderer.invoke('app:close-ready');return()=>ipcRenderer.removeListener('app:close-request',listener); },
  save: (content,saveAs=false) => ipcRenderer.invoke('project:save', content,saveAs),
  fileState: () => ipcRenderer.invoke('project:state'),
  activateProject: (file,title) => ipcRenderer.invoke('project:activate', file,title),
  openRecent: file => ipcRenderer.invoke('project:recent', file),
  open: () => ipcRenderer.invoke('project:open'),
  exportOptions: () => ipcRenderer.invoke('game:export-options'),
  launchGame: root => ipcRenderer.invoke('game:launch',root),
  revealExport: root => ipcRenderer.invoke('game:reveal',root),
  exportGame: request => ipcRenderer.invoke('game:export', request),
  onExportProgress: callback => { const listener = (_event, message) => { if (typeof message === 'string') callback(message); }; ipcRenderer.on('game:export-progress', listener); return () => ipcRenderer.removeListener('game:export-progress', listener); }
});
