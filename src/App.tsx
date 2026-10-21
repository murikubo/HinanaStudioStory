import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, CircleHelp, Clapperboard, Copy, FolderOpen, GitBranch, ImagePlus, Images, Layers,  MessageSquare, MoreHorizontal, Music2, Info, Play, Plus, Redo2, Save, Settings2, Sparkles, Trash2, Undo2, Upload, X, ArrowUp, ArrowDown, Users, Search, Archive } from 'lucide-react';
import { reconcileGallery, start, demo, newLine, newScene, newProject, reorderScenes, deleteScene, cloneLines, orderBlocks, transferBlocks, parseProject, uid, type Line, type Project, type Session } from './model';
import About from './About';
import ScriptDesk from './ScriptDesk';
import GalleryEditor from './GalleryEditor';
import BackupsPanel from './BackupsPanel';
import {createBackup} from './backups';
import './workspace-tools.css';
import SceneGraph from './SceneGraph';
import BlockTools from './BlockTools';
import { ProjectMenu, NewProjectDialog, UnsavedDialog, SaveNewDialog, ExitDialog, DeleteSceneDialog } from './ProjectMenu';
import type { RecentProject } from './bridge';
import Player from './Player';
import ExportGame from './ExportGame';
import { appInfo } from './metadata';
import { ChoiceCondition, EffectsEditor, LinePresentation, SceneControls, VariablesEditor } from './Controls';

