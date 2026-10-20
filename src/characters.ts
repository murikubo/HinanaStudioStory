import type { Character, Line, Project, Scene, Placement } from './model';
export type ActorView = { key: string; characterId: string; assetId: string; url: string; position: string; scale: number; layer: number; x: number; y: number; dim: boolean; name: string };
export function speaker(p: Project, line: Line) {
  const character=(p.characters??[]).find(c=>c.id===line.speakerId)??(p.characters??[]).find(c=>c.name===line.speaker);
  return {name:character?.name??line.speaker,color:character?.color??'#bda6d7',characterId:character?.id??''};
}
export function resolveCast(p: Project, scene: Scene, line: Line): ActorView[] {
  const placements=line.cast??scene.cast;
  if(placements===undefined){
    const id=line.character||scene.character,asset=p.assets.find(a=>a.id===id&&a.type!=='audio');
    return asset?[{key:'legacy',characterId:'',assetId:id,url:asset.url,position:line.position??scene.position??'center',scale:scene.characterScale??90,layer:0,x:line.characterX??(line.position?presetX(line.position):scene.characterX??presetX(scene.position??'center')),y:line.characterY??(line.position?100:scene.characterY??100),dim:false,name:'장면 캐릭터'}]:[];
  }
  const active=speaker(p,line).characterId;
  const visible=placements.filter(v=>v.visible!==false),hasSpeaker=Boolean(active&&visible.some(v=>v.characterId===active));
  return visible.flatMap(v=>{
    const c=p.characters?.find(c=>c.id===v.characterId),expression=c?.expressions.find(e=>e.id===(v.expressionId||c.defaultExpression))??c?.expressions[0];
    const asset=p.assets.find(a=>a.id===expression?.assetId&&a.type!=='audio');
    return c&&asset?[{key:c.id,characterId:c.id,assetId:asset.id,url:asset.url,position:v.position,scale:v.scale,layer:v.layer,x:v.x??presetX(v.position),y:v.y??100,dim:hasSpeaker&&active!==c.id,name:c.name}]:[];
  }).sort((a,b)=>a.layer-b.layer);
}
export function placement(character: Character,index=0): Placement {return {characterId:character.id,expressionId:character.defaultExpression??character.expressions[0]?.id??'',position:index===0?'left':index===1?'right':'center',scale:90,layer:index,visible:true};}
export function deleteCharacter(p: Project,id:string): Project {
  return {...p,characters:p.characters?.filter(c=>c.id!==id),scenes:p.scenes.map(s=>({...s,cast:s.cast?.filter(v=>v.characterId!==id),lines:s.lines.map(l=>({...l,speaker:l.speakerId===id?speaker(p,l).name:l.speaker,speakerId:l.speakerId===id?'':l.speakerId,cast:l.cast?.filter(v=>v.characterId!==id)}))}))};
}
export function deleteExpression(p: Project,characterId:string,expressionId:string): Project {
  const c=p.characters?.find(c=>c.id===characterId);if(!c)return p;
  const remaining=c.expressions.filter(e=>e.id!==expressionId),fallback=remaining[0]?.id??'';
  const fix=(cast:Placement[]|undefined)=>cast?.map(v=>v.characterId===characterId&&v.expressionId===expressionId?{...v,expressionId:fallback}:v);
  return {...p,characters:p.characters?.map(v=>v.id===characterId?{...v,expressions:remaining,defaultExpression:v.defaultExpression===expressionId?fallback:v.defaultExpression}:v),scenes:p.scenes.map(s=>({...s,cast:fix(s.cast),lines:s.lines.map(l=>({...l,cast:fix(l.cast)}))}))};
}

export function presetX(position: string) { return position==='left'?23:position==='right'?77:50; }
export type ActorPoint = {x:number;y:number};
export function moveActor(p:Project,sceneId:string,lineId:string,scope:'scene'|'line',key:string,point:ActorPoint|null):Project {
 const scene=p.scenes.find(s=>s.id===sceneId),line=scene?.lines.find(l=>l.id===lineId);if(!scene||!line)return p;
 const source=scope==='scene'?scene.cast:line.cast??scene.cast;
 const cast=source?.map(v=>v.characterId===key?{...v,x:point?.x,y:point?.y}:v);
 if(key!=='legacy'&&!source?.some(v=>v.characterId===key))return p;
 const patch=key==='legacy'?{characterX:point?.x,characterY:point?.y}:{cast};
 return {...p,scenes:p.scenes.map(s=>s.id!==sceneId?s:scope==='scene'?{...s,...patch}:{...s,lines:s.lines.map(l=>l.id===lineId?{...l,...patch}:l)})};
}
