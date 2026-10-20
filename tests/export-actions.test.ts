import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {exportActions}=createRequire(import.meta.url)('../electron/export-actions.cjs');
test('only completed native exports for this host can be launched; arbitrary paths and other targets fail',async()=>{
 const opened:string[]=[];const actions=exportActions({platform:'darwin',openPath:async(file:string)=>{opened.push(file);return '';}});
 await assert.rejects(actions.launch('/Applications/Terminal.app'),/내보낸 작품/);
 actions.remember({path:'/output/mac',target:'macos',appPath:'/output/mac/한글 이야기.app'});
 actions.remember({path:'/output/win',target:'windows',executable:'/output/win/game.exe'});
 actions.remember({path:'/output/web',target:'web'});
 await actions.launch('/output/mac');assert.deepEqual(opened,['/output/mac/한글 이야기.app']);await actions.reveal('/output/mac');assert.equal(opened.at(-1),'/output/mac');
 await assert.rejects(actions.launch('/output/win'),/현재 운영체제/);await assert.rejects(actions.launch('/output/web'),/현재 운영체제/);await assert.rejects(actions.reveal('/unknown'),/내보낸 작품/);
});
test('Windows launch uses generated executable and surfaces OS open errors',async()=>{
 const actions=exportActions({platform:'win32',openPath:async()=> '실행 파일이 없습니다.'});actions.remember({path:'C:/output',target:'windows',executable:'C:/output/game.exe'});await assert.rejects(actions.launch('C:/output'),/실행 파일이 없습니다/);await assert.rejects(actions.reveal('C:/output'),/폴더를 열지/);actions.remember({path:'C:/installer',target:'windows',executable:'C:/installer/setup.exe',launchable:false});await assert.rejects(actions.launch('C:/installer'),/바로 실행할 수 없는/);
});
