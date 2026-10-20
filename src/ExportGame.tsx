import { useEffect, useRef, useState } from 'react';
import { Download, FolderOpen, Globe, Monitor, Play, X } from 'lucide-react';
import { inspectFlow } from './flow';
import { parseProject, type Project } from './model';
import type { ExportEnvironment, ExportResult, ExportTarget, ExportFormat } from './bridge';
export default function ExportGame({ project, close }: { project: Project; close: () => void }) {
  const issues = inspectFlow(project), errors = issues.filter(i=>i.severity==='error');
  const ref = useRef<HTMLDialogElement>(null);
  const [environment,setEnvironment]=useState<ExportEnvironment|null>(null);
  const [target, setTarget] = useState<ExportTarget>(()=>navigator.platform.includes('Mac')?'macos':'windows');
  const [format,setFormat]=useState<ExportFormat>('directory'),[signing,setSigning]=useState<'local'|'distribution'>('local');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [result, setResult] = useState<ExportResult|null>(null),[opening,setOpening]=useState(false);
  useEffect(() => {
    const d = ref.current!, previous = document.activeElement as HTMLElement;d.showModal();let active=true;
    const unsubscribe = window.studio?.onExportProgress(setMessage);
    if(window.studio?.exportOptions)void window.studio.exportOptions().then(value=>{if(active)setEnvironment(value);}).catch(()=>{if(active)setMessage('내보내기 환경을 확인하지 못했습니다. 프로그램을 다시 실행해 주세요.');});
    else if(window.studio)setMessage('macOS 내보내기를 사용하려면 프로그램을 다시 실행해 주세요.');
    return () => { active=false;unsubscribe?.();d.close();previous?.focus(); };
  }, []);
  const macSupported=environment?.platform==='darwin'&&['arm64','x64'].includes(environment.arch);
  const architecture=environment?.arch==='arm64'?'Apple Silicon · arm64':environment?.arch==='x64'?'Intel · x64':'현재 Mac용';
  function select(value:ExportTarget){setTarget(value);setFormat('directory');setSigning('local');setResult(null);setMessage('');}
  async function run() {
    setBusy(true); setResult(null);
    try {
      const raw = JSON.stringify(project); parseProject(raw);
      if(errors.length)throw new Error('장면 연결 그래프에서 진행 오류를 먼저 해결해 주세요.');
      if (!window.studio) throw new Error('실행 중인 Electron 앱에서 작품을 내보내 주세요.');
      setMessage('내보낼 폴더를 선택해 주세요.');
      const result = await window.studio.exportGame({ project: raw, target, format, signing });
      if (result) { setResult(result); setMessage('내보내기를 완료했습니다.'); } else setMessage('내보내기를 취소했습니다.');
    } catch (e) { setMessage(e instanceof Error ? e.message : '내보내지 못했습니다.'); }
    finally { setBusy(false); }
  }
  async function openResult(launch:boolean){
    if(!result||!window.studio)return;setOpening(true);
    try{if(launch){await window.studio.launchGame(result.path);setMessage('게임을 실행했습니다. 별도 게임 창에서 플레이해 주세요.');}else await window.studio.revealExport(result.path);}
    catch(error){setMessage(error instanceof Error?error.message:'내보낸 작품을 열지 못했습니다.');}finally{setOpening(false);}
  }
  return <dialog ref={ref} className="player-panel export-panel" aria-label="작품 내보내기" onCancel={e => { e.preventDefault(); if (!busy&&!opening) close(); }}>
    <div className="player-panel-heading"><h2>작품 내보내기</h2><button disabled={busy||opening} onClick={close} aria-label="작품 내보내기 닫기"><X size={18}/></button></div>
    <p className="export-title">{project.title}</p><p className="control-help">제목 화면과 저장·불러오기가 포함된 게임을 만듭니다. 결과는 선택한 위치의 새 폴더에 저장됩니다.</p>
    <div className="export-targets">
      <button disabled={busy||opening||!macSupported} className={target==='macos'?'selected':''} onClick={()=>select('macos')}><Monitor size={24}/><strong>macOS 게임</strong><small>{macSupported?`${architecture} · 독립 .app`:'Mac에서 내보낼 수 있습니다'}</small></button>
      <button disabled={busy||opening} className={target === 'windows' ? 'selected' : ''} onClick={() => select('windows')}><Monitor size={24}/><strong>Windows 게임</strong><small>x64 · 실행 파일과 런타임 포함</small></button>
      <button disabled={busy||opening} className={target === 'web' ? 'selected' : ''} onClick={() => select('web')}><Globe size={24}/><strong>웹 게임</strong><small>정적 웹 호스팅용 폴더</small></button>
    </div>
    <p className="control-help">{target==='macos'?'현재 Mac과 같은 CPU용 앱을 만듭니다. 내보내기 후 게임 실행 버튼으로 바로 플레이할 수 있습니다. 첫 런타임 다운로드에는 인터넷 연결이 필요합니다.':target === 'windows' ? '처음 내보낼 때 Electron 런타임을 내려받으므로 인터넷 연결이 필요합니다. 배포할 때는 결과 폴더 전체를 전달해 주세요.' : '내보낸 폴더를 정적 웹 서버에 올려 실행합니다. 저장 데이터는 플레이한 브라우저에 보관됩니다.'}</p>
    <div className="export-format-grid"><label>배포 형식<select aria-label="배포 형식" disabled={busy||opening} value={format} onChange={e=>{setFormat(e.target.value as ExportFormat);setSigning('local');setResult(null);}}><option value="directory">{target==='macos'?'앱 폴더 (.app)':target==='windows'?'실행 폴더 (.exe + 런타임)':'정적 웹 폴더'}</option>{target==='macos'&&<><option value="zip">Mac 앱 ZIP 압축 파일</option><option value="dmg">Mac 설치 디스크 (.dmg)</option></>}{target==='windows'&&<><option value="installer">Windows 설치 프로그램 (.exe)</option><option value="portable">Windows 단일 실행 파일 (.exe)</option></>}</select></label>{target!=='web'&&<label>코드 서명<select aria-label="코드 서명" disabled={busy||opening} value={signing} onChange={e=>{setSigning(e.target.value as 'local'|'distribution');setResult(null);}}><option value="local">{target==='macos'?'로컬 실행용 임시 서명':'인증서 없이 빌드'}</option><option value="distribution" disabled={target==='macos'?!environment?.signing?.mac:!environment?.signing?.windows||format==='directory'}>설정된 배포 인증서 사용</option></select></label>}</div>
    {(format==='installer'||format==='portable')&&<p className="control-help">런타임이 포함된 실행 파일 하나를 전달할 수 있습니다. 처음에는 패키징 도구를 추가로 내려받습니다.</p>}
    {format==='dmg'&&<p className="control-help">디스크 이미지를 열어 게임 앱을 Applications에 복사할 수 있습니다. 원본 .app도 결과 폴더에 함께 보관합니다.</p>}
    <div className="export-flow-status">{issues.length>0&&<p className="control-help">연결 검사: 오류 {errors.length}건 · 확인 {issues.length-errors.length}건. 장면 연결 그래프에서 확인해 주세요.</p>}</div>
    <button className="primary" disabled={busy||opening||!window.studio||errors.length>0||target==='macos'&&!macSupported} onClick={run}><Download size={16}/>{busy ? '내보내는 중…' : '폴더 선택 후 내보내기'}</button>
    {!window.studio && <p className="control-help">작품 내보내기는 Electron 데스크톱 앱에서 사용할 수 있습니다.</p>}
    {message && <p role="status" className="export-status">{message}</p>}
    {result && <><pre className="export-result">{result.path}</pre>{result.artifactPath&&<p className="export-artifact">배포 파일: {result.artifactPath.split(/[\\/]/).at(-1)}</p>}<div className="export-result-actions">{result.launchable&&<button className="primary" disabled={opening} onClick={()=>{void openResult(true);}}><Play size={15}/>{opening?'여는 중…':'게임 실행'}</button>}<button disabled={opening} onClick={()=>{void openResult(false);}}><FolderOpen size={15}/>내보낸 폴더 열기</button></div></>}
  </dialog>;
}
