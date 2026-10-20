const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const mimeToExt={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','audio/mpeg':'mp3','audio/mp3':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/wave':'wav','audio/ogg':'ogg','audio/webm':'webm'};
const extToMime={png:'image/png',jpg:'image/jpeg',webp:'image/webp',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',webm:'audio/webm'};
async function encodeProject(raw,file){
 const p=JSON.parse(raw);if(p.storage!=='external')return raw;
 if(!Array.isArray(p.assets))throw Error('에셋 목록이 올바르지 않습니다.');
 const folder=path.basename(file,path.extname(file))+'.assets',directory=path.join(path.dirname(file),folder);
 await fs.mkdir(directory,{recursive:true});
 if((await fs.lstat(directory)).isSymbolicLink())throw Error('외부 에셋 폴더는 심볼릭 링크일 수 없습니다.');
 const assets=[];
 for(const a of p.assets){
  const match=typeof a.url==='string'&&/^data:([^;,]+);base64,([a-zA-Z0-9+/=\r\n]+)$/.exec(a.url),ext=match&&mimeToExt[match[1]];
  if(!match||!ext)throw Error('외부 저장할 에셋 형식이 올바르지 않습니다.');
  const buffer=Buffer.from(match[2],'base64'),name=crypto.createHash('sha256').update(buffer).digest('hex').slice(0,24)+'.'+ext;
  const destination=path.join(directory,name);
  // Content-addressed files are immutable. Existing links are never followed.
  try{await fs.writeFile(destination,buffer,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;const stat=await fs.lstat(destination);if(stat.isSymbolicLink()||!stat.isFile())throw Error('에셋 경로가 올바르지 않습니다.');const old=await fs.readFile(destination);if(!old.equals(buffer))throw Error('기존 에셋 파일 내용이 일치하지 않습니다.');}
  assets.push({...a,url:`${folder}/${name}`});
 }
 return JSON.stringify({...p,assets});
}
async function decodeProject(raw,file){
 const p=JSON.parse(raw);if(p.storage!=='external')return raw;
 if(!Array.isArray(p.assets))throw Error('외부 에셋 목록이 올바르지 않습니다.');
 const parent=await fs.realpath(path.dirname(file)),assets=[];let total=0;
 for(const a of p.assets){
  if(typeof a.url!=='string')throw Error('외부 에셋 경로가 올바르지 않습니다.');
  if(a.url.startsWith('data:')){assets.push(a);total+=a.url.length;if(total>80*1024*1024)throw Error('프로젝트 에셋이 80MB 한도를 초과합니다.');continue;}
  const match=/^([^/\\:\x00]+\.assets)\/([0-9a-f]{24})\.(png|jpg|webp|mp3|wav|ogg|webm)$/.exec(a.url);
  if(!match)throw Error('프로젝트 폴더 밖의 에셋은 불러올 수 없습니다.');
  const candidate=path.join(parent,match[1],`${match[2]}.${match[3]}`);
  let resolved;try{resolved=await fs.realpath(candidate);}catch{throw Error(`외부 에셋을 찾지 못했습니다: ${a.name}. 프로젝트와 .assets 폴더를 함께 보관해 주세요.`);}
  const realDirectory=await fs.realpath(path.join(parent,match[1]));
  if(!realDirectory.startsWith(parent+path.sep)||!resolved.startsWith(realDirectory+path.sep))throw Error('외부 에셋 연결이 허용 범위를 벗어납니다.');
  const stat=await fs.stat(resolved);if(!stat.isFile()||stat.size>20*1024*1024)throw Error('외부 에셋 파일 크기가 올바르지 않습니다.');
  const buffer=await fs.readFile(resolved);total+=Math.ceil(buffer.length*4/3);
  if(total>80*1024*1024)throw Error('프로젝트 에셋이 80MB 한도를 초과합니다.');
  const mime=extToMime[match[3]];if((a.type==='audio')!==mime.startsWith('audio/'))throw Error('외부 에셋 종류가 일치하지 않습니다.');
  assets.push({...a,url:`data:${mime};base64,${buffer.toString('base64')}`});
 }
 return JSON.stringify({...p,assets});
}
module.exports={encodeProject,decodeProject};
