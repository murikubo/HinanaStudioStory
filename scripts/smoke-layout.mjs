import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { demo, uid } from '../src/model.ts';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({viewport:{width:1500,height:980}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const project=demo();
  project.variables=Array.from({length:24},(_,i)=>({id:uid(),name:`테스트 변수 ${i+1}`,initial:i}));
  const first=project.scenes[0],choice=first.lines[2];
  first.lines[0].speaker='내레이션';
  first.lines[0].text='창 크기가 바뀌어도 이름표와 대사가 보입니다.';
  choice.text='이야기를 입력해 보세요.';
  choice.choices=Array.from({length:24},(_,i)=>({id:uid(),text:`선택 ${i+1} · ${'긴 선택지 내용 '.repeat(8)}`,target:project.scenes[1].id}));
  await page.addInitScript(() => localStorage.setItem('hinana:player:settings:v1', JSON.stringify({ speed: 0 })));
  await page.goto('http://127.0.0.1:5173');
  await page.evaluate(p=>localStorage.setItem('hinana-story-v1',JSON.stringify(p)),project);
  await page.reload();
  assert.equal(await page.title(),'Hinana Studio Story');
  await page.getByRole('button',{name:'플레이 테스트',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'플레이 테스트'});
  async function verify() {
    const result=await modal.evaluate(modal=>{
      const stage=modal.querySelector('.stage'),speaker=stage.querySelector('.speaker');
      const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
      const s=rect(speaker),r=rect(stage),h=rect(modal.querySelector('.play-hint')),c=rect(modal.querySelector('.play-top'));
      return {s,r,h,c,w:innerWidth,height:innerHeight,hit:document.elementFromPoint(s.x+s.width/2,s.y+2)?.closest('.speaker')===speaker};
    });
    assert.ok(result.hit,'nameplate top must be painted, not clipped');
    assert.ok(result.s.y>=result.r.y && result.s.bottom<=result.r.bottom,'nameplate inside stage');
    assert.ok(result.r.x>=0 && result.r.right<=result.w && result.r.y>=0 && result.r.bottom<=result.height,'entire stage inside window');
    assert.ok(Math.abs(result.r.width/result.r.height-16/9)<0.02,'16:9 stage preserved');
    assert.ok(result.c.y>=0 && result.h.bottom<=result.height,'header and hint visible');
  }
  for(const size of [{width:1500,height:980},{width:1100,height:650},{width:760,height:540}]) {
    await page.setViewportSize(size);await verify();
  }
  await modal.getByRole('button',{name:'다음',exact:true}).click();
  await modal.getByRole('button',{name:'다음',exact:true}).click();
  for(const size of [{width:1500,height:980},{width:1100,height:650},{width:760,height:540}]) {
    await page.setViewportSize(size);await verify();
    const last=modal.locator('.play-choices button').last();
    await last.scrollIntoViewIfNeeded();
    assert.equal(await last.evaluate(el=>{const r=el.getBoundingClientRect(),v=el.closest('.dialogue-content').getBoundingClientRect();return r.top>=v.top-1&&r.bottom<=v.bottom+1}),true,'last choice can be scrolled fully into view');
    await verify();
  }
  await page.setViewportSize({width:1100,height:650});
  await modal.locator('.dialogue-content').evaluate(el=>el.scrollTop=0);
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/play-layout.png'});
  await modal.locator('.play-choices button').last().click();
  await modal.getByText('좋아. 그럼 내일, 같은 시간에 여기서 만나!',{exact:true}).waitFor();
  await page.keyboard.press('Escape');
  // Very long dialogue must also scroll to its next control without hiding the speaker.
  first.lines[0].text='긴 대사 테스트입니다. '.repeat(500);
  await page.evaluate(p=>localStorage.setItem('hinana-story-v1',JSON.stringify(p)),project);await page.reload();
  await page.getByRole('button',{name:'플레이 테스트',exact:true}).click();await verify();
  await modal.getByRole('button',{name:'다음',exact:true}).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'정보',exact:true}).click();
  await page.getByRole('dialog',{name:'HINANA STUDIO STORY'}).getByText('Hinana Studio Story',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: nameplate paint visibility, 16:9 stage fits window, headers/controls fit at 3 window sizes, 24 wrapped choices scroll and branch, long dialogue scrolls and advances, renamed title/about');
} finally {await browser.close()}
