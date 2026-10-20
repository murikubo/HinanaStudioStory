import { useEffect, useRef } from 'react';
import { FilePlus2, FolderClock, Save, ChevronDown, Copy, LogOut } from 'lucide-react';
import type { RecentProject } from './bridge';
export function ProjectMenu({ recent, create, saveAs, saveNew, exit, openRecent }: { recent: RecentProject[]; create: () => void; saveAs: () => void; saveNew: () => void; exit?: () => void; openRecent: (path: string) => void }) {
  const ref=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{const cb=(e:PointerEvent)=>{if(!ref.current?.contains(e.target as Node))ref.current!.open=false;};document.addEventListener('pointerdown',cb);return()=>document.removeEventListener('pointerdown',cb);},[]);
  function run(action:()=>void){ref.current!.open=false;action();}
  return <details ref={ref} className="project-menu" onKeyDown={e=>{if(e.key==='Escape')ref.current!.open=false;}}><summary>프로젝트 <ChevronDown size={12}/></summary><div className="project-menu-content"><button onClick={()=>run(create)}><FilePlus2 size={15}/>새 프로젝트</button><button onClick={()=>run(saveAs)}><Save size={15}/>다른 이름으로 저장</button><button onClick={()=>run(saveNew)}><Copy size={15}/>새 프로젝트로 저장</button><button disabled={!exit} title={exit?'프로그램 종료':'데스크톱 앱에서 사용할 수 있습니다.'} onClick={()=>exit&&run(exit)}><LogOut size={15}/>종료</button><h4><FolderClock size={13}/>최근 프로젝트</h4>{recent.length?recent.map(item=><button className="recent-project" title={item.path} key={item.path} onClick={()=>run(()=>openRecent(item.path))}><strong>{item.title}</strong><small>{item.path}</small></button>):<p>최근 프로젝트가 없습니다.<br/>데스크톱 앱에서 파일을 열거나 저장하면 표시됩니다.</p>}</div></details>;
}
function Dialog({ title, children, close }: { title: string; children: React.ReactNode; close: () => void }) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const d=ref.current!,previous=document.activeElement as HTMLElement;d.showModal();return()=>{d.close();previous?.focus();};},[]);
  return <dialog ref={ref} className="player-panel" aria-label={title} onCancel={e=>{e.preventDefault();close();}}><div className="player-panel-heading"><h2>{title}</h2></div>{children}</dialog>;
}
export function NewProjectDialog({ close, create }: { close: () => void; create: (title: string) => void }) {
  return <Dialog title="새 프로젝트" close={close}><form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);create(String(data.get('title')??''));}}><label>프로젝트 이름<input autoFocus name="title" defaultValue="새로운 이야기" required maxLength={120}/></label><p className="control-help">빈 시작 장면으로 새 이야기를 만듭니다. 프로젝트 파일은 .hinanastory 형식으로 저장합니다.</p><div className="dialog-actions"><button type="button" onClick={close}>취소</button><button className="primary" type="submit">만들기</button></div></form></Dialog>;
}
export function UnsavedDialog({ close, save, discard, busy }: { close: () => void; save: () => void; discard: () => void; busy: boolean }) {
  return <Dialog title="변경 사항 저장" close={()=>{if(!busy)close();}}><p className="unsaved-description">현재 프로젝트에 저장하지 않은 변경 사항이 있습니다. 다른 프로젝트로 이동하기 전에 저장하시겠습니까?</p><div className="dialog-actions"><button disabled={busy} onClick={close}>취소</button><button disabled={busy} onClick={discard}>저장하지 않고 계속</button><button disabled={busy} className="primary" onClick={save}>{busy?'저장 중…':'저장하고 계속'}</button></div></Dialog>;
}

export function SaveNewDialog({title,close,save,busy}:{title:string;close:()=>void;save:(title:string)=>void;busy:boolean}){
 return <Dialog title="새 프로젝트로 저장" close={()=>{if(!busy)close();}}><form onSubmit={e=>{e.preventDefault();const name=String(new FormData(e.currentTarget).get('title')??'').trim();if(name&&!busy)save(name);}}><label>새 프로젝트 이름<input autoFocus name="title" defaultValue={`${title} 사본`} required maxLength={120} disabled={busy}/></label><p className="control-help">현재 이야기와 에셋을 별도 .hinanastory 파일로 저장하고 새 프로젝트에서 작업을 이어갑니다. 원본 파일과 플레이 저장 데이터는 유지됩니다.</p><div className="dialog-actions"><button type="button" disabled={busy} onClick={close}>취소</button><button className="primary" type="submit" disabled={busy}>{busy?'저장 중…':'새 프로젝트로 저장'}</button></div></form></Dialog>;
}
export function ExitDialog({close,save,discard,busy}:{close:()=>void;save:()=>void;discard:()=>void;busy:boolean}){
 return <Dialog title="프로그램 종료" close={()=>{if(!busy)close();}}><p className="unsaved-description">저장하지 않은 변경 사항이 있습니다. 종료하기 전에 저장하시겠습니까?</p><p className="control-help">저장하지 않고 종료하면 이번 변경 사항은 자동 복구에서도 제거됩니다. 마지막으로 저장한 파일은 유지됩니다.</p><div className="dialog-actions"><button disabled={busy} onClick={close}>취소</button><button disabled={busy} onClick={discard}>저장하지 않고 종료</button><button disabled={busy} className="primary" onClick={save}>{busy?'처리 중…':'저장하고 종료'}</button></div></Dialog>;
}

export function DeleteSceneDialog({scene,close,remove}:{scene:{title:string;lines:unknown[]};close:()=>void;remove:()=>void}){
 return <Dialog title="장면 삭제" close={close}><p className="unsaved-description">“{scene.title}” 장면과 이 장면의 블록 {scene.lines.length}개를 삭제하시겠습니까?</p><p className="control-help">다른 장면은 유지됩니다. 삭제할 장면으로 향하는 선택지와 연결은 제거되며, 실행 취소로 함께 복원할 수 있습니다.</p><div className="dialog-actions"><button autoFocus onClick={close}>취소</button><button className="primary" onClick={remove}>장면 삭제</button></div></Dialog>;
}
