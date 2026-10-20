import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Home, Pause, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import type { Project, Scene } from './model';
import './ending.css';
import creatorLogo from './assets/creator-logo.png';

export default function EndingCredits({project,scene,onTitle,onClose,muted,onMute}:{project:Project;scene:Scene;onTitle:()=>void;onClose?:()=>void;muted:boolean;onMute:()=>void}) {
  const m=project.metadata??{},logo=project.assets.find(a=>a.id===m.creatorLogo)?.url??creatorLogo;
  const background=project.assets.find(a=>a.id===scene.background)?.url??'./classroom.svg';
  const viewport=useRef<HTMLDivElement>(null);
  const reduced=useRef(matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [running,setRunning]=useState(!reduced.current),[progress,setProgress]=useState(0),[finished,setFinished]=useState(false),[replay,setReplay]=useState(0);
  const rows=(m.credits??'').split('\n').map(s=>s.trim()).filter(Boolean).map(text=>{
    const match=/^(.{1,40}?)\s*[·:：]\s*(.+)$/.exec(text);
    return match?{role:match[1].trim(),name:match[2].trim()}:{role:'',name:text};
  });
  function restart(){viewport.current!.scrollTop=0;setProgress(0);setFinished(false);setReplay(v=>v+1);setRunning(true);}
  function toEnd(){const el=viewport.current!;el.scrollTop=el.scrollHeight;setRunning(false);setFinished(true);setProgress(1);}
  useEffect(()=>{
    if(!running)return;
    let frame=0,last=0;const el=viewport.current!,start=performance.now();let position=el.scrollTop;
    const tick=(now:number)=>{
      if(document.hidden){last=now;frame=requestAnimationFrame(tick);return;}
      const elapsed=last?Math.min(now-last,80):0;last=now;
      if(now-start>2200){
        const limit=el.scrollHeight-el.clientHeight;
        if(limit>1){position=Math.min(limit,position+elapsed*.024);el.scrollTop=position;if(el.scrollTop>=limit-1){setRunning(false);setFinished(true);return;}}
      }
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[running,replay]);
  return <div className="ending-screen cinematic-ending" style={{'--ending-background':`url("${background}")`} as React.CSSProperties}>
    <div className="ending-backdrop" aria-hidden="true"/><div className="ending-grain" aria-hidden="true"/>
    <header className="ending-masthead"><span>HINANA STUDIO STORY <i/> CREDITS</span><span>THE END</span></header>
    <div className="ending-layout">
      <div className="ending-story"><span className="ending-overline"><i/>이야기의 마지막 페이지</span><h1>{project.title}</h1><div className="ending-rule"/><p className="ending-message">{m.endingMessage||'이야기의 한 페이지를 함께해 주셔서 감사합니다.'}</p><p className="ending-chapter"><span>ENDING</span>{scene.title}</p><span className="ending-thanks">THANK YOU FOR PLAYING</span></div>
      <section className="ending-credits" aria-label="제작 크레딧">
        <div className="credits-heading"><span>THE PEOPLE BEHIND THE STORY</span><h2>제작 크레딧</h2></div>
        <div className="credits-viewport" ref={viewport} tabIndex={0} aria-label="크레딧 내용" onWheel={()=>setRunning(false)} onTouchStart={()=>setRunning(false)} onPointerDown={()=>setRunning(false)} onKeyDown={e=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key)){setRunning(false);e.stopPropagation();}}} onScroll={()=>{const el=viewport.current!;const limit=el.scrollHeight-el.clientHeight;setProgress(limit>0?el.scrollTop/limit:1);if(el.scrollTop<limit-1)setFinished(false);}}>
          <div className="credits-roll">
            <div className="creator-credit"><span className="credit-label">Made by</span><div className="creator-logo"><img src={logo} alt="제작자 로고"/></div>{m.author&&<p className="credit-author">{m.author}</p>}</div>
            {rows.length>0&&<div className="ending-custom-credits">{rows.map((row,i)=><div className="credit-person" key={i}>{row.role&&<span>{row.role}</span>}<p>{row.name}</p></div>)}</div>}
            <div className="engine-credit" aria-label="Powered by Hinana Studio Story"><img src="./studio-icon.svg" alt=""/><div><span className="credit-label">Powered by</span><strong>Hinana Studio Story</strong></div></div>
            <div className="credits-final"><span className="credits-star" aria-hidden="true">✦</span><p>그리고, 이 이야기를 완성해 주신</p><strong>플레이어 여러분께</strong><span>감사합니다.</span></div>
            {m.copyright&&<small className="credit-copyright">{m.copyright}</small>}
          </div>
        </div>
        <div className="credits-progress" role="progressbar" aria-label="크레딧 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)}><span style={{transform:`scaleX(${progress})`}}/></div>
        <div className="credits-controls"><span aria-live="polite">{finished?'마지막 페이지까지 함께해 주셔서 감사합니다.':running?'천천히, 이야기를 만든 사람들':'스크롤하여 자유롭게 읽으실 수 있습니다.'}</span><div><button title="크레딧 처음부터" aria-label="크레딧 처음부터" onClick={restart}><RotateCcw size={15}/></button><button title={running?'크레딧 일시정지':'크레딧 자동 재생'} aria-label={running?'크레딧 일시정지':'크레딧 자동 재생'} aria-pressed={running} onClick={()=>{if(finished)restart();else setRunning(v=>!v);}}>{running?<Pause size={15}/>:<Play size={15}/>}</button><button title="크레딧 끝으로" aria-label="크레딧 끝으로" onClick={toEnd}><ArrowDown size={15}/></button></div></div>
      </section>
    </div>
    <footer className="ending-navigation"><span>{m.author||project.title}{m.releaseVersion&&` · v${m.releaseVersion}`}</span><div><button aria-label={muted?'엔딩 음악 음소거 해제':'엔딩 음악 음소거'} title={muted?'음악 켜기':'음악 끄기'} aria-pressed={muted} onClick={onMute}>{muted?<VolumeX size={15}/>:<Volume2 size={15}/>}</button><button onClick={onTitle}><Home size={15}/>제목 화면</button>{onClose&&<button onClick={onClose}><X size={15}/>편집기로 돌아가기</button>}</div></footer>
  </div>;
}
