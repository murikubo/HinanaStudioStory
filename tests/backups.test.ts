import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,writeFile,rm,readdir,symlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import backupsModule from '../electron/project-backups.cjs';import filesModule from '../electron/project-files.cjs';
import {newProject} from '../src/model.ts';
test('dated native backups deduplicate formatting, keep 30 versions, reject traversal/tampering and remain self contained',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'hinana-backups-test-'));try{
 let time=0;const service=backupsModule.projectBackups({directory,now:()=>new Date(Date.UTC(2026,9,1)+time++*86400000)}),p=newProject('버전');p.assets=[{id:'a',name:'이미지',type:'background',url:'data:image/png;base64,YQ=='}];
 const first=await service.create(JSON.stringify(p),'manual');assert.equal((await service.create(JSON.stringify(p,null,2),'save')).id,first.id);assert.equal((await service.list(p.id)).length,1);
 for(let i=0;i<32;i++){p.title=`버전 ${i}`;await service.create(JSON.stringify(p),'autosave');}
 const entries=await service.list(p.id);assert.equal(entries.length,30);assert.equal(entries[0].title,'버전 31');assert.equal(JSON.parse(await service.read(p.id,entries[0].id)).assets[0].url,'data:image/png;base64,YQ==');
 await assert.rejects(()=>service.read(p.id,'../../other.hinanastory'));await assert.rejects(()=>service.read('another-project',entries[0].id));
 const group=(await readdir(path.join(directory,'project-backups')))[0],file=path.join(directory,'project-backups',group,entries[0].id);await writeFile(file,'tampered');await assert.rejects(()=>service.read(p.id,entries[0].id),/손상/);
 const second=path.join(directory,'project-backups',group,entries[1].id);await rm(second);await symlink(file,second);await assert.rejects(()=>service.read(p.id,entries[1].id),/올바르지/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('saving external projects backs up prior versions and assets without changing file semantics; canceled saves do nothing',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'hinana-file-backup-'));try{
 const file=path.join(dir,'story.hinanastory'),backups=backupsModule.projectBackups({directory:dir});let cancel=false;
 const dialog={showSaveDialog:async()=>cancel?{canceled:true}:{canceled:false,filePath:file}};
 const files=filesModule.projectFiles({directory:dir,dialog,window:()=>null,backups});await files.init();
 const p=newProject('원본');p.storage='external';p.assets=[{id:'a',name:'그림',type:'background',url:'data:image/png;base64,YQ=='}];await files.save(JSON.stringify(p));p.title='수정';await files.save(JSON.stringify(p));
 const versions=await backups.list(p.id);assert.equal(versions.length,2);assert.equal(versions[1].title,'원본');await rm(path.join(dir,'story.assets'),{recursive:true,force:true});const restored=JSON.parse(await backups.read(p.id,versions[1].id));assert.equal(restored.title,'원본');assert.equal(restored.assets[0].url,'data:image/png;base64,YQ==');
 cancel=true;assert.equal(await files.save(JSON.stringify(p),true),null);assert.equal((await backups.list(p.id)).length,2);
 const broken=filesModule.projectFiles({directory:path.join(dir,'broken'),dialog:{showSaveDialog:async()=>({canceled:false,filePath:path.join(dir,'fallback.hinanastory')})},window:()=>null,backups:{create:async()=>{throw Error('disk quota');}}});await broken.init();const result=await broken.save(JSON.stringify(p));assert.ok(result.backupWarning);assert.ok(await readFile(path.join(dir,'fallback.hinanastory'),'utf8'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('native script export preserves UTF-8 text exactly, handles cancellation and rejects unsupported formats',async()=>{
 const {scriptTransfer}=await import('../electron/script-transfer.cjs');const dir=await mkdtemp(path.join(tmpdir(),'hinana-script-export-'));try{
 let cancel=false;const service=scriptTransfer({dialog:{showSaveDialog:async()=>cancel?{canceled:true}:{canceled:false,filePath:path.join(dir,'dialogue')}},window:()=>null});
 const raw='\ufeffscene,text\r\n장면,"다시, 만나요\n새 줄"';assert.equal(await service.save(raw,'작품','csv'),true);assert.equal(await readFile(path.join(dir,'dialogue.csv'),'utf8'),raw);cancel=true;assert.equal(await service.save(raw,'작품','txt'),false);await assert.rejects(()=>service.save(raw,'작품','exe'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
