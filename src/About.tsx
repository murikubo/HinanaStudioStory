import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { appInfo } from './metadata';
export default function About({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; const previous = document.activeElement as HTMLElement | null; dialog.showModal(); return () => { dialog.close(); previous?.focus(); }; }, []);
  return <dialog className="about-dialog" ref={ref} aria-labelledby="about-title" onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); ref.current?.querySelector('button')?.focus(); } }} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    <button className="about-close icon" onClick={onClose} autoFocus aria-label="프로그램 정보 닫기"><X size={27}/></button>
    <img className="about-icon" src="./studio-icon.svg" alt="Hinana Studio Story 아이콘"/>
    <h2 id="about-title">{appInfo.heading}</h2><p className="about-tagline">{appInfo.tagline}</p>
    <dl><div><dt>프로그램 명</dt><dd>{appInfo.name}</dd></div><div><dt>개발/제작자</dt><dd>{appInfo.author}</dd></div><div><dt>버전</dt><dd>Ver. {appInfo.version}</dd></div></dl>
  </dialog>;
}
