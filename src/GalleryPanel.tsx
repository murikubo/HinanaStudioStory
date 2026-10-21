import {useState} from 'react';
import {Lock} from 'lucide-react';
import type {GalleryEntry,Project} from './model';
export default function GalleryPanel({project,unlocked,showEnding}:{project:Project;unlocked:string[];showEnding:(entry:GalleryEntry)=>void}){
 const [tab,setTab]=useState<'cg'|'ending'>('cg'),[selected,setSelected]=useState<GalleryEntry|null>(null);
 if(selected){const scene=project.scenes.find(s=>s.id===selected.sceneId),url=project.assets.find(a=>a.id===(selected.assetId||scene?.background))?.url??'./classroom.svg';return <div className="gallery-detail"><button onClick={()=>setSelected(null)}>감상실 목록으로</button><h3>{selected.title}</h3><img src={url} alt={selected.title}/>{selected.kind==='ending'&&<button onClick={()=>showEnding(selected)}>엔딩 크레딧 보기</button>}</div>;}
 const entries=(project.gallery??[]).filter(e=>e.kind===tab);
 return <><div className="desk-actions"><button aria-pressed={tab==='cg'} onClick={()=>setTab('cg')}>CG 감상</button><button aria-pressed={tab==='ending'} onClick={()=>setTab('ending')}>엔딩 회상</button></div><p className="control-help">{unlocked.filter(id=>project.gallery?.some(e=>e.id===id&&e.kind===tab)).length} / {entries.length} 해금</p><div className="gallery-grid">{entries.map(entry=>{const open=unlocked.includes(entry.id),scene=project.scenes.find(s=>s.id===entry.sceneId),url=project.assets.find(a=>a.id===(entry.assetId||scene?.background))?.url??'./classroom.svg';return <button key={entry.id} disabled={!open} className={open?'unlocked':'locked'} onClick={()=>setSelected(entry)}>{open?<img src={url} alt=""/>:<span className="gallery-lock"><Lock size={24}/></span>}<strong>{open?entry.title:'아직 발견하지 못한 장면'}</strong></button>;})}</div>{!entries.length&&<p className="control-help">등록된 항목이 없습니다.</p>}</>;
}