import EditorPreview from './EditorPreview';
import { readAssetFiles } from './import-assets';
import { moveActor, speaker } from './characters';
import CharacterEditor, { CastEditor } from './CharacterEditor';
import AssetManager from './AssetManager';
import ProjectSettings from './ProjectSettings';
import { readRecovery, writeRecovery, clearRecovery, type Recovery } from './recovery';
type EditSnapshot = { project: Project; sceneId: string; lineId: string; selectedBlocks: string[] };
function Workspace({ recovered }: { recovered: Recovery | null }) {
  const [project, setProject] = useState<Project>(() => {const p=recovered?.project??demo();return p.id?p:{...p,id:p.scenes[0].id};});
  const projectRef = useRef(project);
  projectRef.current = project;
  const [savedProject, setSavedProject] = useState<Project | null>(() => recovered && recovered.meta.dirty !== false ? null : project);
  const [filePath, setFilePath] = useState<string | null>(null);
  const savedRef=useRef(savedProject),pathRef=useRef(filePath),closingRef=useRef(false),autosaveTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  savedRef.current=savedProject;pathRef.current=filePath;
  const [savingNew,setSavingNew]=useState(false),[exiting,setExiting]=useState(false),[exitBusy,setExitBusy]=useState(false);
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [fileBusy, setFileBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<(() => void | Promise<void>) | null>(null);
  const [view, setView] = useState<'edit' | 'graph' | 'characters' | 'assets' | 'settings' | 'script' | 'gallery' | 'backups'>('edit');
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<Line[]>([]);
  const dirty = project !== savedProject;
  const [sceneId, setSceneId] = useState(project.scenes[0].id);
  const [lineId, setLineId] = useState(project.scenes[0].lines[1]?.id ?? project.scenes[0].lines[0].id);
  const [tab, setTab] = useState<'scenes' | 'assets' | 'variables'>('scenes');
  const [endingPreview,setEndingPreview]=useState(false);
  const [playing, setPlaying] = useState<Session | null>(null);
  const [about, setAbout] = useState(false);
  const [deletingScene, setDeletingScene] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const audioImportRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState('');
  const [cached, setCached] = useState(true);
  const [dropping,setDropping]=useState(false),[assetImports,setAssetImports]=useState(0);
  const dragDepth=useRef(0),importQueue=useRef<Promise<void>>(Promise.resolve()),projectGeneration=useRef(0);
  const fileDrop=(e:React.DragEvent)=>Array.from(e.dataTransfer.types).includes('Files');
  const resetDrop=()=>{dragDepth.current=0;setDropping(false);};
  const [history, setHistory] = useState<EditSnapshot[]>([]), [future, setFuture] = useState<EditSnapshot[]>([]);
  const historyRef = useRef(history), futureRef = useRef(future);
  historyRef.current = history; futureRef.current = future;
  const importRef = useRef<HTMLInputElement>(null), assetRef = useRef<HTMLInputElement>(null);
  const scene = project.scenes.find(s => s.id === sceneId) ?? project.scenes[0];
  const line = scene.lines.find(l => l.id === lineId) ?? scene.lines[0];
  function begin(index = 0, ending = false) { try { const session=ending?{sceneId:scene.id,index,variables:Object.fromEntries((projectRef.current.variables??[]).map(v=>[v.id,v.initial]))}:start(projectRef.current, scene.id, index);setEndingPreview(ending);setPlaying(session); } catch (e) { toast(e instanceof Error ? e.message : '재생하지 못했습니다.'); } }
  function beginCurrent() { begin(scene.lines.findIndex(l=>l.id===line.id)); }
  function snapshot(): EditSnapshot { return { project: projectRef.current, sceneId: scene.id, lineId: line.id, selectedBlocks: [...selectedBlocks] }; }
  function resetHistory() { historyRef.current=[];futureRef.current=[];setHistory([]);setFuture([]); }
  function update(next: Project) { if(next===projectRef.current)return;next=reconcileGallery(next); historyRef.current=[...historyRef.current.slice(-39),snapshot()];futureRef.current=[];setHistory(historyRef.current);setFuture([]);projectRef.current=next;setProject(next); }
  function restore(entry: EditSnapshot) {
    const restoredScene=entry.project.scenes.find(s=>s.id===entry.sceneId)??entry.project.scenes[0];
    projectRef.current=entry.project;setProject(entry.project);setSceneId(restoredScene.id);
    setLineId(restoredScene.lines.find(l=>l.id===entry.lineId)?.id??restoredScene.lines[0].id);
    setSelectedBlocks(entry.selectedBlocks.filter(id=>restoredScene.lines.some(l=>l.id===id)));
  }
  function selectScene(id: string, block?: string) { const s = project.scenes.find(s=>s.id===id); if(!s)return;setSceneId(id);setLineId(block??s.lines[0].id);setSelectedBlocks([]); }
  function guard(action: () => void | Promise<void>) { if (dirty) setPending(() => action); else void action(); }
  function patchScene(patch: Partial<typeof scene>) { update({ ...project, scenes: project.scenes.map(s => s.id === scene.id ? { ...s, ...patch } : s) }); }
  function patchLine(patch: Partial<Line>) { patchScene({ lines: scene.lines.map(l => l.id === line.id ? { ...l, ...patch } : l) }); }
  function toast(message: string) { setNotice(message); }
  useEffect(() => { const t = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(t); }, [notice]);
  useEffect(() => { let active=true; const t = setTimeout(() => { if(closingRef.current)return;void writeRecovery(project,{path:filePath,dirty}).then(ok=>{if(active)setCached(ok);}); },500);autosaveTimer.current=t;return()=>{active=false;clearTimeout(t);}; },[project,filePath,dirty]);
  useEffect(()=>{const timer=setInterval(()=>{const p=projectRef.current;if(p!==savedRef.current&&!closingRef.current)void createBackup(p,'autosave').catch(()=>toast('자동 백업을 만들지 못했습니다. 파일로 저장해 주세요.'));},5*60*1000);return()=>clearInterval(timer);},[]);
  useEffect(() => { const cb = (e: BeforeUnloadEvent) => { if(dirty&&!closingRef.current)e.preventDefault(); }; window.addEventListener('beforeunload', cb); return () => window.removeEventListener('beforeunload', cb); }, [dirty]);
  useEffect(() => {
    if(!window.studio)return;
    const remembered = recovered?.meta.path;
    void window.studio.fileState().then(async state => {
      setRecent(state.recent);
      if(remembered && state.recent.some(r=>r.path===remembered)) { const active=await window.studio!.activateProject(remembered,projectRef.current.title);setFilePath(active.path);setRecent(active.recent); }
    }).catch(()=>toast('최근 프로젝트 목록을 읽지 못했습니다.'));
  }, []);
  function undo() { const entry=historyRef.current.at(-1);if(!entry)return;futureRef.current=[snapshot(),...futureRef.current];historyRef.current=historyRef.current.slice(0,-1);setFuture(futureRef.current);setHistory(historyRef.current);restore(entry); }
  function redo() { const entry=futureRef.current[0];if(!entry)return;historyRef.current=[...historyRef.current.slice(-39),snapshot()];futureRef.current=futureRef.current.slice(1);setHistory(historyRef.current);setFuture(futureRef.current);restore(entry); }
  async function save(saveAs = false): Promise<boolean> {
    if(fileBusy)return false;
    const current=projectRef.current; setFileBusy(true);
    try {
      const data = JSON.stringify(current, null, 2); parseProject(data);
      if (window.studio) { const result=await window.studio.save(data,saveAs); if(!result)return false;pathRef.current=result.path;setFilePath(result.path);setRecent(result.recent);toast(result.backupWarning??'프로젝트 파일을 저장했습니다.'); }
      else { const url = URL.createObjectURL(new Blob([data], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `${current.title.replace(/[<>:"/\\|?*]/g,'-') || 'MyStory'}.hinanastory`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('프로젝트 파일을 내보냈습니다.'); }
      if(!window.studio?.createBackup)try{await createBackup(current,'save');}catch{toast('파일은 내보냈으나 백업을 만들지 못했습니다.');}
      savedRef.current=current;setSavedProject(current);return true;
    } catch (e) { toast(e instanceof Error?e.message:'저장하지 못했습니다. 경로와 여유 공간을 확인해 주세요.');return false; }
    finally {setFileBusy(false);}
  }
  async function saveNew(title:string) {
    if(fileBusy)return;
    if(window.studio&&!window.studio.saveNew){toast('새 기능을 사용하려면 프로그램을 다시 실행해 주세요.');return;}
    const source=projectRef.current,copy={...source,id:uid(),title};setFileBusy(true);
    try{
      const raw=JSON.stringify(copy,null,2);parseProject(raw);let path:string|null=null;
      if(window.studio){const result=await window.studio.saveNew(raw);if(!result)return;path=result.path;setRecent(result.recent);}
      else{const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`${title.replace(/[<>:"/\\|?*]/g,'-')||'MyStory'}.hinanastory`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
      projectGeneration.current++;
      const next=projectRef.current===source?copy:{...projectRef.current,id:copy.id,title};
      projectRef.current=next;savedRef.current=copy;pathRef.current=path;setProject(next);setSavedProject(copy);setFilePath(path);resetHistory();setClipboard([]);setSavingNew(false);toast('새 프로젝트로 저장했습니다. 이제 사본에서 작업합니다.');
    }catch(error){toast(error instanceof Error?error.message:'새 프로젝트로 저장하지 못했습니다.');}
    finally{setFileBusy(false);}
  }
  async function finishClose(discard=false) {
    if(!window.studio?.close||closingRef.current)return;
    closingRef.current=true;clearTimeout(autosaveTimer.current);setExitBusy(true);
    try{
      let baseline=discard?savedRef.current:projectRef.current;
      if(discard&&!baseline&&pathRef.current){try{baseline=parseProject((await window.studio.openRecent(pathRef.current)).content);}catch{baseline=null;}}
      const ok=baseline?await writeRecovery(baseline,{path:pathRef.current,dirty:false}):await clearRecovery();
      if(!ok)throw Error('자동 복구 정리를 완료하지 못했습니다. 다시 시도해 주세요.');
      await window.studio.close();
    }catch(error){closingRef.current=false;toast(error instanceof Error?error.message:'종료하지 못했습니다.');setExitBusy(false);void writeRecovery(projectRef.current,{path:pathRef.current,dirty:projectRef.current!==savedRef.current}).then(setCached);}
  }
  async function saveAndClose(){if(fileBusy||exitBusy)return;if(await save()){if(projectRef.current!==savedRef.current){toast('저장 중 내용이 변경되었습니다. 다시 저장해 주세요.');return;}await finishClose();}}
  const exitRequest=useRef(()=>{});
  exitRequest.current=()=>{if(closingRef.current)return;if(fileBusy||assetImports){toast('파일 처리가 끝난 뒤 종료해 주세요.');return;}if(projectRef.current!==savedRef.current)setExiting(true);else void finishClose();};
  useEffect(()=>{
    const unsubscribe=window.studio?.onCloseRequested?.(()=>exitRequest.current());
    const shortcut=(event:KeyboardEvent)=>{if(window.studio?.close&&(event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='q'){event.preventDefault();exitRequest.current();}};
    window.addEventListener('keydown',shortcut);return()=>{unsubscribe?.();window.removeEventListener('keydown',shortcut);};
  },[]);
  async function adopt(p: Project, path: string | null, fresh=false) {
    if(!p.id)p={...p,id:p.scenes[0].id};
    if(window.studio){const state=await window.studio.activateProject(path,p.title);setRecent(state.recent);}
    projectGeneration.current++;
    pathRef.current=path;savedRef.current=fresh?null:p;setFilePath(path);projectRef.current=p;setProject(p);setSavedProject(fresh?null:p);resetHistory();setSceneId(p.startScene??p.scenes[0].id);setLineId(p.scenes.find(s=>s.id===(p.startScene??p.scenes[0].id))!.lines[0].id);setSelectedBlocks([]);setClipboard([]);setPlaying(null);setView('edit');
  }
  async function load(raw: string,path: string | null=null) { const p=parseProject(raw);await adopt(p,path);toast('프로젝트를 열었습니다.'); }
  async function openFile(recentPath?:string) { try { if(window.studio){const result=recentPath?await window.studio.openRecent(recentPath):await window.studio.open();if(result)await load(result.content,result.path);}else importRef.current?.click(); } catch(e){toast(e instanceof Error?e.message:'파일을 열지 못했습니다.');} }
  function open() { guard(()=>openFile()); }
  async function continueAfterSave() { if(await save()){const action=pending;setPending(null);await action?.();} }
  function dropScene(event: React.DragEvent, targetId:string) {
    event.preventDefault();
    try {
      const scene=event.dataTransfer.getData('application/x-hinana-scene');
      if(scene) { update(reorderScenes(project,scene,targetId));return; }
      const raw=event.dataTransfer.getData('application/x-hinana-blocks');
      if(raw){const data=JSON.parse(raw);update(transferBlocks(project,data.sceneId,data.ids,targetId,false));setSelectedBlocks([]);}
    } catch {toast('드래그한 항목을 이동하지 못했습니다.');}
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if(e.defaultPrevented||e.isComposing||e.altKey||!(e.ctrlKey||e.metaKey)||playing||exporting||document.querySelector('dialog[open]'))return;
      const key=e.key.toLowerCase();
      if(key==='enter'&&!e.shiftKey){e.preventDefault();if(!e.repeat)beginCurrent();return;}
      if(key==='f'){e.preventDefault();setView('script');return;}
      if(key==='s'){e.preventDefault();void save(e.shiftKey);return;}
      if(key!=='z'&&!(key==='y'&&e.ctrlKey&&!e.metaKey))return;
      // Fields committed on blur keep the browser's undo for their pending text.
      if((e.target as HTMLElement)?.closest('[data-native-undo], [contenteditable="true"]'))return;
      e.preventDefault();if(key==='y'||e.shiftKey)redo();else undo();
    };
    window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  });
  function addScene() { const s = newScene(project.scenes.length + 1); update({ ...project, scenes: [...project.scenes, s] }); setSceneId(s.id); setLineId(s.lines[0].id);setSelectedBlocks([]); }
  function removeScene() {
    const current=projectRef.current,index=current.scenes.findIndex(s=>s.id===deletingScene);
    setDeletingScene(null);if(current.scenes.length<2||index<0)return;
    const removed=current.scenes[index],next=deleteScene(current,removed.id);
    update(next);
    const adjacent=next.scenes[Math.min(index,next.scenes.length-1)];
    setSceneId(adjacent.id);setLineId(adjacent.lines[0].id);setSelectedBlocks([]);
    toast(`“${removed.title}” 장면을 삭제했습니다. Ctrl/Cmd+Z로 복원할 수 있습니다.`);
  }
  function addLine(type: Line['type']) { const l = newLine(type); if (type === 'choice') l.choices = [{ id: uid(), text: '새로운 선택지', target: project.scenes.find(s => s.id !== scene.id)?.id ?? scene.id }]; patchScene({ lines: [...scene.lines, l] }); setLineId(l.id); }
  function importAssets(files:File[]) {
    if(!files.length)return;
    const generation=projectGeneration.current;setAssetImports(n=>n+1);
    const operation=async()=>{
      try{
        if(generation!==projectGeneration.current||closingRef.current)return;
        const result=await readAssetFiles(files,80*1024*1024-new Blob([JSON.stringify(projectRef.current)]).size);
        if(generation!==projectGeneration.current||closingRef.current)return;
        const current=projectRef.current;let remaining=80*1024*1024-new Blob([JSON.stringify(current)]).size;
        const accepted=result.assets.filter(a=>{const size=new Blob([JSON.stringify(a)]).size+1;if(size>remaining){result.errors.push(`${a.name}: 프로젝트 80MB 한도 초과`);return false;}remaining-=size;return true;});
        if(accepted.length)update({...current,assets:[...current.assets,...accepted]});
        toast(`${accepted.length}개 에셋을 추가했습니다.${result.errors.length?` ${result.errors.length}개 제외: ${result.errors.slice(0,3).join(' / ')}`:''}`);
      }catch{toast('에셋 파일을 읽지 못했습니다.');}finally{setAssetImports(n=>n-1);}
    };
    importQueue.current=importQueue.current.then(operation,operation);
  }
  return <div className="app" onDragEnterCapture={e=>{if(!fileDrop(e))return;e.preventDefault();dragDepth.current++;if(!playing&&!exporting&&!document.querySelector('dialog[open]'))setDropping(true);}} onDragOverCapture={e=>{if(fileDrop(e)){e.preventDefault();e.dataTransfer.dropEffect=playing||exporting||document.querySelector('dialog[open]')?'none':'copy';}}} onDragLeaveCapture={()=>{if(dragDepth.current>0&&--dragDepth.current===0)setDropping(false);}} onDragEndCapture={resetDrop} onDropCapture={e=>{if(!fileDrop(e))return;e.preventDefault();e.stopPropagation();resetDrop();if(playing||exporting||document.querySelector('dialog[open]'))return;importAssets(Array.from(e.dataTransfer.files));}}>
    {dropping&&<div className="asset-drop-overlay" role="status"><Upload size={42}/><strong>에셋을 여기에 놓으세요</strong><span>이미지와 음악을 여러 개 한꺼번에 가져옵니다.</span><span>PNG · JPG · WebP (8MB) / MP3 · WAV · OGG · WebM (20MB)</span></div>}
    <header><div className="brand"><div className="brand-icon"><BookOpen size={22}/></div><div>hinana<span>STUDIO STORY</span></div><span className="version">PREVIEW</span></div><ProjectMenu backups={()=>setView('backups')} saveNew={()=>setSavingNew(true)} exit={window.studio?.requestClose?()=>{void window.studio!.requestClose();}:undefined} recent={recent} create={()=>setCreating(true)} saveAs={()=>{void save(true);}} openRecent={path=>guard(()=>openFile(path))}/><div className="project-name" title={filePath??'저장하지 않은 프로젝트'}><span className="dot"/>{project.title}{dirty?' *':''}<ChevronDown size={13}/></div><div className="header-actions"><button title="프로그램 정보" onClick={() => setAbout(true)}><Info size={16}/>정보</button><button onClick={() => setExporting(true)}><Upload size={16}/>작품 내보내기</button><button onClick={open}><FolderOpen size={16}/>열기</button><button disabled={fileBusy} onClick={()=>{void save();}}><Save size={16}/>저장</button><span className="divider"/><button className="primary" onClick={() => begin()}><Play size={15} fill="currentColor"/>플레이 테스트</button></div></header>
    <div className="workspace"><nav className="rail"><button className={tab === 'scenes' && view==='edit' ? 'active' : ''} title="장면" onClick={() => {setTab('scenes');setView('edit');}}><Clapperboard/><span>장면</span></button><button className={tab === 'assets' ? 'active' : ''} title="에셋" onClick={() => {setTab('assets');setView('assets');}}><Images/><span>에셋</span></button><button className={tab === 'variables' ? 'active' : ''} title="변수" onClick={() => {setTab('variables');setView('edit');}}><GitBranch/><span>변수</span></button><button className={view==='characters'?'active':''} title="캐릭터" onClick={()=>setView('characters')}><Users/><span>캐릭터</span></button><button className={view==='graph'?'active':''} title="장면 연결 그래프" aria-label="장면 연결 그래프" onClick={()=>setView(view==='graph'?'edit':'graph')}><GitBranch/><span>연결</span></button><button className={view==='settings'?'active':''} title="작품 설정" aria-label="작품 설정" onClick={()=>setView('settings')}><Settings2/><span>작품</span></button><button className={view==='script'?'active':''} title="대본 검색·입출력" aria-label="대본 검색·입출력" onClick={()=>setView('script')}><Search/><span>대본</span></button><button className={view==='gallery'?'active':''} title="감상실 설정" aria-label="감상실 설정" onClick={()=>setView('gallery')}><Images/><span>감상실</span></button><div className="rail-bottom"><button title="프로그램 정보" onClick={() => setAbout(true)}><Info size={20}/></button><button title="사용 안내" onClick={() => toast('장면 → 대사와 선택지 편집 → 플레이 테스트 → 저장. Ctrl/Cmd+S로 파일을 저장할 수 있습니다.')}><CircleHelp size={20}/></button></div></nav>
    <aside className="library"><div className="panel-heading"><span>{tab === 'scenes' ? '프로젝트' : tab === 'assets' ? '에셋 라이브러리' : '변수 관리'}</span><span className="tiny-label">{tab === 'scenes' ? `${project.scenes.length} SCENES` : tab === 'assets' ? `${project.assets.length} FILES` : `${project.variables?.length ?? 0} VARS`}</span></div>
    <div className="project-card"><div className="book-tile"><BookOpen size={22}/></div><input aria-label="프로젝트 이름" value={project.title} onChange={e => update({ ...project, title: e.target.value })}/><span>비주얼 노벨 프로젝트</span></div>
    {tab === 'scenes' ? <><div className="section-heading"><span><Layers size={14}/>장면 목록</span><button className="icon" title="장면 추가" onClick={addScene}><Plus size={16}/></button></div><div className="scene-list">{project.scenes.map((s, i) => <button className={`scene-item ${s.id === scene.id ? 'selected' : ''}`} key={s.id} draggable onDragStart={e=>{e.dataTransfer.setData('application/x-hinana-scene',s.id);e.dataTransfer.effectAllowed='move';}} onDragOver={e=>e.preventDefault()} onDrop={e=>dropScene(e,s.id)} onClick={() => selectScene(s.id)}><span className="scene-number">{String(i + 1).padStart(2,'0')}</span><div><strong>{s.title}</strong><small>{s.lines.length}개의 블록 {s.id===(project.startScene??project.scenes[0].id) && <em>시작 장면</em>}</small></div><ChevronRight size={13}/></button>)}</div><button className="add-scene" onClick={addScene}><Plus size={15}/>새 장면 만들기</button></> : tab === 'variables' ? <VariablesEditor project={project} update={update} toast={toast}/> : <><button className="add-scene" onClick={() => assetRef.current?.click()}><Upload size={15}/>이미지 불러오기</button><button className="add-scene" onClick={() => audioImportRef.current?.click()}><Music2 size={15}/>음악 불러오기</button><div className="asset-grid">{project.assets.map(a => <div className="asset" key={a.id}>{a.type === 'audio' ? <div className="audio-asset"><Music2 size={25}/><audio controls src={a.url} preload="none"/></div> : <img src={a.url} alt={a.name}/>}<span>{a.name}</span></div>)}{!project.assets.length && <p className="empty">배경·캐릭터 이미지와<br/>음악을 추가해 보세요.<br/><small>이미지 8MB · 음악 20MB</small></p>}</div></>}
    <div className="library-tip"><Sparkles size={17}/><p>모든 이야기는<br/><strong>한 장면에서 시작됩니다.</strong><span>당신만의 세계를 만들어 보세요.</span></p></div></aside>
    <main>{(['characters','assets','settings','script','gallery','backups'].includes(view))&&<div className="undo-group manager-undo"><button title="실행 취소 (Ctrl/Cmd+Z)" aria-label="실행 취소" disabled={!history.length} onClick={undo}><Undo2 size={16}/>실행 취소</button><button title="다시 실행 (Ctrl/Cmd+Shift+Z)" aria-label="다시 실행" disabled={!future.length} onClick={redo}><Redo2 size={16}/>다시 실행</button></div>}{view==='script'?<ScriptDesk project={project} update={update} jump={(id,block)=>{selectScene(id,block);setView('edit');}} toast={toast}/>:view==='gallery'?<GalleryEditor project={project} update={update}/>:view==='backups'?<><div className="graph-heading"><h1><Archive size={20}/>날짜별 백업·복원</h1></div><BackupsPanel project={project} getCurrent={()=>projectRef.current} restore={p=>{projectGeneration.current++;update(p);setSceneId(p.startScene??p.scenes[0].id);setLineId(p.scenes.find(s=>s.id===(p.startScene??p.scenes[0].id))!.lines[0].id);setSelectedBlocks([]);setClipboard([]);setView('edit');}} toast={toast}/></>:view==='graph'?<SceneGraph project={project} selected={scene.id} select={selectScene} edit={()=>setView('edit')} update={update}/>:view==='settings'?<ProjectSettings project={project} update={update} toast={toast} previewEnding={()=>begin(scene.lines.length-1,true)}/>:view==='characters'?<CharacterEditor project={project} update={update} importImage={()=>assetRef.current?.click()} toast={toast}/>:view==='assets'?<AssetManager project={project} mutate={change=>update(change(projectRef.current))} importImage={()=>assetRef.current?.click()} importAudio={()=>audioImportRef.current?.click()} toast={toast}/>:<><div className="editor-heading"><div><div className="breadcrumb">프로젝트 <ChevronRight size={12}/> 장면 편집</div><h1>{scene.title}</h1></div><div className="undo-group"><button className="icon" title="실행 취소 (Ctrl/Cmd+Z)" aria-label="실행 취소" disabled={!history.length} onClick={undo}><Undo2 size={17}/></button><button className="icon" title="다시 실행 (Ctrl/Cmd+Shift+Z)" aria-label="다시 실행" disabled={!future.length} onClick={redo}><Redo2 size={17}/></button></div></div>
    <div className="preview-heading"><span><span className="dot"/>장면 미리보기</span><div className="preview-test-actions"><span>BLOCK {String(scene.lines.indexOf(line)+1).padStart(2,'0')}</span><button aria-label="현재 위치에서 테스트" title="Ctrl/Cmd+Enter · 선택한 블록부터 재생합니다. 현재 장면의 앞선 변수 변경을 반영합니다." onClick={beginCurrent}><Play size={13}/>현재 위치에서 테스트</button></div></div><EditorPreview project={project} scene={scene} line={line} beginCurrent={beginCurrent} move={(scope,key,point)=>update(moveActor(projectRef.current,scene.id,line.id,scope,key,point))}/><div className="preview-footer"><span><ImagePlus size={13}/>{scene.background === 'default' ? '오후의 교실' : project.assets.find(a => a.id === scene.background)?.name}</span><span>현재 블록의 화면을 미리 보고 있습니다</span></div>
    <section className="script"><div className="script-heading"><h2><MessageSquare size={17}/>스토리 스크립트 <span>{scene.lines.length}</span></h2><div><button onClick={() => addLine('dialogue')}><Plus size={14}/>대사</button><button onClick={() => addLine('choice')}><GitBranch size={14}/>선택지</button></div></div><BlockTools project={project} scene={scene} selected={selectedBlocks} setSelected={setSelectedBlocks} clipboard={clipboard} setClipboard={setClipboard} update={update} afterId={line.id}/><div className="line-list">{scene.lines.map((l, i) => <div className="line-row" key={l.id} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();try{const data=JSON.parse(e.dataTransfer.getData('application/x-hinana-blocks'));if(data.sceneId===scene.id)update(orderBlocks(project,scene.id,data.ids,l.id));else update(transferBlocks(project,data.sceneId,data.ids,scene.id,false));}catch{}}}><input type="checkbox" aria-label={`블록 ${i+1} 선택`} checked={selectedBlocks.includes(l.id)} onChange={e=>setSelectedBlocks(ids=>e.target.checked?[...ids,l.id]:ids.filter(id=>id!==l.id))}/><button draggable onDragStart={e=>{e.dataTransfer.setData('application/x-hinana-blocks',JSON.stringify({sceneId:scene.id,ids:selectedBlocks.includes(l.id)?selectedBlocks:[l.id]}));e.dataTransfer.effectAllowed='move';}} className={`line-item ${l.id === line.id ? 'selected' : ''}`} onClick={() => setLineId(l.id)}><span className="line-number">{String(i + 1).padStart(2,'0')}</span><span className={`line-type ${l.type}`}>{l.type === 'choice' ? <GitBranch size={15}/> : <MessageSquare size={15}/>}</span><div><strong>{l.type === 'choice' ? '선택지 분기' : speaker(project,l).name || '내레이션'}</strong><p>{l.text || '새로운 이야기를 입력해 주세요…'}</p></div>{l.type === 'choice' && <span className="choice-count">{l.choices.length}개의 선택</span>}<MoreHorizontal size={17}/></button></div>)}</div><button className="add-block" onClick={() => addLine('dialogue')}><Plus size={15}/>이야기를 이어 보세요</button></section></>}</main>
    <aside className="inspector"><div className="panel-heading"><span><Settings2 size={15}/>속성</span><span className="tiny-label">INSPECTOR</span></div><section><h3>장면 설정</h3><div className="scene-order-actions"><button title="장면 위로" disabled={project.scenes.indexOf(scene)===0} onClick={()=>update(reorderScenes(project,scene.id,project.scenes[project.scenes.indexOf(scene)-1].id))}><ArrowUp size={14}/></button><button title="장면 아래로" disabled={project.scenes.indexOf(scene)===project.scenes.length-1} onClick={()=>update(reorderScenes(project,project.scenes[project.scenes.indexOf(scene)+1].id,scene.id))}><ArrowDown size={14}/></button><button onClick={()=>update({...project,startScene:scene.id})} disabled={scene.id===(project.startScene??project.scenes[0].id)}>시작 장면으로</button></div><label>장면 이름<input value={scene.title} onChange={e => patchScene({ title: e.target.value })}/></label><label>장면 끝의 다음 연결<select value={scene.next??''} onChange={e=>patchScene({next:e.target.value})}><option value="">이야기 종료</option>{project.scenes.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label><label>배경 이미지<select value={scene.background} onChange={e => patchScene({ background: e.target.value })}><option value="default">오후의 교실 (기본)</option>{project.assets.filter(a => a.type !== 'audio').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>{scene.cast===undefined&&<label>캐릭터 이미지<select value={scene.character} onChange={e => patchScene({ character: e.target.value })}><option value="">없음</option>{project.assets.filter(a => a.type !== 'audio').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}<button className="import-button" onClick={() => assetRef.current?.click()}><Upload size={14}/>이미지 불러오기</button><CastEditor project={project} value={scene.cast} onChange={cast=>patchScene({cast})} title="등장 캐릭터"/><SceneControls project={project} scene={scene} patch={patchScene} importAudio={() => audioImportRef.current?.click()}/></section>
    <section><div className="inspector-title"><h3>{line.type === 'choice' ? '선택지 편집' : '대사 편집'}</h3><span className="pill">BLOCK {String(scene.lines.indexOf(line) + 1).padStart(2,'0')}</span></div>{line.type === 'dialogue' && <><label>등록 화자<select aria-label="등록 화자" value={line.speakerId??''} onChange={e=>patchLine({speakerId:e.target.value||undefined,speaker:project.characters?.find(c=>c.id===e.target.value)?.name??line.speaker})}><option value="">직접 입력</option>{project.characters?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>말하는 사람<input placeholder="비워두면 내레이션" disabled={!!line.speakerId} value={line.speakerId?speaker(project,line).name:line.speaker} onChange={e => patchLine({ speaker: e.target.value })}/></label></>}<label>{line.type === 'choice' ? '질문' : '대사 내용'}<textarea rows={4} value={line.text} placeholder="어떤 이야기가 펼쳐지나요?" onChange={e => patchLine({ text: e.target.value })}/><span className="char-count">{line.text.length}자</span></label><LinePresentation project={project} scene={scene} line={line} patch={patchLine}/><CastEditor project={project} value={line.cast} inherited={scene.cast} onChange={cast=>patchLine({cast})} title="블록 캐릭터" scope="line"/>
    {line.type === 'choice' && <div className="choice-editor">{line.choices.map((c, i) => <div key={c.id}><label>선택 {i + 1}<div className="choice-input"><input aria-label={`선택 ${i + 1} 내용`} value={c.text} onChange={e => patchLine({ choices: line.choices.map(v => v.id === c.id ? { ...v, text: e.target.value } : v) })}/><button className="icon" title="선택지 삭제" onClick={() => patchLine({ choices: line.choices.filter(v => v.id !== c.id) })}><X size={13}/></button></div></label><label>이동할 장면<select value={c.target} onChange={e => patchLine({ choices: line.choices.map(v => v.id === c.id ? { ...v, target: e.target.value } : v) })}>{project.scenes.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label><ChoiceCondition project={project} choice={c} index={i} patch={p => patchLine({ choices: line.choices.map(v => v.id === c.id ? { ...v, ...p } : v) })}/></div>)}<button className="import-button" onClick={() => patchLine({ choices: [...line.choices, { id: uid(), text: '', target: project.scenes[0].id }] })}><Plus size={14}/>선택지 추가</button></div>}
    <EffectsEditor project={project} line={line} patch={patchLine}/><div className="block-actions"><button title="블록 복제" onClick={() => { const l = cloneLines([line])[0]; patchScene({ lines: [...scene.lines.slice(0, scene.lines.indexOf(line) + 1), l, ...scene.lines.slice(scene.lines.indexOf(line) + 1)] }); setLineId(l.id); }}><Copy size={14}/>복제</button><button disabled={scene.lines.length < 2} onClick={() => { patchScene({ lines: scene.lines.filter(l => l.id !== line.id) }); setLineId(scene.lines.find(l => l.id !== line.id)!.id); }}><Trash2 size={14}/>삭제</button></div></section>
    <div className="scene-delete"><button disabled={project.scenes.length < 2} onClick={()=>setDeletingScene(scene.id)}><Trash2 size={13}/>현재 장면 삭제</button><small>삭제한 내용은 실행 취소로 복원할 수 있습니다.</small></div></aside></div>
    <footer><span><span className={`dot ${cached ? 'green' : ''}`}/>{assetImports?'에셋 불러오는 중…':cached ? '로컬 자동 복구 활성화' : '자동 복구 공간 부족 · 파일로 저장해 주세요'}</span><span>{project.scenes.length}개 장면 <span className="footer-dot">·</span>{project.scenes.reduce((a,s) => a + s.lines.length,0)}개 블록</span><span className="file-status" title={filePath??''}>{filePath?.split(/[\\/]/).at(-1)??'저장 경로 없음'}{dirty?' · 수정됨':''}</span><span>HINANA STUDIO STORY <span className="footer-dot">·</span>v{appInfo.version}</span></footer>
    {deletingScene && <DeleteSceneDialog scene={project.scenes.find(s=>s.id===deletingScene)!} close={()=>setDeletingScene(null)} remove={removeScene}/> }
    {savingNew && <SaveNewDialog title={project.title} close={()=>setSavingNew(false)} save={title=>{void saveNew(title);}} busy={fileBusy}/>}
    {exiting && <ExitDialog close={()=>setExiting(false)} save={()=>{void saveAndClose();}} discard={()=>{void finishClose(true);}} busy={fileBusy||exitBusy}/>}
    {creating && <NewProjectDialog close={()=>setCreating(false)} create={title=>{setCreating(false);guard(()=>adopt(newProject(title),null,true));}}/>}
    {pending && <UnsavedDialog busy={fileBusy} close={()=>setPending(null)} save={()=>{void continueAfterSave();}} discard={()=>{const action=pending;setPending(null);void action();}}/>}
    {about && <About onClose={() => setAbout(false)}/>}{notice && <div role="status" className="toast">{notice}</div>}
    {playing && <Player project={project} initialSession={playing} initialEnded={endingPreview} onClose={() => setPlaying(null)}/>}
    {exporting && <ExportGame project={project} close={() => setExporting(false)}/>}
    <input hidden type="file" accept=".hinanastory,.hinana,.json" ref={importRef} onChange={async e => { try { const f = e.target.files?.[0]; if (f) { if (f.size > 80 * 1024 * 1024) throw new Error('프로젝트 크기가 너무 큽니다.'); await load(await f.text()); } } catch (e) { toast(e instanceof Error ? e.message : '파일을 읽지 못했습니다.'); } if (importRef.current) importRef.current.value = ''; }}/>
    <input hidden type="file" multiple accept="image/png,image/jpeg,image/webp" ref={assetRef} onChange={e => { importAssets(Array.from(e.target.files??[])); e.target.value = ''; }}/>
    <input hidden type="file" multiple accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/webm,.mp3,.wav,.ogg,.webm" ref={audioImportRef} onChange={e => { importAssets(Array.from(e.target.files??[])); e.target.value = ''; }}/>
  </div>;
}

export default function App(){const [ready,setReady]=useState(false);const [recovered,setRecovered]=useState<Recovery|null>(null);useEffect(()=>{let active=true;void readRecovery().then(value=>{if(active){setRecovered(value);setReady(true);}});return()=>{active=false;};},[]);return ready?<Workspace recovered={recovered}/>:<div className="recovery-loading">프로젝트를 불러오고 있습니다…</div>;}
