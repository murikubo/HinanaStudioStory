import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { newProject } from '../src/model.ts';
const {projectFiles}=createRequire(import.meta.url)('../electron/project-files.cjs');
test('file save remembers path, save-as detaches, legacy import migrates, recent paths persist safely',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'hinana-files-'));let calls=0,nextPath=path.join(dir,'story.hinanastory');
 const dialog={showSaveDialog:async()=>{calls++;return{canceled:false,filePath:nextPath}},showOpenDialog:async()=>({canceled:false,filePaths:[path.join(dir,'legacy.hinana')]})};
 const files=projectFiles({directory:dir,dialog,window:()=>null});
 try{
  await files.init();const p=newProject('원본'),raw=JSON.stringify(p);const a=await files.save(raw);assert.equal(a.path,nextPath);p.title='수정';await files.save(JSON.stringify(p));assert.equal(calls,1);assert.equal(JSON.parse(await readFile(nextPath,'utf8')).title,'수정');
  nextPath=path.join(dir,'copy');await files.save(raw,true);assert.equal(calls,2);assert.equal(files.state().path,path.join(dir,'copy.hinanastory'));
  await writeFile(path.join(dir,'legacy.hinana'),raw);const opened=await files.open();assert.equal(files.state().path,path.join(dir,'copy.hinanastory'),'unvalidated open must not change active save path');
  await files.activate(opened.path,p.title);nextPath=path.join(dir,'legacy.hinana');const migrated=await files.save(raw);assert.ok(migrated.path.endsWith('legacy.hinanastory'));assert.equal(await readFile(path.join(dir,'legacy.hinana'),'utf8'),raw);
  await assert.rejects(files.openRecent('/unknown/path'));await assert.rejects(files.activate('/unknown/path','bad'));
  const fresh=projectFiles({directory:dir,dialog,window:()=>null});await fresh.init();assert.ok(fresh.state().recent.length>=3);const recent=await fresh.openRecent(migrated.path);assert.equal(recent.content,raw);
  await fresh.activate(null,'new');nextPath=path.join(dir,'new.hinanastory');await fresh.save(raw);assert.equal(fresh.state().path,nextPath);
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('new-project save preserves source, suggests new title, rejects original path and cancels without switching',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'hinana-copy-'));let target=path.join(dir,'original.hinanastory'),cancel=false,options:any;
 const files=projectFiles({directory:dir,window:()=>null,dialog:{showSaveDialog:async(_w:any,o:any)=>{options=o;return {canceled:cancel,filePath:target};}}});
 try{
  const original=newProject('원본');await files.init();await files.save(JSON.stringify(original));
  const copy={...original,id:'independent-copy',title:'사본'};cancel=true;assert.equal(await files.save(JSON.stringify(copy),true,true),null);assert.equal(files.state().path,target);assert.equal(options.defaultPath,path.join(dir,'사본.hinanastory'));
  cancel=false;await assert.rejects(files.save(JSON.stringify(copy),true,true),/원본과 다른/);assert.deepEqual(JSON.parse(await readFile(target,'utf8')),original);
  target=path.join(dir,'copy.hinanastory');await files.save(JSON.stringify(copy),true,true);assert.equal(files.state().path,target);assert.deepEqual(JSON.parse(await readFile(target,'utf8')),copy);assert.deepEqual(JSON.parse(await readFile(path.join(dir,'original.hinanastory'),'utf8')),original);
 }finally{await rm(dir,{recursive:true,force:true});}
});
