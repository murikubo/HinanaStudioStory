import type { Asset, Project } from './model';
export function assetUsage(p:Project): Map<string,number> {
  const counts=new Map<string,number>();
  const add=(id:string|undefined)=>{if(id)counts.set(id,(counts.get(id)??0)+1);};
  add(p.metadata?.titleBackground);add(p.metadata?.icon);add(p.metadata?.creatorLogo);
  for(const c of p.characters??[])for(const e of c.expressions)add(e.assetId);
  for(const s of p.scenes){add(s.background);add(s.character);add(s.bgm);for(const l of s.lines){add(l.character);add(l.sfx);}}
  return counts;
}
export function removeUnused(p:Project): Project {const used=assetUsage(p);return {...p,assets:p.assets.filter(a=>used.has(a.id))};}
export function assetBytes(a:Asset): number {const data=a.url.split(',')[1]??'';return Math.max(0,Math.floor(data.length*3/4)-(data.endsWith('==')?2:data.endsWith('=')?1:0));}
export function formatBytes(bytes:number){return bytes>=1024*1024?`${(bytes/1024/1024).toFixed(1)} MB`:`${Math.round(bytes/1024)} KB`;}
export async function compressImage(asset:Asset,maxEdge=1920,quality=.82):Promise<Asset>{
  if(asset.type==='audio')return asset;
  const img=new Image();img.src=asset.url;await img.decode();
  const ratio=Math.min(1,maxEdge/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
  const context=canvas.getContext('2d');if(!context)throw Error('이미지 압축을 초기화하지 못했습니다.');
  context.drawImage(img,0,0,canvas.width,canvas.height);
  const url=canvas.toDataURL('image/webp',quality),candidate={...asset,url,name:asset.name.replace(/\.(png|jpg|jpeg|webp)$/i,'.webp')};
  if(!url.startsWith('data:image/webp;'))throw Error('이 환경에서 WebP 압축을 지원하지 않습니다.');
  return assetBytes(candidate)<assetBytes(asset)?candidate:asset;
}
