import type { Project } from './model';
export type Edge = { source: string; target: string; kind: 'choice' | 'next'; label: string; lineId?: string };
export type Issue = { severity: 'error' | 'warning'; message: string; sceneId: string; lineId?: string };
export function edges(p: Project): Edge[] {
  return p.scenes.flatMap(s => {
    const result: Edge[] = [];
    for (const l of s.lines) {
      if (l.type === 'choice') { result.push(...l.choices.map(c => ({ source: s.id, target: c.target, kind: 'choice' as const, label: c.text || '(빈 선택지)', lineId: l.id }))); break; }
    }
    if (!s.lines.some(l => l.type === 'choice') && s.next) result.push({ source: s.id, target: s.next, kind: 'next', label: '장면 끝 → 다음 장면' });
    return result;
  });
}
export function inspectFlow(p: Project): Issue[] {
  const issues: Issue[] = [], links = edges(p), ids = new Set(p.scenes.map(s => s.id));
  const reached = new Set<string>(), queue = [p.startScene ?? p.scenes[0].id];
  while (queue.length) { const id = queue.shift()!; if (reached.has(id)) continue; reached.add(id); for (const e of links) if (e.source === id && ids.has(e.target)) queue.push(e.target); }
  for (const s of p.scenes) {
    if (!reached.has(s.id)) issues.push({ severity: 'warning', sceneId: s.id, message: '시작 장면에서 도달할 수 없습니다.' });
    if (s.next && !ids.has(s.next)) issues.push({ severity: 'error', sceneId: s.id, message: '다음 장면의 연결 대상이 없습니다.' });
    let branched = false;
    for (const l of s.lines) {
      if (branched) { issues.push({ severity: 'warning', sceneId: s.id, lineId: l.id, message: '앞의 선택지에서 다른 장면으로 이동하므로 이 블록에 도달하지 못합니다.' }); continue; }
      if (l.type !== 'choice') continue;
      branched = true;
      if (!l.choices.length) issues.push({ severity: 'error', sceneId: s.id, lineId: l.id, message: '선택지가 비어 있어 이야기가 진행되지 않습니다.' });
      if (l.choices.length && l.choices.every(c => c.condition)) issues.push({ severity: 'warning', sceneId: s.id, lineId: l.id, message: '모든 선택지에 조건이 있습니다. 조건이 모두 거짓일 때 진행할 수 없습니다.' });
      for (const c of l.choices) if (!ids.has(c.target)) issues.push({ severity: 'error', sceneId: s.id, lineId: l.id, message: `선택지 “${c.text}”의 연결 대상이 없습니다.` });
    }
    if (branched && s.next) issues.push({ severity: 'warning', sceneId: s.id, message: '선택지 분기가 먼저 실행되어 장면의 기본 다음 연결은 사용되지 않습니다.' });
  }
  if (!p.scenes.some(s => reached.has(s.id) && !s.next && !s.lines.some(l => l.type === 'choice'))) issues.push({ severity: 'warning', sceneId: p.startScene ?? p.scenes[0].id, message: '시작 장면에서 연결된 종료 장면이 없습니다. 의도한 순환인지 확인해 주세요.' });
  return issues;
}
