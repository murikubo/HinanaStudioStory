const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
let win;
let exporting = false;
let allowClose = false, rendererReady = false;
function requestClose() {
  if (!win || win.isDestroyed()) return;
  if (rendererReady) win.webContents.send('app:close-request');
  else { allowClose = true; win.close(); }
}
app.on('before-quit', event => {
  if (!allowClose && win && !win.isDestroyed()) { event.preventDefault(); requestClose(); }
});
const dev = process.argv.includes('--dev');
function trusted(event) {
  if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('Untrusted sender');
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const studioIcon = path.join(__dirname, dev ? '../public/studio-icon.png' : '../dist/studio-icon.png');
  if (process.platform === 'darwin') app.dock?.setIcon(studioIcon);
  win = new BrowserWindow({ width: 1500, height: 980, minWidth: 1100, minHeight: 760, backgroundColor: '#13141b', icon: studioIcon, title: 'Hinana Studio Story', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.on('close', event => { if(!allowClose){event.preventDefault();requestClose();} });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('before-input-event', (event,input) => { if(input.type==='keyDown'&&input.key.toLowerCase()==='q'&&(process.platform==='darwin'?input.meta:input.control)){event.preventDefault();requestClose();} });
  win.webContents.on('will-navigate', event => event.preventDefault());
  if (dev) win.loadURL('http://127.0.0.1:5173'); else win.loadFile(path.join(__dirname, '../dist/index.html'));
  const exports=require('./export-actions.cjs').exportActions({platform:process.platform,openPath:file=>shell.openPath(file)});
  ipcMain.handle('game:export-options',event=>{trusted(event);return {platform:process.platform,arch:process.arch,signing:require('./distribution.cjs').signingOptions()};});
  ipcMain.handle('game:launch',async(event,root)=>{trusted(event);await exports.launch(root);});
  ipcMain.handle('game:reveal',async(event,root)=>{trusted(event);await exports.reveal(root);});
  ipcMain.handle('game:export', async (event, request) => {
    trusted(event);
    if (exporting) throw new Error('다른 내보내기가 진행 중입니다.');
    if (!request || !['web','windows','macos'].includes(request.target) || typeof request.project !== 'string' || Buffer.byteLength(request.project) > 80 * 1024 * 1024) throw new Error('내보내기 요청이 올바르지 않습니다.');
    exporting = true;
    try {
      const result = await dialog.showOpenDialog(win, { title: '작품을 내보낼 위치', properties: ['openDirectory','createDirectory'] });
      if (result.canceled) return null;
      const { exportGame } = require('./exporter.cjs');
      const exported=await exportGame({ raw: request.project, target: request.target, parent: result.filePaths[0], dist: path.join(__dirname, '../dist'), electronVersion: process.versions.electron, format:request.format??'directory',signing:request.signing??'local', progress: message => { if (!win.isDestroyed()) win.webContents.send('game:export-progress', message); } });
      exports.remember(exported);return exported;
    } finally { exporting = false; }
  });
  const scripts=require('./script-transfer.cjs').scriptTransfer({dialog,window:()=>win});
  ipcMain.handle('script:save',async(event,...args)=>{trusted(event);return scripts.save(...args);});
  const transfer=require('./save-transfer.cjs').saveTransfer({dialog,window:()=>win});
  ipcMain.handle('play:save',async(event,raw,title)=>{trusted(event);return transfer.save(raw,title);});
  ipcMain.handle('play:open',async event=>{trusted(event);return transfer.open();});
  const backups=require('./project-backups.cjs').projectBackups({directory:app.getPath('userData')});
  const files = require('./project-files.cjs').projectFiles({ directory: app.getPath('userData'), dialog, window: () => win,backups });
  const ready = files.init();
  const handle = (channel, action) => ipcMain.handle(channel, async (event,...args) => { trusted(event); await ready; return action(...args); });
  handle('backup:list',key=>backups.list(key));
  handle('backup:read',(key,id)=>backups.read(key,id));
  handle('backup:create',(raw,reason)=>backups.create(raw,reason));
  handle('project:state', () => files.state());
  handle('project:activate', (file,title) => files.activate(file,title));
  handle('app:close-ready', () => {rendererReady=true;});
  handle('app:close-request', requestClose);
  handle('app:close-confirm', () => {allowClose=true;win.destroy();app.quit();});
  handle('project:save-new', content => files.save(content,true,true));
  handle('project:save', (content,saveAs) => files.save(content,saveAs));
  handle('project:open', () => files.open());
  handle('project:recent', file => files.openRecent(file));

});
app.on('window-all-closed', () => app.quit());
