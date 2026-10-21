import { useEffect, useRef, useState } from 'react';
import type { Line, Project, Scene } from './model';
import type { Settings } from './player-store';
export type VoiceStatus='idle'|'loading'|'playing'|'ended'|'blocked'|'failed';
export default function PlayerAudio({ project, scene, line, active, musicActive = active, step, soundOnEntry, settings,voiceReplay=0,skipVoice=false,onVoiceState }: { project: Project; scene: Scene; line: Line; active: boolean; musicActive?: boolean; step: number; soundOnEntry: boolean; settings: Settings;voiceReplay?:number;skipVoice?:boolean;onVoiceState?:(status:VoiceStatus)=>void }) {
  const music = useRef<HTMLAudioElement>(null), sound = useRef<HTMLAudioElement>(null),voice=useRef<HTMLAudioElement>(null);
  const [blocked, setBlocked] = useState(false),[speaking,setSpeaking]=useState(false);
  const target = useRef(0);
  target.current = settings.muted ? 0 : (scene.volume ?? 0.5) * settings.music*(speaking && settings.voiceDucking ? 0.3 : 1);
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
  useEffect(() => { music.current!.volume = target.current; music.current!.muted = settings.muted; sound.current!.volume = (line.sfxVolume ?? 1) * settings.sound; sound.current!.muted = settings.muted;voice.current!.volume=(line.voiceVolume??1)*settings.voice;voice.current!.muted=settings.muted; }, [settings.music, settings.sound,settings.voice,settings.voiceDucking,speaking, settings.muted, scene.volume, line.sfxVolume,line.voiceVolume]);
  useEffect(() => {
    const audio = sound.current!; audio.pause(); audio.removeAttribute('src');
    const asset = project.assets.find(a => a.id === line.sfx);
    if (active && asset && soundOnEntry) { audio.src = asset.url; void audio.play().catch(() => setBlocked(true)); }
    return () => audio.pause();
  }, [step, active, line.sfx]);
  const previousReplay=useRef(voiceReplay);
  useEffect(()=>{
    const audio=voice.current!,replaying=previousReplay.current!==voiceReplay;previousReplay.current=voiceReplay;
    let cancelled=false;audio.pause();audio.removeAttribute('src');setSpeaking(false);
    const asset=project.assets.find(a=>a.id===line.voice&&a.type==='audio');
    const status=(value:VoiceStatus)=>{if(!cancelled)onVoiceState?.(value);};
    audio.onplaying=()=>{if(!cancelled){setSpeaking(true);status('playing');}};
    audio.onended=()=>{if(!cancelled){setSpeaking(false);status('ended');}};
    audio.onerror=()=>{if(!cancelled){setSpeaking(false);status('failed');}};
    if(active&&asset&&!skipVoice&&(soundOnEntry||replaying)){
      status('loading');audio.src=asset.url;void audio.play().catch(()=>{if(!cancelled){setSpeaking(false);status(audio.error?'failed':'blocked');setBlocked(true);}});
    }else status('idle');
    return()=>{cancelled=true;audio.onplaying=null;audio.onended=null;audio.onerror=null;audio.pause();};
  },[step,active,line.voice,voiceReplay,skipVoice]);
  useEffect(() => { const a = music.current!, b = sound.current!,c=voice.current!; return () => { a.pause(); b.pause();c.pause(); }; }, []);
  return <><audio data-audio-role="music" ref={music} preload="auto"/><audio data-audio-role="sound" ref={sound} preload="auto"/><audio data-audio-role="voice" ref={voice} preload="auto"/>{blocked && musicActive && <button className="audio-retry" onClick={() => { const actions = [music.current, sound.current,voice.current].filter(a => a?.hasAttribute('src')&&!a.ended).map(a => a!.play()); void Promise.all(actions).then(() => setBlocked(false)).catch(() => setBlocked(true)); }}>음악·음성 재생 · 다시 시도</button>}</>;
}
