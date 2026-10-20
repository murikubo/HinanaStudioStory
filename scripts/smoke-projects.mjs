import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { newProject } from '../src/model.ts';
const root=await mkdtemp(path.join(tmpdir(),'hinana-project-ui-')),user=path.join(root,'user');
const alpha=path.join(root,'alpha.hinanastory'),beta=path.join(root,'beta.hinanastory'),gamma=path.join(root,'gamma.hinanastory'),legacy=path.join(root,'legacy.hinana'),migrated=path.join(root,'legacy.hinanastory'),invalid=path.join(root,'invalid.hinanastory');
const launch=()=>electron.launch({...(process.env.ELECTRON_BINARY?{executablePath:process.env.ELECTRON_BINARY}:{}),args:[...(process.env.ELECTRON_BINARY?[]:['.']),`--user-data-dir=${user}`]});
let app=await launch();
try{
 let page=await app.firstWindow();await page.getByRole('textbox',{name:'프로젝트 이름',exact:true}).waitFor();
 await app.evaluate(({dialog},file)=>{globalThis.projectQA={file,saveCount:0,open:''};dialog.showSaveDialog=async(_w,options)=>{globalThis.projectQA.saveCount++;if(options.filters[0].extensions[0]!=='hinanastory')throw Error('wrong extension');return{canceled:false,filePath:globalThis.projectQA.file}};dialog.showOpenDialog=async()=>({canceled:false,filePaths:[globalThis.projectQA.open]});},alpha);
 async function save(){await page.getByRole('button',{name:'저장',exact:true}).click();await page.getByRole('status').filter({hasText:'프로젝트 파일을 저장했습니다.'}).waitFor();}
 await save();await page.getByRole('textbox',{name:'프로젝트 이름',exact:true}).fill('알파 수정');await save();assert.equal(await app.evaluate(()=>globalThis.projectQA.saveCount),1);assert.equal(JSON.parse(await readFile(alpha,'utf8')).title,'알파 수정');
 await app.evaluate((_,file)=>globalThis.projectQA.file=file,beta);await page.locator('.project-menu summary').click();await page.getByRole('button',{name:'다른 이름으로 저장'}).click();await page.waitForFunction(file=>document.querySelector('.file-status')?.getAttribute('title')===file,beta);
 assert.equal(await app.evaluate(()=>globalThis.projectQA.saveCount),2);
 await page.locator('.project-menu summary').click();await page.getByRole('button',{name:'새 프로젝트',exact:true}).click();const create=page.getByRole('dialog',{name:'새 프로젝트',exact:true});await create.getByRole('textbox',{name:'프로젝트 이름'}).fill('감마');await create.getByRole('button',{name:'만들기',exact:true}).click();
 await app.evaluate((_,file)=>globalThis.projectQA.file=file,gamma);await save();assert.equal(await app.evaluate(()=>globalThis.projectQA.saveCount),3);
 await page.locator('.project-menu summary').click();await page.locator('.recent-project').filter({has:page.locator('small',{hasText:alpha})}).click();await page.waitForFunction(()=>document.querySelector('.project-card input')?.value==='알파 수정');assert.equal((await page.evaluate(()=>window.studio.fileState())).path,alpha);
 await writeFile(invalid,'{broken');await app.evaluate((_,file)=>globalThis.projectQA.open=file,invalid);await page.getByRole('button',{name:'열기',exact:true}).click();await page.getByRole('status').waitFor();assert.equal((await page.evaluate(()=>window.studio.fileState())).path,alpha,'invalid imports do not change remembered save path');
 const legacyProject=newProject('이전 형식');await writeFile(legacy,JSON.stringify(legacyProject));await app.evaluate((_,file)=>globalThis.projectQA.open=file,legacy);await page.getByRole('button',{name:'열기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.project-card input')?.value==='이전 형식');await app.evaluate((_,file)=>globalThis.projectQA.file=file,legacy);await save();assert.equal((await page.evaluate(()=>window.studio.fileState())).path,migrated);assert.equal(JSON.parse(await readFile(legacy,'utf8')).title,'이전 형식');
 await page.waitForTimeout(750);await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.destroy()});await app.close();
 app=await launch();page=await app.firstWindow();await page.waitForFunction(async file=>(await window.studio.fileState()).path===file,migrated);
 await app.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>{throw Error('save dialog should not be needed')}});
 await page.getByRole('textbox',{name:'프로젝트 이름',exact:true}).fill('재시작 후 저장');await save();assert.equal(JSON.parse(await readFile(migrated,'utf8')).title,'재시작 후 저장');
 console.log('PASS: native .hinanastory dialogs/save, remembered path/save-as, new project reset, recent open, invalid import preserves path, legacy migration, path persists across app restart');
}finally{await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.destroy()});await app.close();await rm(root,{recursive:true,force:true})}
