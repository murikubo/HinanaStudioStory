import { useEffect, useRef, useState, type ReactNode } from 'react';
import Cast from './Cast';
import type { Line, Project, Scene } from './model';
export default function PlayerStage({ project, scene, line, children, onAdvance }: { project: Project; scene: Scene; line: Line; children: ReactNode; onAdvance: () => void }) {
  const background = project.assets.find(a => a.id === scene.background)?.url ?? './classroom.svg';
  const previousBg = useRef(background);
  const [outgoingBg, setOutgoingBg] = useState('');
  const duration = scene.duration ?? 500, transition = scene.transition ?? 'fade';
  useEffect(() => {
    if (previousBg.current === background) return;
    setOutgoingBg(transition !== 'none' ? previousBg.current : '');
    previousBg.current = background;
    const timer = setTimeout(() => setOutgoingBg(''), duration);
    return () => clearTimeout(timer);
  }, [background, duration, transition]);
  return <div className={`stage large player-stage transition-${transition}`} style={{ backgroundImage: `url("${background}")`, '--transition-time': `${duration}ms` } as React.CSSProperties} tabIndex={0} onClick={e => { if (!(e.target as HTMLElement).closest('button')) { e.currentTarget.focus({ preventScroll: true }); onAdvance(); } }}>
    {outgoingBg && <div className={`outgoing-background transition-${transition}`} style={{ backgroundImage: `url("${outgoingBg}")` }}/>}
    <div className="stage-vignette"/>
    <Cast project={project} scene={scene} line={line} animated/>
    {children}
  </div>;
}
