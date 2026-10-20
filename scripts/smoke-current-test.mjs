import { chromium, _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { demo } from '../src/model.ts';
const native=process.argv.includes('--electron'),profile=native?await mkdtemp(path.join(tmpdir(),'hinana-current-test-')):null;
const app=native?await electron.launch({...(process.env.ELECTRON_BINARY?{executablePath:process.env.ELECTRON_BINARY}:{}),args:[...(process.env.ELECTRON_BINARY?[]:['.']),`--user-data-dir=${profile}`]}):null;
const browser=native?null:await chromium.launch({headless:true});
const page=native?await app.firstWindow():await browser.newPage({viewport:{width:1500,height:980}});
page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 if(!native)await page.goto('http://127.0.0.1:5173');
 await page.locator('.scene-item').first().waitFor();
 await page.evaluate(()=>localStorage.setItem('hinana:player:settings:v1',JSON.stringify({speed:0})));
 const p=demo(),scene=p.scenes[0];p.variables=[{id:'score',name:'점수',initial:2}];
 scene.lines[0].effects=[{variableId:'score',operation:'add',value:3}];scene.lines[1].effects=[{variableId:'score',operation:'add',value:2}];
 scene.lines[2].choices[0].condition={variableId:'score',operator:'>=',value:7};
 scene.lines[2].choices[1].condition={variableId:'score',operator:'<',value:7};
 p.scenes[1].lines[0].effects=[{variableId:'score',operation:'add',value:1}];
 await page.locator('input[type=file][accept=".hinanastory,.hinana,.json"]').setInputFiles({name:'current.hinanastory',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 await page.locator('.line-item').nth(1).click();
 const test=page.getByRole('button',{name:'현재 위치에서 테스트',exact:true}),modal=page.getByRole('dialog',{name:'플레이 테스트',exact:true});
 const text=page.getByRole('textbox',{name:'대사 내용'}),current='방금 수정한 현재 대사입니다.';
 await text.fill(current);
 await test.click();await expect(modal.locator('.dialogue-content p')).toHaveText(current);await expect(modal.locator('.runtime-vars')).toHaveText('점수7');
 await modal.getByRole('button',{name:'다음',exact:true}).click();await expect(modal.locator('.runtime-vars')).toHaveText('점수7');
 await expect(modal.getByRole('button',{name:scene.lines[2].choices[1].text,exact:true})).toHaveCount(0);
 await modal.getByRole('button',{name:scene.lines[2].choices[0].text,exact:true}).click();
 await expect(modal.locator('.dialogue-content p')).toHaveText(p.scenes[1].lines[0].text);await expect(modal.locator('.runtime-vars')).toHaveText('점수8');
 await page.keyboard.press('Escape');await expect(text).toHaveValue(current);await expect(page.locator('.line-item.active, .line-item.selected')).toContainText(current);
 // Keyboard shortcut works while editing; reopening starts a fresh test session.
 for(const shortcut of ['Control+Enter','Meta+Enter']){
  await text.focus();await page.keyboard.press(shortcut);await expect(modal.locator('.dialogue-content p')).toHaveText(current);await expect(modal.locator('.runtime-vars')).toHaveText('점수7');await page.keyboard.press('Escape');await expect(text).toBeFocused();
 }
 await page.locator('.line-item').nth(2).click();await test.click();await expect(modal.locator('.dialogue-content p')).toHaveText(scene.lines[2].text);await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'플레이 테스트',exact:true}).click();await expect(modal.locator('.dialogue-content p')).toHaveText(scene.lines[0].text);await expect(modal.locator('.runtime-vars')).toHaveText('점수5');await page.keyboard.press('Escape');
 await page.locator('.scene-item').nth(2).click();await test.click();await expect(modal.locator('.dialogue-content p')).toHaveText(p.scenes[2].lines[0].text);await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'정보',exact:true}).click();await page.keyboard.press('Control+Enter');await expect(modal).toHaveCount(0);await page.keyboard.press('Escape');
 if(!native){for(const width of [1100,1200,1500]){await page.setViewportSize({width,height:900});const fits=await test.evaluate(b=>{const r=b.getBoundingClientRect(),p=b.closest('.preview-heading').getBoundingClientRect();return r.x>=p.x&&r.right<=p.right&&r.right<=innerWidth;});assert.ok(fits,`current-position button fits at ${width}px`);}}
 assert.deepEqual(errors,[]);console.log(`PASS (${native?'Electron':'browser'}): selected dialogue/choice and other-scene start, latest edits, effects once, conditional branch continuation, fresh sessions, Ctrl/Cmd+Enter, selection/focus return, original test behavior, modal isolation and layout`);
}finally{if(app){await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();await rm(profile,{recursive:true,force:true});}await browser?.close();}
