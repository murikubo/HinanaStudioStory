import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Maximize2, Move, RotateCcw } from 'lucide-react';
import Cast from './Cast';
import { resolveCast, speaker, type ActorPoint, type ActorView } from './characters';
import type { Line, Project, Scene } from './model';
import './placement.css';
export default function EditorPreview({project,scene,line,beginCurrent,move}:{project:Project;scene:Scene;line:Line;beginCurrent:()=>void;move:(scope:'scene'|'line',key:string,point:ActorPoint|null)=>void}){
 const [editing,setEditing]=useState(false),[scope,setScope]=useState<'scene'|'line'>('line'),[selected,setSelected]=useState('');
 const [draft,setDraft]=useState<{key:string;point:ActorPoint}|undefined>();
 const stage=useRef<HTMLDivElement>(null),drag=useRef<{pointer:number;key:string;start:ActorPoint;screen:ActorPoint;point:ActorPoint;width:number;height:number}|null>(null);
 const presentedLine=useMemo(()=>editing&&scope==='scene'?{...line,cast:undefined,character:undefined,position:undefined,characterX:undefined,characterY:undefined}:line,[line,editing,scope]);
 const actors=useMemo(()=>resolveCast(project,scene,presentedLine),[project,scene,presentedLine]);
 const actor=actors.find(a=>a.key===selected)??actors.at(-1),point=draft&&draft.key===actor?.key?draft.point:actor;
 const background=project.assets.find(a=>a.id===scene.background)?.url??'./classroom.svg';
 function cancel(){const current=drag.current;drag.current=null;setDraft(undefined);if(current&&stage.current?.hasPointerCapture(current.pointer))stage.current.releasePointerCapture(current.pointer);}
 useEffect(()=>{cancel();},[scene.id,line.id,scope,editing]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(drag.current&&(e.key==='Escape'||(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z')){e.preventDefault();e.stopPropagation();cancel();}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[]);
 function grab(e:React.PointerEvent<HTMLImageElement>,a:ActorView){
  if(!editing||e.button!==0)return;e.preventDefault();e.stopPropagation();setSelected(a.key);
  const rect=stage.current!.getBoundingClientRect();
  drag.current={pointer:e.pointerId,key:a.key,start:{x:a.x,y:a.y},screen:{x:e.clientX,y:e.clientY},point:{x:a.x,y:a.y},width:rect.width,height:rect.height};
  stage.current!.setPointerCapture(e.pointerId);
 }
 const clamp=(v:number)=>Math.round(Math.max(0,Math.min(100,v))*10)/10;
 function finish(e:React.PointerEvent){const current=drag.current;if(!current||e.pointerId!==current.pointer)return;drag.current=null;setDraft(undefined);if(stage.current?.hasPointerCapture(e.pointerId))stage.current.releasePointerCapture(e.pointerId);if(current.point.x!==current.start.x||current.point.y!==current.start.y)move(scope,current.key,current.point);}
 return <>
  <div className="placement-toolbar"><button className={editing?'active':''} aria-pressed={editing} onClick={()=>setEditing(v=>!v)}><Move size={13}/>캐릭터 수동 배치</button>{editing&&<select aria-label="위치 적용 범위" value={scope} onChange={e=>setScope(e.target.value as typeof scope)}><option value="line">현재 블록만</option><option value="scene">장면 기본 배치</option></select>}{!editing&&<span>드래그로 위치를 조절할 수 있습니다.</span>}</div>
  {editing&&<div className="placement-controls">{actor&&point?<><select aria-label="배치할 캐릭터" value={actor.key} onChange={e=>setSelected(e.target.value)}>{actors.map(a=><option key={a.key} value={a.key}>{a.name}</option>)}</select>{(['x','y'] as const).map(axis=><label key={axis}>{axis.toUpperCase()} (%)<input aria-label={`캐릭터 ${axis.toUpperCase()} 좌표`} type="number" min="0" max="100" step="0.1" value={point[axis]} onChange={e=>{if(e.target.value==='')return;move(scope,actor.key,{x:actor.x,y:actor.y,[axis]:clamp(Number(e.target.value)||0)});}}/></label>)}<button title="선택한 캐릭터 기본 위치로" aria-label="선택한 캐릭터 기본 위치로" onClick={()=>move(scope,actor.key,null)}><RotateCcw size={13}/></button></>:<span>캐릭터 이미지나 등록 캐릭터 배치를 먼저 지정해 주세요.</span>}</div>}
  <div ref={stage} className={`stage editor-stage ${editing?'placement-mode':''}`} style={{backgroundImage:`url("${background}")`}} onPointerMove={e=>{const current=drag.current;if(!current||current.pointer!==e.pointerId)return;current.point={x:clamp(current.start.x+(e.clientX-current.screen.x)/current.width*100),y:clamp(current.start.y+(e.clientY-current.screen.y)/current.height*100)};setDraft({key:current.key,point:current.point});}} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={()=>{if(drag.current)cancel();}}>
   <div className="stage-vignette"/><Cast project={project} scene={scene} line={presentedLine} editing={editing} selected={editing?actor?.key:undefined} draft={draft} onGrab={grab}/>
   <span className="stage-badge"><span/>{editing?'드래그하여 위치 조절 · Esc 취소':'LIVE PREVIEW'}</span><button className="stage-expand icon" title="크게 미리보기" onClick={beginCurrent}><Maximize2 size={15}/></button>
   <div className="dialogue-box"><span className="speaker" style={{background:speaker(project,line).color}}>{speaker(project,line).name||(line.type==='choice'?'선택':'내레이션')}</span><div className="dialogue-content"><p>{line.text||'이야기를 입력해 보세요.'}</p>{line.type==='choice'&&<div className="play-choices">{line.choices.map(c=><button key={c.id} tabIndex={-1}>{c.text||'선택지'}<ChevronRight size={14}/></button>)}{!line.choices.length&&<small>선택지를 추가해 주세요.</small>}</div>}<span className="dialogue-caret">◆</span></div></div>
  </div>{editing&&<p className="placement-help">좌표는 캐릭터 하단 중앙 기준입니다. X는 왼쪽부터, Y는 위쪽부터의 비율입니다. 드래그 한 번은 실행 취소 한 단계로 기록됩니다.</p>}
 </>;
}
