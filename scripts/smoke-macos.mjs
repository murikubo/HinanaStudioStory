import {_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,rename,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
if(process.platform!=='darwin'){console.log('SKIP: native macOS export requires a Mac');process.exit(0);}
const exec=promisify(execFile),root=await mkdtemp(path.join(tmpdir(),'hinana-native-mac-'));
const manifest=JSON.parse(await readFile('test-results/exports.json','utf8')),project={...manifest.project,id:`mac-ui-${randomUUID()}`};
const source=path.join(root,'source.hinanastory');await writeFile(source,JSON.stringify(project));await mkdir('test-results/exports',{recursive:true});
let editor,game,launchedPid,launchData;const errors=[];
const stop=async app=>{if(app){await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.destroy()}).catch(()=>{});await app.close().catch(()=>{});}};
try{
 editor=await electron.launch({...(process.env.ELECTRON_BINARY?{executablePath:process.env.ELECTRON_BINARY}:{}),args:[...(process.env.ELECTRON_BINARY?[]:['.']),`--user-data-dir=${path.join(root,'editor')}`]});
 const page=await editor.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.getByRole('button',{name:'작품 내보내기',exact:true}).waitFor();await page.locator('input[type=file]').first().setInputFiles(source);await page.getByRole('status').filter({hasText:'프로젝트를 열었습니다.'}).waitFor();
 const output=path.resolve('test-results/exports');await editor.evaluate(({dialog},output)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[output]});},output);
 await page.getByRole('button',{name:'작품 내보내기',exact:true}).click();const panel=page.getByRole('dialog',{name:'작품 내보내기',exact:true});const mac=panel.getByRole('button',{name:/macOS 게임/});await mac.waitFor();await mac.click();
 await panel.getByRole('button',{name:'폴더 선택 후 내보내기'}).click();await panel.locator('.export-result').or(panel.locator('.export-status').filter({hasText:/Error|오류|못했|failed/})).waitFor({timeout:240000});
 assert.equal(await panel.locator('.export-result').count(),1,await panel.locator('.export-status').textContent());const outputRoot=await panel.locator('.export-result').textContent(),appPath=path.join(outputRoot,`${project.title}.app`),executable=path.join(appPath,'Contents/MacOS/Electron');
 const packageData=JSON.parse(await readFile(path.join(appPath,'Contents/Resources/app/package.json'),'utf8'));launchData=path.join(await editor.evaluate(({app})=>app.getPath('appData')),packageData.name);
 assert.deepEqual(JSON.parse(await readFile(path.join(appPath,'Contents/Resources/app/story.json'),'utf8')),project);
 assert.ok(!(await (await import('node:fs/promises')).readdir(path.join(appPath,'Contents/Resources/app/assets'))).some(n=>n.startsWith('editor-')),'editor bundle is excluded');
 await exec('/usr/bin/codesign',['--verify','--deep','--strict',appPath]);
 const title=(await exec('/usr/bin/plutil',['-extract','CFBundleDisplayName','raw','-o','-',path.join(appPath,'Contents/Info.plist')])).stdout.trim();assert.equal(title,project.title);
 await assert.rejects(page.evaluate(()=>window.studio.launchGame('/Applications/Terminal.app')),/내보낸 작품/);
 await panel.getByRole('button',{name:'게임 실행',exact:true}).click();await panel.locator('.export-status').filter({hasText:'게임을 실행했습니다.'}).waitFor();
 for(let attempt=0;attempt<50;attempt++){
  const processes=(await exec('/bin/ps',['-axo','pid=,command='])).stdout.split('\n');const launched=processes.find(line=>line.normalize('NFC').includes(executable.normalize('NFC'))&&!line.includes('--type='));if(launched){launchedPid=Number(launched.trim().split(/\s+/)[0]);break;}await new Promise(r=>setTimeout(r,100));
 }
 assert.ok(launchedPid,'game launch button starts the exported native executable');await page.screenshot({path:'test-results/macos-export-ui.png'});
 process.kill(launchedPid,'SIGTERM');for(let i=0;i<50;i++){try{process.kill(launchedPid,0);await new Promise(r=>setTimeout(r,100));}catch{break;}}launchedPid=null;
 await stop(editor);editor=null;
 // Move only the .app to prove it has no dependencies on the editor or output folder.
 const movedDirectory=path.join(output,'Mac 독립 실행 확인');await mkdir(movedDirectory,{recursive:true});const movedApp=path.join(movedDirectory,`${project.title}-${randomUUID().slice(0,8)}.app`);await rename(appPath,movedApp);
 const nativeExecutable=path.join(movedApp,'Contents/MacOS/Electron'),profile=path.join(root,'game');
 const launch=()=>electron.launch({executablePath:nativeExecutable,args:[`--user-data-dir=${profile}`]});game=await launch();let p=await game.firstWindow();p.on('pageerror',e=>errors.push(e.message));await p.getByRole('button',{name:'처음부터 시작'}).waitFor();assert.equal(await p.title(),project.title);
 assert.equal(await p.evaluate(()=>typeof window.studio),'undefined');assert.equal(await p.evaluate(()=>typeof window.require),'undefined');const prefs=await game.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());assert.ok(prefs.sandbox&&prefs.contextIsolation&&!prefs.nodeIntegration);
 const configure=async()=>{await p.getByRole('button',{name:'설정',exact:true}).click();const settings=p.getByRole('dialog',{name:'플레이 설정'});await settings.getByRole('slider',{name:'텍스트 속도',exact:true}).fill('0');await settings.getByRole('slider',{name:'음악 음량',exact:true}).fill('25');await settings.getByRole('button',{name:'플레이 설정 닫기'}).click();};
 await configure();await p.getByRole('button',{name:'처음부터 시작'}).click();assert.equal(await p.locator('.cast-layer img').count(),2);assert.equal(await p.locator('.actor-dim').count(),1);
 await p.waitForFunction(()=>[...document.querySelectorAll('audio')].some(audio=>!audio.paused&&audio.currentTime>0));
 const stored=()=>p.evaluate(id=>JSON.parse(localStorage.getItem(`hinana:play:game:${id}`)),project.id);
 await p.getByRole('button',{name:'퀵세이브',exact:true}).click();await p.getByRole('status').filter({hasText:'퀵세이브했습니다.'}).waitFor();assert.equal((await stored()).slots.quick.session.variables.score,1);
 await p.getByRole('button',{name:'다음',exact:true}).click();await p.getByRole('button',{name:'저장',exact:true}).click();let slots=p.getByRole('dialog',{name:'플레이 저장'});await slots.getByRole('button',{name:/^슬롯 1/}).click();await slots.getByRole('button',{name:'플레이 저장 닫기'}).click();assert.equal((await stored()).slots['1'].session.variables.score,3);
 await p.getByRole('button',{name:'다음',exact:true}).click();assert.equal(await p.getByRole('button',{name:'조금 더 이야기를 들어본다'}).count(),0);await p.getByRole('button',{name:'함께 추억을 만들자고 한다'}).click();assert.equal((await stored()).slots.auto.session.variables.score,7);
 await p.getByRole('button',{name:'불러오기',exact:true}).click();slots=p.getByRole('dialog',{name:'플레이 불러오기'});await slots.getByRole('button',{name:/^슬롯 1/}).click();assert.equal(await p.locator('.dialogue-content p').textContent(),project.scenes[0].lines[1].text);assert.equal((await stored()).slots['1'].session.variables.score,3);
 await p.getByRole('button',{name:'퀵로드',exact:true}).click();assert.equal(await p.locator('.dialogue-content p').textContent(),project.scenes[0].lines[0].text);await p.getByRole('button',{name:'다음',exact:true}).click();await p.getByRole('button',{name:'다음',exact:true}).click();await p.getByRole('button',{name:'함께 추억을 만들자고 한다'}).click();assert.equal((await stored()).slots.auto.session.variables.score,7,'loaded entries do not replay effects');
 await p.getByRole('button',{name:'이야기 마치기'}).click();await p.getByText('THE END',{exact:true}).waitFor();const credits=p.getByRole('region',{name:'제작 크레딧'});await credits.getByText('Made by',{exact:true}).waitFor();await credits.getByLabel('Powered by Hinana Studio Story',{exact:true}).waitFor();const widths=await credits.locator('img').evaluateAll(async images=>{await Promise.all(images.map(img=>img.decode()));return images.map(img=>img.naturalWidth)});assert.ok(widths.every(n=>n>0));await p.screenshot({path:'test-results/macos-game-ending.png'});
 await stop(game);game=await launch();p=await game.firstWindow();await p.getByRole('button',{name:'이어하기'}).click();await p.getByRole('region',{name:'제작 크레딧'}).waitFor();await p.getByRole('button',{name:'제목 화면',exact:true}).click();await p.getByRole('button',{name:'불러오기',exact:true}).click();await p.getByRole('dialog',{name:'플레이 불러오기'}).getByRole('button',{name:/^슬롯 1/}).click();assert.equal(await p.locator('.dialogue-content p').textContent(),project.scenes[0].lines[1].text);assert.equal((await p.evaluate(()=>JSON.parse(localStorage.getItem('hinana:player:settings:v1')))).music,.25);assert.deepEqual(errors,[]);
 await writeFile('test-results/macos-native.json',JSON.stringify({appPath:movedApp,executable:nativeExecutable,title,arch:process.arch,verified:['native export UI','launch button','moved app','sandbox','music','characters','conditional branch','manual save/load','quick save/load','ending logos','restart persistence']},null,2));
 console.log('PASS: real macOS .app exported via editor, launch button starts native client, moved standalone app, signature/metadata, sandbox, audio/cast/branch, manual and quick saves, ending logos and persistence across native restart');
}finally{if(launchedPid)try{process.kill(launchedPid,'SIGTERM')}catch{}await stop(game);await stop(editor);if(launchData)await rm(launchData,{recursive:true,force:true});await rm(root,{recursive:true,force:true});}
