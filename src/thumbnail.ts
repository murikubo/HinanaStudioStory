import type { Project, Session } from './model';
import { resolveCast, speaker } from './characters';
const cache=new Map<string,Promise<HTMLImageElement>>();
function load(url:string){let result=cache.get(url);if(!result){result=new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url;});cache.set(url,result);if(cache.size>40)cache.delete(cache.keys().next().value!);}return result;}
export async function thumbnail(p:Project,s:Session,ended=false):Promise<string>{
 const scene=p.scenes.find(v=>v.id===s.sceneId)!,line=scene.lines[s.index],canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const c=canvas.getContext('2d')!;
 c.fillStyle='#262030';c.fillRect(0,0,320,180);
 try{const image=await load(p.assets.find(a=>a.id===scene.background)?.url??'./classroom.svg'),scale=Math.max(320/image.width,180/image.height);c.drawImage(image,(320-image.width*scale)/2,(180-image.height*scale)/2,image.width*scale,image.height*scale);}catch{}
 for(const actor of resolveCast(p,scene,line)){try{const image=await load(actor.url),height=180*actor.scale/100,scale=Math.min(height/image.height,272/image.width),width=image.width*scale,h=image.height*scale,x=320*actor.x/100;c.save();c.globalAlpha=actor.dim?.55:1;c.drawImage(image,x-width/2,180*actor.y/100-h,width,h);c.restore();}catch{}}
 c.fillStyle='#181320dd';c.fillRect(13,126,294,45);c.fillStyle='#d5bdec';c.font='bold 10px sans-serif';c.fillText(ended?'THE END':speaker(p,line).name||'내레이션',22,141,270);c.fillStyle='#f5effa';c.font='10px sans-serif';c.fillText(ended?p.title:line.text.replace(/\s+/g,' '),22,158,270);
 return canvas.toDataURL('image/jpeg',.65);
}
