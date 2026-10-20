import { chromium, _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { newProject } from '../src/model.ts';
const native=process.argv.includes('--electron'),profile=native?await mkdtemp(path.join(tmpdir(),'hinana-credits-')):null;
const app=native?await electron.launch({...(process.env.ELECTRON_BINARY?{executablePath:process.env.ELECTRON_BINARY}:{}),args:[...(process.env.ELECTRON_BINARY?[]:['.']),`--user-data-dir=${profile}`]}):null;
const browser=native?null:await chromium.launch({headless:true});
const page=native?await app.firstWindow():await browser.newPage({viewport:{width:1500,height:980}});
page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
const p=newProject('별빛이 머무는 마지막 페이지');p.id='credits-regression';p.scenes[0].title='에필로그 · 다시 만날 날';p.scenes[0].lines[0].text='오늘의 이야기는 여기까지.';
p.metadata={author:'비나래',credits:'기획 · 비나래\n시나리오: Hinana\n그림：그림 작가\n'+Array.from({length:30},(_,i)=>`Special Thanks · 함께한 사람 ${i+1}`).join('\n'),endingMessage:'이 계절이 지나도, 우리의 이야기는 계속됩니다.',copyright:'© 2026 비나래',releaseVersion:'1.0.0'};
const sr=8000,n=sr*2,wav=Buffer.alloc(44+n*2);wav.write('RIFF');wav.writeUInt32LE(36+n*2,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sr,24);wav.writeUInt32LE(sr*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*220/sr)*300),44+i*2);
p.assets=[{id:'ending-music',name:'ending.wav',type:'audio',url:`data:audio/wav;base64,${wav.toString('base64')}`}];p.scenes[0].bgm='ending-music';p.scenes[0].loop=true;p.scenes[0].bgmFade=100;p.scenes[0].lines[0].sfx='ending-music';
const modal=page.getByRole('dialog',{name:'플레이 테스트',exact:true}),credits=page.getByRole('region',{name:'제작 크레딧'}),roll=page.getByLabel('크레딧 내용',{exact:true});
try{
 if(!native)await page.goto('http://127.0.0.1:5173');await page.locator('.scene-item').first().waitFor();
 await page.evaluate(()=>localStorage.setItem('hinana:player:settings:v1',JSON.stringify({speed:0})));
 await page.locator('input[type=file][accept=".hinanastory,.hinana,.json"]').setInputFiles({name:'credits.hinanastory',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 await page.getByRole('button',{name:'플레이 테스트',exact:true}).click();await page.waitForFunction(()=>{const a=document.querySelector('audio');return a&&!a.paused&&a.currentTime>0;});
 const before=await page.locator('audio').first().evaluate(a=>a.currentTime);
 await modal.getByRole('button',{name:'이야기 마치기'}).click();await expect(credits).toBeVisible();await expect(page.getByText('THE END',{exact:true})).toBeVisible();
 await expect(page.locator('.ending-chapter')).toContainText(p.scenes[0].title);await expect(page.locator('.ending-message')).toHaveText(p.metadata.endingMessage);
 await expect(credits.locator('.credit-person').first()).toHaveText('기획비나래');assert.equal(await credits.locator('.credit-person').count(),33);
 await page.waitForFunction(()=>{const a=[...document.querySelectorAll('audio')];return !a[0].paused&&a[1].paused;});
 assert.ok(await page.locator('audio').first().evaluate(a=>a.hasAttribute('src')));
 await page.waitForFunction(()=>document.querySelector('.credits-viewport').scrollTop>8);
 await page.getByRole('button',{name:'크레딧 일시정지',exact:true}).click();const paused=await roll.evaluate(e=>e.scrollTop);await page.waitForTimeout(250);assert.equal(await roll.evaluate(e=>e.scrollTop),paused);
 await page.getByRole('button',{name:'크레딧 처음부터',exact:true}).click();await expect.poll(()=>roll.evaluate(e=>e.scrollTop)).toBe(0);
 await page.getByRole('button',{name:'크레딧 끝으로',exact:true}).click();await expect(page.getByRole('progressbar',{name:'크레딧 진행률'})).toHaveAttribute('aria-valuenow','100');
 await expect(credits.getByLabel('Powered by Hinana Studio Story',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'엔딩 음악 음소거',exact:true}).click();assert.equal(await page.locator('audio').first().evaluate(a=>a.muted),true);await page.getByRole('button',{name:'엔딩 음악 음소거 해제',exact:true}).click();
 await page.getByRole('button',{name:'크레딧 처음부터',exact:true}).click();await page.getByRole('button',{name:'크레딧 일시정지',exact:true}).click();
 await roll.hover();await page.mouse.wheel(0,200);await expect(page.getByRole('button',{name:'크레딧 자동 재생',exact:true})).toBeVisible();
 // Small windows keep navigation outside the independently scrolling credits.
 if(!native){for(const viewport of [{width:1500,height:980},{width:800,height:520},{width:480,height:360}]){
  await page.setViewportSize(viewport);await credits.getByRole('img',{name:'제작자 로고'}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'제목 화면',exact:true})).toBeInViewport();await expect(page.getByRole('button',{name:'크레딧 끝으로',exact:true})).toBeInViewport();
  const bounds=await roll.boundingBox();assert.ok(bounds.height>20&&bounds.width>100);
  await page.screenshot({path:`test-results/credits-${viewport.width}.png`});
 }await page.setViewportSize({width:1500,height:980});}
 await page.getByRole('button',{name:'제목 화면',exact:true}).click();await page.waitForFunction(()=>document.querySelector('audio').paused&&!document.querySelector('audio').hasAttribute('src'));
 await modal.getByRole('button',{name:'이어하기',exact:true}).click();await expect(credits).toBeVisible();
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'작품 설정',exact:true}).click();
 const dataBefore=await page.evaluate(()=>localStorage.getItem('hinana:play:test:credits-regression'));
 await page.getByRole('button',{name:'엔딩 미리보기',exact:true}).click();await expect(credits).toBeVisible();await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>localStorage.getItem('hinana:play:test:credits-regression')),dataBefore);
 if(!native){await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'엔딩 미리보기',exact:true}).click();await expect(page.getByRole('button',{name:'크레딧 자동 재생',exact:true})).toBeVisible();await page.waitForTimeout(250);assert.equal(await roll.evaluate(e=>e.scrollTop),0);await page.keyboard.press('Escape');}
 assert.deepEqual(errors,[]);console.log(`PASS (${native?'Electron':'browser'}): dedicated ending, role credits, automatic roll/pause/replay/end, manual scroll, final-scene BGM/SFX/mute/title stop, saved ending restore, preview preserves saves, responsive layout and reduced motion`);
}finally{if(app){await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();await rm(profile,{recursive:true,force:true});}await browser?.close();}
