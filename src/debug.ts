import {enter,type Project,type Session} from './model.ts';
export function debugJump(p:Project,session:Session,sceneId:string,index:number,applyEffects:boolean):Session{
 const line=p.scenes.find(s=>s.id===sceneId)?.lines[index];if(!line||!Number.isInteger(index))throw Error('이동할 블록이 없습니다.');
 return applyEffects?enter(p,sceneId,index,session.variables):{sceneId,index,variables:{...session.variables}};
}
