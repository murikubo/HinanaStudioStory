import { useEffect, useRef, useState } from 'react';
import type { Line, Project, Scene } from './model';
import type { Settings } from './player-store';
export default function PlayerAudio({ project, scene, line, active, musicActive = active, step, soundOnEntry, settings }: { project: Project; scene: Scene; line: Line; active: boolean; musicActive?: boolean; step: number; soundOnEntry: boolean; settings: Settings }) {
  const music = useRef<HTMLAudioElement>(null), sound = useRef<HTMLAudioElement>(null);
  const [blocked, setBlocked] = useState(false);
  const target = useRef(0);
  target.current = settings.muted ? 0 : (scene.volume ?? 0.5) * settings.music;
  const track = musicActive ? project.assets.find(a => a.id === scene.bgm)?.url : undefined;
  useEffect(() => {
    const audio = music.current!;
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    const fade = (to: () => number, duration: number) => new Promise<void>(resolve => {
      const from = audio.volume, started = performance.now();
      const tick = () => {
        if (cancelled) { resolve(); return; }
        const progress = duration ? Math.min(1, (performance.now() - started) / duration) : 1;
        audio.volume = Math.max(0, Math.min(1, from + (to() - from) * progress));
        if (progress < 1) timer = setTimeout(tick, 16); else resolve();
      }; tick();
    });
    setBlocked(false);
    void (async () => {
      const duration = scene.bgmFade ?? 400;
      if (audio.hasAttribute('src')) await fade(() => 0, duration / 2);
      if (cancelled) return;
      audio.pause();
      if (!track) { audio.removeAttribute('src'); audio.load(); return; }
      audio.src = track; audio.volume = 0;
      try { await audio.play(); if (!cancelled) await fade(() => target.current, duration / 2); }
      catch { if (!cancelled) setBlocked(true); }
    })();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [track]);
  useEffect(() => { music.current!.loop = scene.loop ?? true; }, [scene.loop]);
  useEffect(() => { music.current!.volume = target.current; music.current!.muted = settings.muted; sound.current!.volume = (line.sfxVolume ?? 1) * settings.sound; sound.current!.muted = settings.muted; }, [settings.music, settings.sound, settings.muted, scene.volume, line.sfxVolume]);
  useEffect(() => {
    const audio = sound.current!; audio.pause(); audio.removeAttribute('src');
    const asset = project.assets.find(a => a.id === line.sfx);
    if (active && asset && soundOnEntry) { audio.src = asset.url; void audio.play().catch(() => setBlocked(true)); }
    return () => audio.pause();
  }, [step, active, line.sfx]);
  useEffect(() => { const a = music.current!, b = sound.current!; return () => { a.pause(); b.pause(); }; }, []);
  return <><audio ref={music} preload="auto"/><audio ref={sound} preload="auto"/>{blocked && musicActive && <button className="audio-retry" onClick={() => { const actions = [music.current, sound.current].filter(a => a?.hasAttribute('src')).map(a => a!.play()); void Promise.all(actions).then(() => setBlocked(false)).catch(() => setBlocked(true)); }}>음악 재생 · 다시 시도</button>}</>;
}
