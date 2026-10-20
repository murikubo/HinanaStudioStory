const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const pkg = require('./package.json');
if (!app.commandLine.hasSwitch('user-data-dir')) app.setPath('userData', path.join(app.getPath('appData'), pkg.name));
let win;
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({ width: 1280, height: 800, minWidth: 760, minHeight: 540, backgroundColor: '#14121c', title: pkg.productName, ...(require('node:fs').existsSync(path.join(__dirname,'game-icon.png'))?{icon:path.join(__dirname,'game-icon.png')}:{}), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  const transfer=require('./save-transfer.cjs').saveTransfer({dialog,window:()=>win});
  const trusted=event=>{if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted sender');};
  ipcMain.handle('play:save',async(event,raw)=>{trusted(event);return transfer.save(raw,pkg.productName);});
  ipcMain.handle('play:open',async event=>{trusted(event);return transfer.open();});
  ipcMain.handle('game:project', async event => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('Untrusted sender');
    return fs.readFile(path.join(__dirname, 'story.json'), 'utf8');
  });
  win.loadFile(path.join(__dirname, 'index.html'));
});
app.on('window-all-closed', () => app.quit());
