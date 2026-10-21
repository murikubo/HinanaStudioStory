const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const MAX=80*1024*1024;
function projectBackups({directory,now=()=>new Date()}){
 const root=path.join(directory,'project-backups');let queue=Promise.resolve();
 const group=key=>{if(typeof key!=='string'||!key||key.length>500)throw Error('백업 프로젝트 ID가 올바르지 않습니다.');return path.join(root,createHash('sha256').update(key).digest('hex'));};
 const run=fn=>{const next=queue.then(fn,fn);queue=next.catch(()=>{});return next;};
 async function records(dir){try{const value=JSON.parse(await fs.readFile(path.join(dir,'index.json'),'utf8'));return Array.isArray(value)?value.filter(v=>v&&/^[0-9T.Z-]+-[a-f0-9-]+\.hinanastory$/.test(v.id)&&typeof v.createdAt==='string'&&typeof v.hash==='string'&&typeof v.title==='string').slice(0,30):[];}catch(e){if(e.code==='ENOENT')return [];throw Error('백업 목록을 읽지 못했습니다.');}}
 async function writeIndex(dir,entries){const temp=path.join(dir,`.${randomUUID()}.tmp`);try{await fs.writeFile(temp,JSON.stringify(entries),'utf8');await fs.rename(temp,path.join(dir,'index.json'));}catch(e){await fs.rm(temp,{force:true});throw e;}}
 return {
  create:(raw,reason='manual')=>run(async()=>{
   if(typeof raw!=='string'||Buffer.byteLength(raw)>MAX)throw Error('백업은 80MB 이하여야 합니다.');
   const p=JSON.parse(raw),key=p?.id??p?.scenes?.[0]?.id;if(p?.version!==1||!Array.isArray(p.assets)||!Array.isArray(p.scenes)||!p.scenes.length||typeof p.title!=='string'||!['save','manual','autosave','before-save','before-restore'].includes(reason))throw Error('올바른 프로젝트 백업이 아닙니다.');
   if(p.assets.some(a=>!a||typeof a.url!=='string'||!a.url.startsWith('data:')))throw Error('백업에는 모든 에셋이 포함되어야 합니다.');
   raw=JSON.stringify(p);
   const dir=group(key);await fs.mkdir(dir,{recursive:true});const entries=await records(dir),hash=createHash('sha256').update(raw).digest('hex');
   if(entries[0]?.hash===hash)return entries[0];
   const createdAt=now().toISOString(),id=`${createdAt.replaceAll(':','-')}-${randomUUID()}.hinanastory`,item={id,createdAt,title:p.title,reason,bytes:Buffer.byteLength(raw),hash};
   const temp=path.join(dir,`.${randomUUID()}.tmp`);try{await fs.writeFile(temp,raw,'utf8');await fs.rename(temp,path.join(dir,id));await writeIndex(dir,[item,...entries].slice(0,30));}catch(e){await fs.rm(temp,{force:true});await fs.rm(path.join(dir,id),{force:true}).catch(()=>{});throw e;}
   for(const old of entries.slice(29))await fs.rm(path.join(dir,old.id),{force:true}).catch(()=>{});return item;
  }),
  list:key=>run(async()=>records(group(key))),
  read:(key,id)=>run(async()=>{const dir=group(key),entries=await records(dir);if(typeof id!=='string'||!entries.some(e=>e.id===id))throw Error('백업 목록에 없는 항목입니다.');const file=path.join(dir,id),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX)throw Error('백업 파일이 올바르지 않습니다.');const raw=await fs.readFile(file,'utf8');if(createHash('sha256').update(raw).digest('hex')!==entries.find(e=>e.id===id).hash)throw Error('백업 파일이 손상되었습니다.');return raw;})
 };
}
module.exports={projectBackups};
