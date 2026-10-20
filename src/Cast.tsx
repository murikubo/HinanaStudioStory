import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveCast, type ActorView } from './characters';
import type { ActorPoint } from './characters';
import type { Line, Project, Scene } from './model';
export default function Cast({project,scene,line,animated=false,editing=false,selected,onGrab,draft}:{project:Project;scene:Scene;line:Line;animated?:boolean;editing?:boolean;selected?:string;onGrab?:(e:React.PointerEvent<HTMLImageElement>,actor:ActorView)=>void;draft?:{key:string;point:ActorPoint}}){
  const actors=useMemo(()=>resolveCast(project,scene,line),[project,scene,line]);
  const previous=useRef(actors),[outgoing,setOutgoing]=useState<ActorView[]>([]);
  const motion=animated?(scene.characterMotion??'fade'):'none',duration=scene.duration??500;
  useEffect(()=>{const leaving=previous.current.filter(old=>!actors.some(a=>a.key===old.key&&a.assetId===old.assetId&&a.url===old.url));previous.current=actors;setOutgoing(motion==='none'?[]:leaving);const t=setTimeout(()=>setOutgoing([]),duration);return()=>clearTimeout(t);},[actors,motion,duration]);
  const portrait=(a:ActorView,exit=false)=><img key={`${a.key}:${a.assetId}:${exit?'exit':'active'}`} draggable={false} onPointerDown={e=>{if(!exit)onGrab?.(e,a);}} data-actor-key={a.key} data-character-id={a.characterId} data-layer={a.layer} className={`character character-${a.position} ${exit?'portrait-exit':'portrait-enter'} motion-${motion} ${a.dim?'actor-dim':'actor-active'} ${editing?'editable-actor':''} ${selected===a.key?'placement-selected':''}`} src={a.url} style={{height:`${a.scale}%`,zIndex:a.layer,left:`${draft?.key===a.key?draft.point.x:a.x}%`,bottom:`${100-(draft?.key===a.key?draft.point.y:a.y)}%`}} alt={exit?'':a.name}/>;
  return <div className={`cast-layer ${editing?'cast-editing':''}`} style={{'--transition-time':`${duration}ms`} as React.CSSProperties}>{outgoing.map(a=>portrait(a,true))}{actors.map(a=>portrait(a))}</div>;
}
