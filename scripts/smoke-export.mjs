import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const userData=await mkdtemp(path.join(tmpdir(),'hinana-export-ui-'));
const output=path.resolve('test-results/exports');
const app=await electron.launch({...(process.env.ELECTRON_BINARY?{executablePath:process.env.ELECTRON_BINARY}:{}),args:[...(process.env.ELECTRON_BINARY?[]:['.']),`--user-data-dir=${userData}`]});
let gamePath;
try{
 const page=await app.firstWindow();
 await page.evaluate(()=>window.studio.onExportProgress(message=>console.log(message)));
 page.on('console',m=>console.log('UI:',m.text()));await page.getByRole('button',{name:'작품 내보내기',exact:true}).waitFor();
 await app.evaluate(({dialog},output)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[output]})},output);
 await page.getByRole('button',{name:'작품 내보내기',exact:true}).click();
 const panel=page.getByRole('dialog',{name:'작품 내보내기',exact:true});
 await panel.getByRole('button',{name:/웹 게임/}).click();await panel.getByRole('button',{name:'폴더 선택 후 내보내기'}).click();
 await panel.locator('.export-result').or(panel.locator('.export-status').filter({hasText:/Error|오류|못했/})).waitFor({timeout:120000});
 assert.ok(await panel.locator('.export-result').count(),await panel.locator('.export-status').textContent());const web=await panel.locator('.export-result').textContent();
 assert.ok((await readFile(path.join(web,'index.html'),'utf8')).includes('game-'));
 await panel.getByRole('button',{name:/Windows 게임/}).click();await panel.getByRole('button',{name:'폴더 선택 후 내보내기'}).click();
 await panel.locator('.export-result').or(panel.locator('.export-status').filter({hasText:/Error|오류|못했/})).waitFor({timeout:180000});
 assert.ok(await panel.locator('.export-result').count(),await panel.locator('.export-status').textContent());const windows=await panel.locator('.export-result').textContent();
 assert.ok(windows.includes('-windows-'));
 gamePath=path.join(windows,'resources/app');
 const p=JSON.parse(await readFile(path.join(gamePath,'story.json'),'utf8'));
 assert.equal(p.title,'여름의 끝에서');assert.equal((await readFile(path.join(windows,'여름의 끝에서.exe'))).subarray(0,2).toString(),'MZ');
 await page.screenshot({path:'test-results/export-ui.png'});
 await writeFile('test-results/export-ui.json',JSON.stringify({web,windows,gamePath},null,2));
 console.log('PASS: packaged editor export UI, IPC progress, web bundle and real Windows exe export');
}finally{await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.destroy()});await app.close();await rm(userData,{recursive:true,force:true})}
const gameData=await mkdtemp(path.join(tmpdir(),'hinana-exported-game-'));
const game=await electron.launch({args:[gamePath,`--user-data-dir=${gameData}`]});
try{
 const page=await game.firstWindow();await page.getByRole('button',{name:'처음부터 시작'}).waitFor();
 assert.equal(await page.title(),'여름의 끝에서');assert.equal(await page.evaluate(()=>typeof window.studio),'undefined');assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
 await page.getByRole('button',{name:'처음부터 시작'}).click();await page.getByRole('button',{name:'퀵세이브',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'이어하기'}).click();await page.getByRole('button',{name:'퀵세이브',exact:true}).waitFor();
 console.log('PASS: exported Windows resources/app launches with macOS Electron, game-only preload, save and continue survive reload');
}finally{await game.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.destroy()});await game.close();await rm(gameData,{recursive:true,force:true})}
