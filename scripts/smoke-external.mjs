import {_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=await mkdtemp(path.join(tmpdir(),'hinana-external-ui-')),file=path.join(dir,'external.hinanastory');
const app=await electron.launch({...(process.env.ELECTRON_BINARY?{executablePath:process.env.ELECTRON_BINARY}:{}),args:[...(process.env.ELECTRON_BINARY?[]:['.']),`--user-data-dir=${path.join(dir,'user')}`]});
try{
 const page=await app.firstWindow();await page.locator('.stage').waitFor();const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');await page.locator('input[type=file]').nth(1).setInputFiles({name:'pixel.png',mimeType:'image/png',buffer:png});await page.getByRole('combobox',{name:'배경 이미지',exact:true}).selectOption({label:'pixel.png'});
 await page.getByRole('button',{name:'에셋',exact:true}).click();await page.getByRole('combobox',{name:'프로젝트 저장 방식'}).selectOption('external');
 await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);await page.getByRole('button',{name:'저장',exact:true}).click();await page.getByRole('status').filter({hasText:'프로젝트 파일을 저장했습니다.'}).waitFor();
 const data=JSON.parse(await readFile(file,'utf8'));assert.match(data.assets[0].url,/^external.assets\//);assert.deepEqual(await readFile(path.join(dir,data.assets[0].url)),png);
 await page.getByRole('button',{name:'열기',exact:true}).click();await page.getByRole('status').filter({hasText:'프로젝트를 열었습니다.'}).waitFor();assert.ok((await page.locator('.stage').getAttribute('style')).includes('data:image/png;base64'));
 await page.waitForTimeout(800);await page.reload();await page.getByRole('textbox',{name:'프로젝트 이름',exact:true}).waitFor();await page.waitForFunction(async file=>(await window.studio.fileState()).path===file,file);await page.getByRole('button',{name:'에셋',exact:true}).click();assert.equal(await page.getByRole('combobox',{name:'프로젝트 저장 방식'}).inputValue(),'external');
 await page.getByRole('combobox',{name:'프로젝트 저장 방식'}).selectOption('embedded');await page.getByRole('button',{name:'저장',exact:true}).click();await page.getByRole('status').filter({hasText:'프로젝트 파일을 저장했습니다.'}).waitFor();assert.ok(JSON.parse(await readFile(file,'utf8')).assets[0].url.startsWith('data:'));
 const broken=path.join(dir,'missing.hinanastory');await writeFile(broken,JSON.stringify({...data,assets:[{...data.assets[0],url:'missing.assets/'+ '0'.repeat(24)+'.png'}]}));await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},broken);await page.getByRole('button',{name:'열기',exact:true}).click();await page.getByRole('status').filter({hasText:'찾지 못했습니다'}).waitFor();assert.equal((await page.evaluate(()=>window.studio.fileState())).path,file);
 console.log('PASS: packaged external-folder UI save/open/hydration, recovered mode/path, convert embedded, missing asset preserves active project');
}finally{await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.destroy()});await app.close();await rm(dir,{recursive:true,force:true});}
