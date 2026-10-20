import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { parseProject } from '../../src/model.ts';
import { inspectFlow } from '../../src/flow.ts';
import exporter from '../../electron/exporter.cjs';
import assert from 'node:assert/strict';
const root=path.dirname(fileURLToPath(import.meta.url)),raw=await readFile(path.join(root,'마지막 방송이 끝나기 전에.hinanastory'),'utf8'),project=parseProject(raw);
assert.deepEqual(inspectFlow(project),[]);
await mkdir(path.join(root,'preview'),{recursive:true});await exporter.writeGame(path.resolve('dist'),path.join(root,'preview'),raw);
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),f=path.resolve(root,'preview','.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!f.startsWith(path.join(root,'preview')+path.sep))throw Error();const data=await readFile(f);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[path.extname(f)]??'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end('Not found')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true});
const reports=[];
try{
 // All five valid routes, including choosing the ordinary ending when both are available.
 for(const [first,second,ending] of [[0,0,0],[0,0,1],[0,1,0],[1,0,0],[1,1,0]]){
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('hinana:player:settings:v1',JSON.stringify({speed:0,music:.3,sound:.3})));
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'처음부터 시작'}).click();
  let steps=0,decision=0;const selections=[first,second,ending];
  while(steps++<100){
   if(await page.getByText('THE END',{exact:true}).count())break;
   const choices=page.locator('.play-choices button');
   if(await choices.count()){await choices.nth(selections[decision++]).click();continue;}
   const advance=page.locator('.next-dialogue');await advance.waitFor();
   if(first===0&&second===0&&ending===0&&steps===6){await page.waitForTimeout(950);const retry=page.getByRole('button',{name:'음악 재생 · 다시 시도'});if(await retry.count())await retry.click();await page.waitForFunction(()=>{const audio=document.querySelector('audio');return audio && !audio.paused && audio.currentTime>0});await page.screenshot({path:path.join(root,'sample-play.png')});
    const alpha=await page.evaluate(async url=>{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return [ctx.getImageData(0,0,1,1).data[3],ctx.getImageData(image.width-1,0,1,1).data[3]];},project.assets.find(a=>a.id==='seoyun-neutral').url);assert.deepEqual(alpha,[0,0],'character corners must be alpha-transparent');
   }
   await advance.click();
  }
  assert.ok(steps<100,'route terminates');assert.equal(decision,3);const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('hinana:play:game:last-broadcast-original-v1')).slots.auto);assert.ok(saved.ended);reports.push({first,second,ending,scene:saved.session.sceneId,courage:saved.session.variables.courage,steps});assert.deepEqual(errors,[]);await page.close();
 }
 assert.ok(reports.some(r=>r.scene==='tomorrow'));assert.ok(reports.some(r=>r.scene==='archive'));
 await writeFile(path.join(root,'verification.json'),JSON.stringify({passed:true,routes:reports,issues:inspectFlow(project)},null,2));
 console.log('PASS: all 5 valid routes, both endings, variable gates, transparent sprites, embedded assets, exported player; screenshots and verification saved beside project.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
