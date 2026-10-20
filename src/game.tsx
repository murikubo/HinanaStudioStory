import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { parseProject, type Project } from './model';
import Player from './Player';
import './style.css';
function Game() {
  const [project, setProject] = useState<Project | null>(null), [error, setError] = useState('');
  useEffect(() => { void (async () => { try { const raw = window.game ? await window.game.project() : await fetch('./story.json').then(r => { if (!r.ok) throw new Error('작품 파일을 찾지 못했습니다.'); return r.text(); }); const p = parseProject(raw); document.title = p.title; setProject(p); } catch (e) { setError(e instanceof Error ? e.message : '작품을 열지 못했습니다.'); } })(); }, []);
  return project ? <Player project={project}/> : <div className="game-loading">{error || '이야기를 준비하고 있습니다…'}</div>;
}
createRoot(document.getElementById('root')!).render(<Game/>);
