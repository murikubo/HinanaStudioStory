import type {Project,Session} from './model';
export function unlockGallery(p:Project,session:Session,ended:boolean,current:string[]):string[]{
 const line=p.scenes.find(s=>s.id===session.sceneId)?.lines[session.index];if(!line)return current;
 const eligible=(p.gallery??[]).filter(e=>e.sceneId===session.sceneId&&(e.kind==='ending'?ended:!ended&&(!e.lineId||e.lineId===line.id))).map(e=>e.id);
 return [...new Set([...current,...eligible])].filter(id=>p.gallery?.some(e=>e.id===id));
}
