import test from 'node:test';import assert from 'node:assert/strict';
import {demo,newLine,newProject,parseProject,reconcileGallery,transferBlocks} from '../src/model.ts';
import {searchScript,replaceScript,exportScript,importScriptRows,appendScript,updateScript,parseCsv} from '../src/script-tools.ts';
import {debugJump} from '../src/debug.ts';import {unlockGallery} from '../src/gallery.ts';import {assetUsage,removeUnused} from '../src/asset-tools.ts';
import {readData,parseSaves,serializeSaves,signature,playKey,readSettings} from '../src/player-store.ts';
test('literal cross-scene search and replacement preserve logic, IDs, literal replacement strings, and undo input',()=>{
 const p=demo(),l=p.scenes[0].lines[0];l.text='Hello [a]. hello [a].';p.scenes[1].lines[0].text='HELLO';const original=structuredClone(p);
 const options={query:'hello',caseSensitive:false,field:'text' as const};assert.equal(searchScript(p,options).reduce((n,h)=>n+h.count,0),3);
 const next=replaceScript(p,options,'$&');assert.equal(next.scenes[0].lines[0].text,'$& [a]. $& [a].');assert.deepEqual(p,original);assert.deepEqual(next.scenes[0].lines[2].choices,p.scenes[0].lines[2].choices);
 assert.equal(searchScript(p,{...options,query:'[a].'}).length,1);assert.equal(searchScript(p,{...options,caseSensitive:true}).length,1);
 const hits=searchScript(p,options);const one=replaceScript(p,options,'교정',hits[1]);assert.equal(one.scenes[0].lines[0].text,l.text);assert.equal(one.scenes[1].lines[0].text,'교정');
});
test('CSV handles multiline, quotes, commas, formula-like text and preserves connections when appended',()=>{
 const p=demo();p.scenes[0].lines[0].text='=SUM(A1)\n"다시", 만나요';p.scenes[1].next=p.scenes[2].id;p.scenes[1].title="'장면";p.scenes[0].lines[1].speaker='@화자';
 const csv=exportScript(p,'csv'),rows=importScriptRows(csv,'csv');assert.ok(csv.includes("'=SUM"));assert.equal(rows[0].text,p.scenes[0].lines[0].text);assert.equal(rows[1].speaker,'@화자');
 const base=newProject('가져오기'),next=appendScript(base,rows);assert.equal(next.scenes.length,4);assert.equal(next.scenes[2].next,next.scenes[3].id);assert.equal(next.scenes[1].lines[2].choices[0].target,next.scenes[2].id);assert.notEqual(next.scenes[1].id,p.scenes[0].id);assert.doesNotThrow(()=>parseProject(JSON.stringify(next)));
 assert.deepEqual(parseCsv('a,b\r\n"x\r\ny","say ""hi"""'),[['a','b'],['x\r\ny','say "hi"']]);
 for(const bad of ['text\n"not closed','text\n"ok"oops','text,speaker\na,b,c'])assert.throws(()=>importScriptRows(bad,'csv'));
});
test('CSV ID correction changes text without destroying effects, audio, cast or targets; invalid imports are atomic',()=>{
 const p=demo();p.scenes[0].lines[0].effects=[{variableId:'n',operation:'add',value:3}];p.variables=[{id:'n',name:'n',initial:0}];const rows=importScriptRows(exportScript(p,'csv'),'csv');rows[0].text='교정 문장';rows[2].choice='교정 선택';const result=updateScript(p,rows);
 assert.equal(result.scenes[0].lines[0].text,'교정 문장');assert.deepEqual(result.scenes[0].lines[0].effects,p.scenes[0].lines[0].effects);assert.equal(result.scenes[0].lines[2].choices[0].target,p.scenes[0].lines[2].choices[0].target);assert.equal(result.scenes[0].lines[2].choices[0].text,'교정 선택');
 rows[0].block_id='missing';assert.throws(()=>updateScript(p,rows));assert.notEqual(p.scenes[0].lines[0].text,'교정 문장');
 const txt=importScriptRows('# 장면\n하루: 안녕\n풍경이 펼쳐진다\n# 장면\n유나: 다시 안녕','txt');assert.equal(txt.length,3);assert.equal(appendScript(newProject('txt'),txt).scenes.length,3);
});
test('voice and gallery schema remains backward compatible, tracks audio/image references, and cleans moved/deleted unlock triggers',()=>{
 const p=newProject('voice');p.assets=[{id:'voice',name:'voice',type:'audio',url:'data:audio/wav;base64,YQ=='},{id:'cg',name:'cg',type:'background',url:'data:image/png;base64,YQ=='}];const s=p.scenes[0],l=s.lines[0];l.voice='voice';l.voiceVolume=.6;l.voiceAdvance=true;p.gallery=[{id:'cg-entry',kind:'cg',title:'CG',sceneId:s.id,lineId:l.id,assetId:'cg'},{id:'end-entry',kind:'ending',title:'끝',sceneId:s.id}];assert.deepEqual(parseProject(JSON.stringify(p)),p);assert.ok(assetUsage(p).has('voice'));assert.equal(removeUnused(p).assets.length,2);
 const session={sceneId:s.id,index:0,variables:{}};assert.deepEqual(unlockGallery(p,session,false,[]),['cg-entry']);assert.deepEqual(unlockGallery(p,session,true,['cg-entry']),['cg-entry','end-entry']);assert.deepEqual(unlockGallery(p,session,false,['cg-entry']),['cg-entry']);
 const other=demo().scenes[1];p.scenes.push(other);const moved=reconcileGallery(transferBlocks(p,s.id,[l.id],other.id,false));assert.equal(moved.gallery![0].sceneId,other.id);assert.equal(moved.gallery![0].lineId,l.id);moved.scenes[1].lines=moved.scenes[1].lines.filter(v=>v.id!==l.id);assert.equal(reconcileGallery(moved).gallery!.length,1);
 l.voiceVolume=2;assert.throws(()=>parseProject(JSON.stringify(p)));l.voiceVolume=.6;l.voice='missing';assert.throws(()=>parseProject(JSON.stringify(p)));
});
test('gallery progress survives content edits, transfers in save files, and stays separate from test play',()=>{
 const p=demo();p.gallery=[{id:'end',title:'엔딩',kind:'ending',sceneId:p.scenes[1].id}];const data={signature:signature(p),slots:{},read:[],unlocked:['end']};assert.deepEqual(parseSaves(p,serializeSaves(p,data)).unlocked,['end']);
 const storage={getItem:(key:string)=>key===playKey(p)?JSON.stringify(data):null};p.scenes[0].lines[0].text+='수정';assert.deepEqual(readData(storage,p).unlocked,['end']);assert.equal(readData(storage,p,true).unlocked,undefined);assert.equal(readSettings({getItem:()=>JSON.stringify({voice:10,voiceDucking:false})}).voice,1);
});
test('debugger jumps retain variables and only apply entry effects when explicitly requested',()=>{
 const p=demo();p.variables=[{id:'n',name:'n',initial:0}];p.scenes[1].lines[0].effects=[{variableId:'n',operation:'add',value:3}];const state={sceneId:p.scenes[0].id,index:0,variables:{n:7}};
 assert.equal(debugJump(p,state,p.scenes[1].id,0,false).variables.n,7);assert.equal(debugJump(p,state,p.scenes[1].id,0,true).variables.n,10);assert.equal(state.variables.n,7);assert.throws(()=>debugJump(p,state,'missing',0,false));
});
