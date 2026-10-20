import { chromium, _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { demo, deleteScene } from '../src/model.ts';
const native=process.argv.includes('--electron');
const profile=native?await mkdtemp(path.join(tmpdir(),'hinana-history-')):null;
const app=native?await electron.launch({...(process.env.ELECTRON_BINARY?{executablePath:process.env.ELECTRON_BINARY}:{}),args:[...(process.env.ELECTRON_BINARY?[]:['.']),`--user-data-dir=${profile}`]}):null;
const browser=native?null:await chromium.launch({headless:true});
const page=native?await app.firstWindow():await browser.newPage({viewport:{width:1500,height:1050}});
page.setDefaultTimeout(10000);
const errors=[];page.on('pageerror',e=>errors.push(e.stack));
async function recover(){
 await page.waitForTimeout(650);
 return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('hinana-story-recovery',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('recovery').objectStore('recovery').get('last');q.onsuccess=()=>{resolve(q.result.project);db.close();};q.onerror=()=>reject(q.error);};}));
}
async function load(p){
 await page.locator('input[type=file][accept=".hinanastory,.hinana,.json"]').setInputFiles({name:'fixture.hinanastory',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 await expect(page.locator('.scene-item')).toHaveCount(p.scenes.length);
 await expect(page.getByRole('button',{name:'실행 취소',exact:true})).toBeDisabled();
}
try{
 if(!native)await page.goto('http://127.0.0.1:5173');
 await page.locator('.scene-item').first().waitFor();
 // First, middle, and last scene; identical titles must still delete by ID.
 for(const index of [0,1,2]){
  console.log('Checking scene index',index);
  const original=demo();original.scenes[2].next=original.scenes[1].id;
  if(index===2)original.scenes[2].title=original.scenes[1].title;
  await load(original);await page.locator('.scene-item').nth(index).click();
  const last=original.scenes[index].lines.length-1;
  await page.locator('.line-item').nth(last).click();
  await page.getByRole('checkbox',{name:`블록 ${last+1} 선택`,exact:true}).check();
  await page.getByRole('button',{name:'현재 장면 삭제',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'장면 삭제',exact:true});
  await expect(dialog).toContainText(original.scenes[index].title);
  await page.keyboard.press('Control+z');assert.equal(await page.locator('.scene-item').count(),3);
  await dialog.getByRole('button',{name:'취소',exact:true}).click();
  assert.deepEqual(await recover(),original);
  await page.getByRole('button',{name:'현재 장면 삭제',exact:true}).click();
  await dialog.getByRole('button',{name:'장면 삭제',exact:true}).click();
  await expect(page.locator('.scene-item')).toHaveCount(2);
  const expected=deleteScene(original,original.scenes[index].id);
  assert.deepEqual(await recover(),expected);
  const adjacent=expected.scenes[Math.min(index,1)];
  await expect(page.locator('.scene-item.selected')).toContainText(adjacent.title);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.scene-item')).toHaveCount(3);
  await expect(page.locator('.scene-item.selected')).toContainText(original.scenes[index].title);
  await expect(page.locator('.line-row').nth(last).getByRole('checkbox')).toBeChecked();
  assert.deepEqual(await recover(),original);
  await page.keyboard.press('Control+Shift+z');assert.deepEqual(await recover(),expected);
  await page.keyboard.press('Meta+z');assert.deepEqual(await recover(),original);
  await page.keyboard.press('Meta+Shift+z');assert.deepEqual(await recover(),expected);
  await page.getByRole('button',{name:'실행 취소',exact:true}).click();
  assert.deepEqual(await recover(),original);
  await page.getByRole('button',{name:'다시 실행',exact:true}).click();assert.deepEqual(await recover(),expected);
 }
 const original=demo();await load(original);
 const text=page.getByRole('textbox',{name:'대사 내용'}),before=await text.inputValue();
 await text.fill('단축키로 복원할 대사');await page.keyboard.press('Control+z');await expect(text).toHaveValue(before);
 await page.keyboard.press('Control+y');await expect(text).toHaveValue('단축키로 복원할 대사');
 await page.keyboard.press('Meta+z');await expect(text).toHaveValue(before);
 await text.fill('새 수정');await expect(page.getByRole('button',{name:'다시 실행',exact:true})).toBeDisabled();
 // Player shortcuts must never change the underlying authoring project.
 await page.getByRole('button',{name:'플레이 테스트',exact:true}).click();await page.keyboard.press('Control+z');await page.keyboard.press('Escape');
 await expect(text).toHaveValue('새 수정');
 await page.locator('.scene-item').last().click();
 for(let i=0;i<2;i++){await page.getByRole('button',{name:'현재 장면 삭제',exact:true}).click();await page.getByRole('dialog',{name:'장면 삭제'}).getByRole('button',{name:'장면 삭제',exact:true}).click();}
 await expect(page.locator('.scene-item')).toHaveCount(1);await expect(page.getByRole('button',{name:'현재 장면 삭제',exact:true})).toBeDisabled();
 await page.keyboard.press('Control+z');await page.keyboard.press('Control+z');await expect(page.locator('.scene-item')).toHaveCount(3);
 assert.deepEqual(errors,[]);console.log(`PASS (${native?'Electron':'browser'}): isolated scene deletion, cancel, exact project/link restoration, selection restoration, Ctrl/Cmd undo/redo, Ctrl+Y, text editing, redo invalidation, player isolation, last-scene guard`);
}finally{
 if(app){await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();await rm(profile,{recursive:true,force:true});}
 await browser?.close();
}
