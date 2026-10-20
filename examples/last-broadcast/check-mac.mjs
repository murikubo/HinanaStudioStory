import {_electron as electron} from '@playwright/test';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const manifest=JSON.parse(await readFile('test-results/last-broadcast-macos-export.json','utf8')),profile=await mkdtemp(path.join(tmpdir(),'hinana-last-broadcast-mac-'));
const game=await electron.launch({executablePath:path.join(manifest.appPath,'Contents/MacOS/Electron'),args:[`--user-data-dir=${profile}`]}),reports=[],errors=[];
try{
 const page=await game.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.getByRole('button',{name:'처음부터 시작'}).waitFor();assert.equal(await page.title(),'마지막 방송이 끝나기 전에');await page.getByRole('button',{name:'설정',exact:true}).click();const settings=page.getByRole('dialog',{name:'플레이 설정'});await settings.getByRole('slider',{name:'텍스트 속도',exact:true}).fill('0');await settings.getByRole('button',{name:'플레이 설정 닫기'}).click();
 for(const [first,second,ending] of [[0,0,0],[0,0,1],[0,1,0],[1,0,0],[1,1,0]]){
  await page.getByRole('button',{name:'처음부터 시작'}).click();let steps=0,decision=0;const selections=[first,second,ending];
  while(steps++<100){
   if(await page.getByText('THE END',{exact:true}).count())break;
   const choices=page.locator('.play-choices button');if(await choices.count()){await choices.nth(selections[decision++]).click();continue;}
   const advance=page.locator('.next-dialogue');await advance.waitFor();
   if(first===0&&second===0&&ending===0&&steps===6){await page.waitForFunction(()=>[...document.querySelectorAll('audio')].some(a=>!a.paused&&a.currentTime>0));await page.locator('.cast-layer img').evaluateAll(async images=>Promise.all(images.map(i=>i.decode())));await page.screenshot({path:'test-results/last-broadcast-macos-play.png'});}
   await advance.click();
  }
  assert.ok(steps<100);assert.equal(decision,3);const credits=page.getByRole('region',{name:'제작 크레딧'});await credits.getByText('Made by',{exact:true}).waitFor();await credits.getByLabel('Powered by Hinana Studio Story',{exact:true}).waitFor();await credits.locator('img').evaluateAll(async images=>Promise.all(images.map(i=>i.decode())));
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('hinana:play:game:last-broadcast-original-v1')).slots.auto);assert.ok(saved.ended);reports.push({first,second,ending,scene:saved.session.sceneId,courage:saved.session.variables.courage,steps});if(reports.length===1)await page.screenshot({path:'test-results/last-broadcast-macos-ending.png'});console.log(`PASS: native route ${reports.length}/5 → ${saved.session.sceneId}`);await page.getByRole('button',{name:'제목 화면',exact:true}).click();
 }
 assert.ok(reports.some(r=>r.scene==='tomorrow'));assert.ok(reports.some(r=>r.scene==='archive'));assert.deepEqual(errors,[]);await writeFile('test-results/last-broadcast-macos-verification.json',JSON.stringify({passed:true,appPath:manifest.appPath,routes:reports},null,2));console.log('PASS: original 5-minute novel in actual Mac client, all 5 valid routes, both endings, embedded sprites/music and credits');
}finally{await game.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.destroy()});await game.close();await rm(profile,{recursive:true,force:true});}
