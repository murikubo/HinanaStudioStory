import { uid, type Asset } from './model';
const mimeByExtension:Record<string,string>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',webm:'audio/webm'};
const allowed=new Set([...Object.values(mimeByExtension),'audio/mp3','audio/x-wav','audio/wave']);
export async function readAssetFiles(files:File[],remainingBytes:number):Promise<{assets:Asset[];errors:string[]}> {
 const assets:Asset[]=[],errors:string[]=[];let remaining=remainingBytes;
 for(const file of files){
  const mime=file.type&&file.type!=='application/octet-stream'?file.type:mimeByExtension[file.name.split('.').at(-1)?.toLowerCase()??''];
  if(!allowed.has(mime)){errors.push(`${file.name}: 지원하지 않는 형식`);continue;}
  const audio=mime.startsWith('audio/'),limit=(audio?20:8)*1024*1024;
  if(!file.size||file.size>limit){errors.push(`${file.name}: ${audio?20:8}MB 이하의 파일 필요`);continue;}
  if(Math.ceil(file.size/3)*4+file.name.length*6+200>remaining){errors.push(`${file.name}: 프로젝트 80MB 한도 초과`);continue;}
  try{
   const url=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(new Blob([file],{type:mime}));});
   const asset:Asset={id:uid(),name:file.name,type:audio?'audio':'background',url};
   const bytes=new Blob([JSON.stringify(asset)]).size+1;
   if(bytes>remaining){errors.push(`${file.name}: 프로젝트 80MB 한도 초과`);continue;}
   remaining-=bytes;assets.push(asset);
  }catch{errors.push(`${file.name}: 파일 읽기 실패`);}
 }
 return {assets,errors};
}
