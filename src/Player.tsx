import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, FastForward, History, Home, Play, Save, Settings2, Volume2, VolumeX, X, Download, Upload, Trash2 } from 'lucide-react';
import { choose, matches, next, start, type Project, type Session } from './model';
import { parseSaves, serializeSaves, defaults, playKey, readData, readSettings, settingsKey, signature, snapshot, validSnapshot, type LogEntry, type PlayerData, type Settings, type Snapshot } from './player-store';
import { speaker } from './characters';
import PlayerAudio, {type VoiceStatus} from './PlayerAudio';
import GalleryPanel from './GalleryPanel';
import BranchDebugger from './BranchDebugger';
import {debugJump} from './debug';
import {unlockGallery} from './gallery';
import PlayerStage from './PlayerStage';
import EndingCredits from './EndingCredits';
import { thumbnail } from './thumbnail';
import './player-tools.css';
function Panel({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current!, previous = document.activeElement as HTMLElement; d.showModal(); return () => { d.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} className="player-panel" aria-label={title} onCancel={e => { e.preventDefault(); close(); }}><div className="player-panel-heading"><h2>{title}</h2><button autoFocus aria-label={`${title} 닫기`} onClick={close}><X size={18}/></button></div>{children}</dialog>;
}
export default function Player({ project, initialSession, initialEnded = false, onClose }: { project: Project; initialSession?: Session; initialEnded?: boolean; onClose?: () => void }) {
  const test = Boolean(onClose);
  const root = useRef<HTMLDivElement>(null),previewRef=useRef(initialEnded);
  useEffect(() => { const previous = document.activeElement as HTMLElement; root.current?.focus(); return () => previous?.focus(); }, []);
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  const [step, setStep] = useState(0), [ended, setEnded] = useState(initialEnded);
  const [panel, setPanel] = useState<'save' | 'load' | 'log' | 'settings' | 'gallery' | 'debug' | null>(null);
  const [data, setData] = useState<PlayerData>(() => readData(localStorage, project, test));
  const dataRef = useRef(data); dataRef.current = data;
  const [settings, setSettings] = useState<Settings>(() => readSettings(localStorage));
  const initialLine = initialSession && project.scenes.find(s => s.id === initialSession.sceneId)!.lines[initialSession.index];
  const [log, setLog] = useState<LogEntry[]>(initialLine ? [{ speaker: speaker(project,initialLine).name, text: initialLine.text, lineId: initialLine.id }] : []);
  const logRef = useRef(log); logRef.current = log;
  const [voiceState,setVoiceState]=useState<{step:number;status:VoiceStatus}>({step:-1,status:'idle'}),[voiceReplay,setVoiceReplay]=useState(0);
  const handleVoice=useCallback((status:VoiceStatus)=>setVoiceState({step,status}),[step]);
  const [typing, setTyping] = useState({ key: '', count: 0 });
  const [auto, setAuto] = useState(false), [skip, setSkip] = useState(false), [notice, setNotice] = useState('');
  const soundOnEntry = useRef(true),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const saveInput=useRef<HTMLInputElement>(null);const [incoming,setIncoming]=useState<PlayerData|null>(null);
  const entryScene = project.scenes.find(s=>s.id===project.startScene)??project.scenes[0];
  const scene = project.scenes.find(s => s.id === session?.sceneId) ?? project.scenes[0];
  const line = scene.lines[session?.index ?? 0];
  const key = `${step}:${line.id}`, characters = Array.from(line.text || '이야기를 입력해 보세요.');
  const visible = typing.key === key ? typing.count : 0;
  const complete = settings.speed === 0 || visible >= characters.length;
  const choices = line.choices.filter(c => session && matches(c.condition, session.variables));
  const read = data.read.includes(line.id);
  const active = Boolean(session) && !ended;
  const voiceStatus=voiceState.step===step?voiceState.status:line.voice&&active&&soundOnEntry.current?'loading':'idle';
  function persist(updated: PlayerData) {
    const value = { ...updated, signature: signature(project) };
    try { localStorage.setItem(playKey(project, test), JSON.stringify(value)); dataRef.current = value; setData(value); return true; }
    catch { setNotice('플레이 데이터를 저장하지 못했습니다. 저장 공간을 확인해 주세요.'); return false; }
  }
  function saveSlot(slot: string, state = session, entries = logRef.current, ending = ended) {
    if (!state||previewRef.current) return;
    const value=snapshot(project,state,entries,ending);
    const saved = persist({ ...dataRef.current, slots: { ...dataRef.current.slots, [slot]: value } });
    if(saved)void thumbnail(project,state,ending).then(image=>{if(alive.current&&dataRef.current.slots[slot]===value)persist({...dataRef.current,slots:{...dataRef.current.slots,[slot]:{...value,thumbnail:image}}});}).catch(()=>{});
    if (saved && slot !== 'auto') setNotice(slot === 'quick' ? '퀵세이브했습니다.' : `슬롯 ${slot}에 저장했습니다.`);
  }
  async function exportSaves(){try{const raw=serializeSaves(project,dataRef.current),bridge=window.game??window.studio;if(bridge?.savePlayData){if(await bridge.savePlayData(raw,project.title))setNotice('플레이 저장 파일을 내보냈습니다.');return;}const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`${project.title.replace(/[<>:"/\\|?*]/g,'-')}.hinanasave`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('플레이 저장 파일을 내보냈습니다.');}catch(error){setNotice(error instanceof Error?error.message:'저장 파일을 내보내지 못했습니다.');}}
  function readIncoming(raw:string){setIncoming(parseSaves(project,raw));}
  async function importSaves(file?:File){if(!file)return;try{if(file.size>16*1024*1024)throw Error('저장 파일은 16MB 이하여야 합니다.');readIncoming(await file.text());}catch(error){setNotice(error instanceof Error?error.message:'저장 파일을 읽지 못했습니다.');}}
  async function openSaves(){try{const bridge=window.game??window.studio;if(bridge?.openPlayData){const raw=await bridge.openPlayData();if(raw)readIncoming(raw);}else saveInput.current?.click();}catch(error){setNotice(error instanceof Error?error.message:'저장 파일을 열지 못했습니다.');}}
  function deleteSlot(slot:string){const slots={...dataRef.current.slots};delete slots[slot];if(persist({...dataRef.current,slots}))setNotice('저장 슬롯을 삭제했습니다.');}
  function restore(value: Snapshot) {
    if (!validSnapshot(project, value)) { setNotice('작품이 변경되어 이 저장 데이터를 사용할 수 없습니다.'); return; }
    previewRef.current=false;soundOnEntry.current = false;
    setSession(structuredClone(value.session)); setLog(value.log); setEnded(value.ended); setStep(s => s + 1); setPanel(null); setAuto(false); setSkip(false);
  }
  function visit(state: Session) {
    previewRef.current=false;
    const l = project.scenes.find(s => s.id === state.sceneId)!.lines[state.index];
    const entries = [...logRef.current, { speaker: speaker(project,l).name, text: l.text, lineId: l.id }].slice(-500);
    logRef.current = entries; soundOnEntry.current = true;
    setSession(state); setLog(entries); setStep(s => s + 1); setEnded(false);
    saveSlot('auto', state, entries, false);
  }
  function begin() { logRef.current = []; setAuto(false); setSkip(false); visit(start(project, project.startScene ?? project.scenes[0].id)); }
  function advance(choiceId?: string) {
    if (!session || panel || ended) return;
    if (!complete) { setTyping({ key, count: characters.length }); return; }
    if (line.type === 'choice' && !choiceId) return;
    try {
      const destination = choiceId ? choose(project, session, choiceId) : next(project, session);
      if (destination) visit(destination);
      else { saveSlot('auto', session, logRef.current, true); setAuto(false); setSkip(false); setEnded(true); }
    } catch (e) { setNotice(e instanceof Error ? e.message : '진행하지 못했습니다.'); }
  }
  function title() { if (session&&!previewRef.current) saveSlot('auto');previewRef.current=false; setSession(null); setPanel(null); setAuto(false); setSkip(false); setEnded(false); }
  useEffect(() => {
    if (!active || settings.speed === 0) return;
    const started = performance.now(); setTyping({ key, count: 0 });
    const timer = setInterval(() => { const count = Math.floor((performance.now() - started) / settings.speed); setTyping(previous => ({ key, count: previous.key === key ? Math.max(previous.count, count) : count })); if (count >= characters.length) clearInterval(timer); }, 16);
    return () => clearInterval(timer);
  }, [key, active, settings.speed]);
  useEffect(() => {
    if (active && complete && !dataRef.current.read.includes(line.id)) persist({ ...dataRef.current, read: [...dataRef.current.read, line.id] });
  }, [active, complete, line.id]);
  useEffect(() => {
    if (!active || panel || line.type === 'choice') return;
    if (skip && !read) { setSkip(false); return; }
    if (!complete && skip && read) { setTyping({ key, count: characters.length }); return; }
    if(line.voice&&!skip&&['loading','playing','blocked'].includes(voiceStatus))return;
    if (complete && (auto || skip && read || line.voiceAdvance&&voiceStatus==='ended')) { const timer = setTimeout(() => advance(), skip ? 100 : line.voiceAdvance&&voiceStatus==='ended'?350:settings.autoDelay); return () => clearTimeout(timer); }
  }, [key, complete, auto, skip, read, panel, active, settings.autoDelay,voiceStatus,line.voice,line.voiceAdvance]);
  useEffect(()=>{if(!session||previewRef.current)return;const unlocked=unlockGallery(project,session,ended,dataRef.current.unlocked??[]);if(unlocked.length!==(dataRef.current.unlocked??[]).length)persist({...dataRef.current,unlocked});},[step,ended,session?.sceneId,session?.index]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch { setNotice('설정을 저장하지 못했습니다.'); }
  }, [settings]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (panel || e.defaultPrevented) return;
      if (e.key === 'Escape') { e.preventDefault(); if (onClose) onClose(); else setPanel('settings'); return; }
      if ((e.target as HTMLElement)?.closest('input,textarea,select,dialog')) return;
      if (e.key === 'Tab') { const controls = Array.from(root.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')); const first = controls[0], last = controls.at(-1); if (e.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } return; }
      if ((e.code === 'Enter' || e.code === 'Space') && (e.target as HTMLElement)?.closest('button')) return;
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); advance(); }
      if (e.key === 'F5') { e.preventDefault(); saveSlot('quick'); }
      if (e.key === 'F9') { e.preventDefault(); if (dataRef.current.slots.quick) restore(dataRef.current.slots.quick); }
    }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  });
  const latest = Object.values(data.slots).sort((a,b) => b.savedAt.localeCompare(a.savedAt))[0];
  const patchSettings = (patch: Partial<Settings>) => setSettings(v => ({ ...v, ...patch }));
  return <div ref={root} tabIndex={-1} className="player play-modal" style={{'--player-accent':project.metadata?.accent??'#c0a7e2'} as React.CSSProperties} role="dialog" aria-modal="true" aria-label={test ? '플레이 테스트' : project.title}>
    <PlayerAudio project={project} scene={scene} line={line} active={active} musicActive={Boolean(session)} step={step} soundOnEntry={soundOnEntry.current} settings={settings} voiceReplay={voiceReplay} skipVoice={skip&&read} onVoiceState={handleVoice}/>
    {ended ? <EndingCredits project={project} scene={scene} onTitle={title} onClose={onClose} muted={settings.muted} onMute={()=>patchSettings({muted:!settings.muted})}/> : !session ? <div className="title-screen" style={{ backgroundImage: `linear-gradient(0deg,#14121ce8,#14121c88),url("${project.assets.find(a => a.id === (project.metadata?.titleBackground||entryScene.background))?.url ?? './classroom.svg'}")` }}><span className="title-eyebrow">A VISUAL NOVEL</span><h1>{project.title}</h1><p>{project.metadata?.subtitle||'당신의 선택으로 이어지는 이야기'}</p><div className="title-buttons"><button className="primary" onClick={begin}><Play size={16}/>처음부터 시작</button><button disabled={!latest} onClick={() => latest && restore(latest)}>이어하기</button><button onClick={() => setPanel('load')}>불러오기</button><button onClick={() => setPanel('settings')}>설정</button>{!!project.gallery?.length&&<button onClick={()=>setPanel('gallery')}>감상실</button>}{onClose && <button onClick={onClose}><X size={15}/>편집기로 돌아가기</button>}</div><small>{project.metadata?.author&&`${project.metadata.author} · `}{project.metadata?.releaseVersion&&`v${project.metadata.releaseVersion} · `}Hinana Studio Story</small></div> : <>
      <div className="play-top"><span><Play size={15}/>{test ? '플레이 테스트' : project.title}<small>{scene.title}</small></span><div className="play-actions"><button title={settings.muted ? 'BGM 음소거 해제' : 'BGM 음소거'} onClick={() => patchSettings({ muted: !settings.muted })}>{settings.muted ? <VolumeX size={16}/> : <Volume2 size={16}/>}</button><button onClick={title} title="제목 화면"><Home size={16}/></button>{onClose && <button onClick={onClose}><X size={17}/>닫기</button>}</div></div>
      <div className="play-viewport"><PlayerStage project={project} scene={scene} line={line} onAdvance={() => advance()}><div className="dialogue-box"><span className="speaker" style={{background:speaker(project,line).color}}>{speaker(project,line).name || (line.type === 'choice' ? '선택' : '내레이션')}</span><div className="dialogue-content"><p>{characters.slice(0, complete ? characters.length : visible).join('')}<span className="typing-caret" aria-hidden="true">{!complete ? '▏' : ''}</span></p>
        {line.type === 'choice' && complete && <div className="play-choices">{choices.map(c => <button key={c.id} onClick={() => advance(c.id)}>{c.text || '선택지'}<ChevronRight size={14}/></button>)}{!choices.length && <div className="dead-end"><small>현재 변수 값으로 선택할 수 있는 분기가 없습니다.</small><button onClick={() => onClose ? onClose() : title()}>테스트 종료</button></div>}</div>}
        {line.type === 'dialogue' && <button className="next-dialogue" onClick={() => advance()}>{!complete ? '대사 전체 보기' : session.index < scene.lines.length - 1 ? '다음' : scene.next ? '다음 장면' : '이야기 마치기'}<ChevronRight size={14}/></button>}
      </div></div></PlayerStage></div>
      {test && <div className="runtime-vars">{(project.variables ?? []).map(v => <span key={v.id}>{v.name}<b>{session.variables[v.id]}</b></span>)}</div>}
      <div className="player-toolbar"><button onClick={() => setPanel('save')}><Save size={14}/>저장</button><button onClick={() => setPanel('load')}>불러오기</button><button onClick={() => saveSlot('quick')}>퀵세이브</button><button disabled={!data.slots.quick} onClick={() => restore(data.slots.quick)}>퀵로드</button><span/><button onClick={() => { setAuto(v => !v); setSkip(false); }} className={auto ? 'active' : ''}><Play size={13}/>자동</button><button onClick={() => { if (!read) { setNotice('읽지 않은 대사에서는 스킵하지 않습니다.'); return; } setSkip(v => !v); setAuto(false); }} className={skip ? 'active' : ''}><FastForward size={14}/>읽은 대사 스킵</button><button onClick={() => { setPanel('log'); setAuto(false); setSkip(false); }}><History size={14}/>기록</button><button onClick={() => setPanel('settings')}><Settings2 size={14}/>설정</button></div>
      {line.voice&&<div className="voice-controls"><button onClick={()=>{setVoiceState({step,status:'loading'});setVoiceReplay(n=>n+1);}}>음성 다시 듣기</button><span>{voiceStatus==='playing'?'음성 재생 중':voiceStatus==='blocked'?'재생 버튼을 눌러 음성을 시작해 주세요.':voiceStatus==='failed'?'음성을 재생하지 못했습니다. 다음 버튼으로 진행할 수 있습니다.':''}</span></div>}{test&&<button className="debug-open" onClick={()=>{setAuto(false);setSkip(false);setPanel('debug');}}>분기 디버거</button>}
      <p className="play-hint">클릭·Enter·Space로 진행 · F5 퀵세이브 · F9 퀵로드{onClose ? ' · Esc로 종료' : ''}</p>
    </>}
    {(panel === 'save' || panel === 'load') && <Panel title={panel === 'save' ? '플레이 저장' : '플레이 불러오기'} close={() => setPanel(null)}><p className="control-help">작품 파일과 별도로 이 기기에 저장됩니다. 작품 내용이 바뀌면 이전 저장은 사용할 수 없습니다.</p><div className="save-file-actions"><button onClick={exportSaves}><Download size={14}/>저장 파일 내보내기</button><button onClick={()=>{void openSaves();}}><Upload size={14}/>저장 파일 가져오기</button></div><div className="save-slots">{['auto','quick','1','2','3','4','5','6'].map(slot => { const value = data.slots[slot]; const label = slot === 'auto' ? '자동 저장' : slot === 'quick' ? '퀵세이브' : `슬롯 ${slot}`; return <article className="save-card" key={slot}><button aria-label={`${label}${value?' · 저장 있음':' · 비어 있음'}`} disabled={panel === 'load' ? !value : !session || slot === 'auto'} onClick={() => panel === 'save' ? saveSlot(slot) : value && restore(value)}>{value?.thumbnail?<img src={value.thumbnail} alt=""/>:<div className="save-placeholder">{value?'미리보기 없음':'비어 있는 슬롯'}</div>}<strong>{label}</strong><span>{value ? new Date(value.savedAt).toLocaleString('ko-KR') : '비어 있음'}</span>{value && <small>{project.scenes.find(s => s.id === value.session.sceneId)?.title} · 블록 {value.session.index + 1}</small>}</button>{value&&<button className="delete-save" aria-label={`삭제: ${label}`} onClick={()=>deleteSlot(slot)}><Trash2 size={12}/></button>}</article>; })}</div></Panel>}
    {incoming&&<Panel title="저장 파일 가져오기" close={()=>setIncoming(null)}><p className="control-help">{Object.keys(incoming.slots).length}개 슬롯을 가져옵니다. 같은 번호의 기존 슬롯은 가져온 내용으로 교체됩니다. 현재 재생 위치는 유지됩니다.</p><div className="dialog-actions"><button onClick={()=>setIncoming(null)}>취소</button><button className="primary" onClick={()=>{if(persist({...dataRef.current,slots:{...dataRef.current.slots,...incoming.slots},read:[...new Set([...dataRef.current.read,...incoming.read])],unlocked:[...new Set([...(dataRef.current.unlocked??[]),...(incoming.unlocked??[])])]})){setIncoming(null);setNotice('플레이 저장 파일을 가져왔습니다.');}}}>가져오기</button></div></Panel>}
    <input hidden type="file" ref={saveInput} accept=".hinanasave,.json" onChange={e=>{void importSaves(e.target.files?.[0]);e.target.value='';}}/>
    {panel==='gallery'&&<Panel title="감상실" close={()=>setPanel(null)}><GalleryPanel project={project} unlocked={data.unlocked??[]} showEnding={entry=>{const scene=project.scenes.find(s=>s.id===entry.sceneId)!;try{const state={sceneId:scene.id,index:scene.lines.length-1,variables:Object.fromEntries((project.variables??[]).map(v=>[v.id,v.initial]))};previewRef.current=true;soundOnEntry.current=false;setSession(state);setEnded(true);setPanel(null);setAuto(false);setSkip(false);setStep(n=>n+1);}catch(e){setNotice(e instanceof Error?e.message:'엔딩을 불러오지 못했습니다.');}}}/></Panel>}
    {panel==='debug'&&test&&session&&<Panel title="분기 디버거" close={()=>setPanel(null)}><BranchDebugger project={project} session={session} setVariable={(id,value)=>{setSession(s=>s?{...s,variables:{...s.variables,[id]:value}}:s);setAuto(false);setSkip(false);}} jump={(id,index,apply)=>{try{visit(debugJump(project,session,id,index,apply));setPanel(null);setAuto(false);setSkip(false);}catch(e){setNotice(e instanceof Error?e.message:'이동하지 못했습니다.');}}}/></Panel>}
    {panel === 'log'  && <Panel title="대사 기록" close={() => setPanel(null)}><div className="backlog">{log.map((entry,i) => <article key={i}><strong>{entry.speaker || '내레이션'}</strong><p>{entry.text}</p></article>)}</div></Panel>}
    {panel === 'settings' && <Panel title="플레이 설정" close={() => setPanel(null)}><label>텍스트 속도 · {settings.speed === 0 ? '즉시 표시' : `${settings.speed}ms / 글자`}<input aria-label="텍스트 속도" type="range" min="0" max="100" step="5" value={settings.speed} onChange={e => patchSettings({ speed: Number(e.target.value) })}/></label><label>자동 진행 대기 · {(settings.autoDelay / 1000).toFixed(1)}초<input aria-label="자동 진행 대기" type="range" min="500" max="10000" step="100" value={settings.autoDelay} onChange={e => patchSettings({ autoDelay: Number(e.target.value) })}/></label><label>음악 음량 · {Math.round(settings.music * 100)}%<input aria-label="음악 음량" type="range" min="0" max="100" value={settings.music * 100} onChange={e => patchSettings({ music: Number(e.target.value) / 100 })}/></label><label>효과음 음량 · {Math.round(settings.sound * 100)}%<input aria-label="효과음 음량" type="range" min="0" max="100" value={settings.sound * 100} onChange={e => patchSettings({ sound: Number(e.target.value) / 100 })}/></label><label>음성 음량 · {Math.round(settings.voice*100)}%<input aria-label="음성 음량" type="range" min="0" max="100" value={settings.voice*100} onChange={e=>patchSettings({voice:Number(e.target.value)/100})}/></label><label className="check-label"><input aria-label="음성 재생 중 BGM 줄이기" type="checkbox" checked={settings.voiceDucking} onChange={e=>patchSettings({voiceDucking:e.target.checked})}/>음성 재생 중 BGM 줄이기</label><label className="check-label"><input type="checkbox" checked={settings.muted} onChange={e => patchSettings({ muted: e.target.checked })}/>모든 소리 음소거</label><button onClick={() => setSettings({ ...defaults })}>기본 설정으로 복원</button>{project.metadata&&<section className="game-info"><h3>작품 정보</h3><strong>{project.title}</strong><p>{project.metadata.description}</p><small>{project.metadata.author}{project.metadata.releaseVersion&&` · v${project.metadata.releaseVersion}`}</small><p>{project.metadata.copyright}</p></section>}</Panel>}
    {notice && <div role="status" className="toast player-toast">{notice}</div>}
  </div>;
}
