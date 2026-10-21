export type Position = 'left' | 'center' | 'right';
export type Operator = '==' | '!=' | '>' | '>=' | '<' | '<=';
export type Condition = { variableId: string; operator: Operator; value: number };
export type Effect = { variableId: string; operation: 'set' | 'add'; value: number };
export type Variable = { id: string; name: string; initial: number };
export type Choice = { id: string; text: string; target: string; condition?: Condition };
export type Expression = { id: string; name: string; assetId: string };
export type Character = { id: string; name: string; color: string; expressions: Expression[]; defaultExpression?: string };
export type Placement = { characterId: string; expressionId?: string; position: Position; scale: number; layer: number; x?: number; y?: number; visible?: boolean };
export type Transition = 'none' | 'fade' | 'slide';
export type Line = { id: string; type: 'dialogue' | 'choice'; speaker: string; text: string; choices: Choice[]; character?: string; position?: Position; characterX?: number; characterY?: number; effects?: Effect[]; sfx?: string; sfxVolume?: number; voice?: string; voiceVolume?: number; voiceAdvance?: boolean; speakerId?: string; cast?: Placement[] };
export type Scene = { id: string; title: string; background: string; character: string; lines: Line[]; position?: Position; characterScale?: number; characterX?: number; characterY?: number; bgm?: string; volume?: number; loop?: boolean; transition?: Transition; duration?: number; characterMotion?: Transition; bgmFade?: number; next?: string; cast?: Placement[] };
export type Asset = { id: string; name: string; type: 'background' | 'character' | 'audio'; url: string };
export type ProjectMetadata = { author?:string; description?:string; releaseVersion?:string; copyright?:string; subtitle?:string; titleBackground?:string; icon?:string; accent?:string; credits?:string; endingMessage?:string; creatorLogo?:string };
export type GalleryEntry = {id:string;title:string;kind:'cg'|'ending';sceneId:string;lineId?:string;assetId?:string};
export type Project = { version: 1; title: string; scenes: Scene[]; assets: Asset[]; variables?: Variable[]; id?: string; startScene?: string; characters?: Character[]; storage?: 'embedded' | 'external'; gallery?: GalleryEntry[]; metadata?: ProjectMetadata };
export type Session = { sceneId: string; index: number; variables: Record<string, number> };
export const uid = () => crypto.randomUUID();
export const newLine = (type: Line['type'] = 'dialogue'): Line => ({ id: uid(), type, speaker: '', text: '', choices: [] });
export const newScene = (n: number): Scene => ({ id: uid(), title: `새로운 장면 ${n}`, background: 'default', character: '', lines: [newLine()] });
export function demo(): Project {
  const a = uid(), b = uid(), c = uid();
  return { version: 1, id:a, title: '여름의 끝에서', assets: [], scenes: [
    { id: a, title: '프롤로그 · 다시 만난 여름', background: 'default', character: '', lines: [
      { id: uid(), type: 'dialogue', speaker: '', text: '여름의 끝자락. 익숙한 교실에는 오후의 빛이 내려앉아 있었다.', choices: [] },
      { id: uid(), type: 'dialogue', speaker: '하루', text: '있잖아, 우리 이 여름을 조금만 더 붙잡아 볼까?', choices: [] },
      { id: uid(), type: 'choice', speaker: '', text: '어떤 대답을 할까요?', choices: [{ id: uid(), text: '함께 추억을 만들자고 한다', target: b }, { id: uid(), text: '조금 더 이야기를 들어본다', target: c }] }
    ] },
    { id: b, title: '01 · 작은 약속', background: 'default', character: '', lines: [{ id: uid(), type: 'dialogue', speaker: '하루', text: '좋아. 그럼 내일, 같은 시간에 여기서 만나!', choices: [] }] },
    { id: c, title: '02 · 하지 못한 말', background: 'default', character: '', lines: [{ id: uid(), type: 'dialogue', speaker: '하루', text: '사실은… 너에게 꼭 하고 싶은 말이 있었어.', choices: [] }] }
  ] };
}
export function parseProject(raw: string): Project {
  const p = JSON.parse(raw);
  const str = (v: unknown): v is string => typeof v === 'string';
  const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const fail = (): never => { throw new Error('올바른 Hinana 프로젝트 파일이 아닙니다.'); };
  const object = (v: unknown) => v && typeof v === 'object' && !Array.isArray(v);
  if (!object(p) || p.version !== 1 || !str(p.title) || !Array.isArray(p.scenes) || !p.scenes.length || !Array.isArray(p.assets)) return fail();
  if(p.storage !== undefined && !['embedded','external'].includes(p.storage))fail();
  if(p.characters !== undefined && !Array.isArray(p.characters))fail();
  if (p.id !== undefined && (!str(p.id) || !p.id)) fail();
  if (p.variables !== undefined && !Array.isArray(p.variables)) fail();
  const ids = new Set<string>(), names = new Set<string>();
  const unique = (id: unknown) => { if (!str(id) || !id || ids.has(id)) fail(); ids.add(id as string); };
  for (const v of p.variables ?? []) {
    if (!object(v)) fail(); unique(v.id);
    if (!str(v.name) || !v.name.trim() || names.has(v.name) || !number(v.initial)) fail(); names.add(v.name);
  }
  const variable = (id: unknown) => (p.variables ?? []).some((v: Variable) => v.id === id);
  const coordinate = (v: unknown) => v === undefined || number(v) && v >= 0 && v <= 100;
  const position = (v: unknown) => v === undefined || ['left','center','right'].includes(v as string);
  for (const a of p.assets) {
    if (!object(a)) fail(); unique(a.id);
    if (!str(a.name) || !str(a.url) || !['background','character','audio'].includes(a.type)) fail();
    if (!(a.type === 'audio' ? /^data:audio\/(mpeg|mp3|wav|x-wav|wave|ogg|webm);base64,/ : /^data:image\/(png|jpeg|webp);base64,/).test(a.url)) fail();
  }
  const image = (id: unknown) => p.assets.some((a: Asset) => a.id === id && a.type !== 'audio');
  if(p.metadata!==undefined){
    if(!object(p.metadata))fail();
    for(const key of ['author','description','releaseVersion','copyright','subtitle','titleBackground','icon','accent','credits','endingMessage','creatorLogo'])if(p.metadata[key]!==undefined&&(!str(p.metadata[key])||p.metadata[key].length>8000))fail();
    const m=p.metadata;
    if(m.releaseVersion&&(!/^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(m.releaseVersion)||m.releaseVersion.split('.').some((n:string)=>Number(n)>65535)))fail();
    if(m.accent&&!/^#[0-9a-f]{6}$/i.test(m.accent))fail();
    for(const key of ['titleBackground','icon','creatorLogo'])if(m[key]&&!image(m[key]))fail();
  }
  for(const c of p.characters??[]){
    if(!object(c))fail();unique(c.id);
    if(!str(c.name)||!c.name.trim()||!str(c.color)||!/^#[0-9a-f]{6}$/i.test(c.color)||!Array.isArray(c.expressions))fail();
    for(const e of c.expressions){if(!object(e))fail();unique(e.id);if(!str(e.name)||!e.name.trim()||!image(e.assetId))fail();}
    if(c.defaultExpression!==undefined&&c.defaultExpression!==''&&!c.expressions.some((e:Expression)=>e.id===c.defaultExpression))fail();
  }
  const cast=(values:unknown)=>{
    if(values===undefined)return;if(!Array.isArray(values))return fail();const seen=new Set();
    for(const v of values){
      if(!object(v)||seen.has(v.characterId))fail();seen.add(v.characterId);
      const c=(p.characters??[]).find((c:Character)=>c.id===v.characterId);
      if(!c||!['left','center','right'].includes(v.position)||!number(v.scale)||v.scale<30||v.scale>120||!number(v.layer)||!Number.isInteger(v.layer)||v.layer<0||v.layer>99)fail();
      if(!coordinate(v.x)||!coordinate(v.y))fail();
      if(v.expressionId!==undefined&&v.expressionId!==''&&!c.expressions.some((e:Expression)=>e.id===v.expressionId))fail();
      if(v.visible!==undefined&&typeof v.visible!=='boolean')fail();
    }
  };
  const sceneIds = new Set(p.scenes.map((s: Scene) => s?.id));
  if (p.startScene !== undefined && !sceneIds.has(p.startScene)) fail();
  for (const s of p.scenes) {
    if (!object(s)) fail(); unique(s.id);
    if (!str(s.title) || !str(s.background) || !str(s.character) || !Array.isArray(s.lines) || !s.lines.length || !position(s.position)) fail();
    if (s.background !== 'default' && !image(s.background) || s.character && !image(s.character)) fail();
    cast(s.cast);
    if(!coordinate(s.characterX)||!coordinate(s.characterY))fail();
    if (s.next !== undefined && s.next !== '' && !sceneIds.has(s.next)) fail();
    if (s.characterScale !== undefined && (!number(s.characterScale) || s.characterScale < 30 || s.characterScale > 120)) fail();
    if (s.bgm !== undefined && s.bgm !== '' && !p.assets.some((a: Asset) => a.id === s.bgm && a.type === 'audio')) fail();
    if (s.volume !== undefined && (!number(s.volume) || s.volume < 0 || s.volume > 1)) fail();
    if (s.loop !== undefined && typeof s.loop !== 'boolean') fail();
    if (s.transition !== undefined && !['none','fade','slide'].includes(s.transition)) fail();
    if (s.characterMotion !== undefined && !['none','fade','slide'].includes(s.characterMotion)) fail();
    for (const key of ['duration','bgmFade']) if (s[key] !== undefined && (!number(s[key]) || s[key] < 0 || s[key] > 3000)) fail();
    for (const l of s.lines) {
      if (!object(l)) fail(); unique(l.id);
      if (!['dialogue','choice'].includes(l.type) || !str(l.speaker) || !str(l.text) || !Array.isArray(l.choices) || !position(l.position)) fail();
      cast(l.cast);
      if(!coordinate(l.characterX)||!coordinate(l.characterY))fail();
      if(l.speakerId!==undefined&&l.speakerId!==''&&!(p.characters??[]).some((c:Character)=>c.id===l.speakerId))fail();
      if (l.character !== undefined && l.character !== '' && l.character !== '__none' && !image(l.character)) fail();
      if (l.sfx !== undefined && l.sfx !== '' && !p.assets.some((a: Asset) => a.id === l.sfx && a.type === 'audio')) fail();
      if (l.sfxVolume !== undefined && (!number(l.sfxVolume) || l.sfxVolume < 0 || l.sfxVolume > 1)) fail();
      if(l.voice!==undefined&&l.voice!==''&&!p.assets.some((a:Asset)=>a.id===l.voice&&a.type==='audio'))fail();
      if(l.voiceVolume!==undefined&&(!number(l.voiceVolume)||l.voiceVolume<0||l.voiceVolume>1))fail();
      if(l.voiceAdvance!==undefined&&typeof l.voiceAdvance!=='boolean')fail();
      if (l.effects !== undefined && !Array.isArray(l.effects)) fail();
      for (const e of l.effects ?? []) if (!object(e) || !variable(e.variableId) || !['set','add'].includes(e.operation) || !number(e.value)) fail();
      for (const c of l.choices) {
        if (!object(c)) fail(); unique(c.id);
        if (!str(c.text) || !sceneIds.has(c.target)) fail();
        const q = c.condition;
        if (q !== undefined && (!object(q) || !variable(q.variableId) || !['==','!=','>','>=','<','<='].includes(q.operator) || !number(q.value))) fail();
      }
    }
  }
  if(p.gallery!==undefined){
    if(!Array.isArray(p.gallery)||p.gallery.length>500)fail();
    for(const entry of p.gallery){if(!object(entry))fail();unique(entry.id);if(!str(entry.title)||!entry.title.trim()||entry.title.length>500||!['cg','ending'].includes(entry.kind))fail();
      const scene=p.scenes.find((s:Scene)=>s.id===entry.sceneId);if(!scene)fail();
      if(entry.lineId!==undefined&&!scene.lines.some((l:Line)=>l.id===entry.lineId))fail();
      if(entry.assetId!==undefined&&entry.assetId!==''&&!image(entry.assetId))fail();if(entry.kind==='cg'&&!image(entry.assetId))fail();
    }
  }
  return p;
}
export function advance(p: Project, sceneId: string, index: number): { sceneId: string; index: number } | null {
  const s = p.scenes.find(s => s.id === sceneId);
  if (!s || index < 0 || !s.lines[index] || s.lines[index].type === 'choice') return null;
  if (index < s.lines.length - 1) return { sceneId, index: index + 1 };
  return s.next && p.scenes.some(scene => scene.id === s.next) ? { sceneId: s.next, index: 0 } : null;
}
export function matches(condition: Condition | undefined, values: Record<string, number>): boolean {
  if (!condition) return true;
  const left = values[condition.variableId], right = condition.value;
  if (left === undefined) return false;
  switch (condition.operator) {
    case '==': return left === right;
    case '!=': return left !== right;
    case '>': return left > right;
    case '>=': return left >= right;
    case '<': return left < right;
    case '<=': return left <= right;
  }
}
export function enter(p: Project, sceneId: string, index: number, values: Record<string, number>): Session {
  const line = p.scenes.find(s => s.id === sceneId)?.lines[index];
  if (!line) throw new Error('이동할 블록이 없습니다.');
  const variables = { ...values };
  for (const e of line.effects ?? []) {
    const value = e.operation === 'set' ? e.value : (variables[e.variableId] ?? 0) + e.value;
    if (!Number.isFinite(value)) throw new Error('변수 값이 숫자 범위를 초과했습니다.');
    variables[e.variableId] = value;
  }
  return { sceneId, index, variables };
}
export function start(p: Project, sceneId: string, index = 0): Session {
  let session: Session = { sceneId, index: 0, variables: Object.fromEntries((p.variables ?? []).map(v => [v.id, v.initial])) };
  // A block preview replays preceding block effects in this scene.
  for (let i = 0; i <= index; i++) session = enter(p, sceneId, i, session.variables);
  return session;
}
export function next(p: Project, session: Session): Session | null {
  const dest = advance(p, session.sceneId, session.index);
  return dest ? enter(p, dest.sceneId, dest.index, session.variables) : null;
}
export function choose(p: Project, session: Session, choiceId: string): Session {
  const line = p.scenes.find(s => s.id === session.sceneId)?.lines[session.index];
  const choice = line?.type === 'choice' && line.choices.find(c => c.id === choiceId);
  if (!choice || !matches(choice.condition, session.variables)) throw new Error('선택할 수 없는 분기입니다.');
  return enter(p, choice.target, 0, session.variables);
}
export function removeVariable(p: Project, id: string): Project {
  return { ...p, variables: (p.variables ?? []).filter(v => v.id !== id), scenes: p.scenes.map(s => ({ ...s, lines: s.lines.map(l => ({ ...l, effects: l.effects?.filter(e => e.variableId !== id), choices: l.choices.map(c => c.condition?.variableId === id ? { ...c, condition: undefined } : c) })) })) };
}

export function newProject(title: string): Project {
  const scene = newScene(1);
  return { version: 1, id: uid(), title: title.trim() || '새로운 이야기', scenes: [scene], startScene: scene.id, assets: [], variables: [] };
}
export function reorderScenes(p: Project, id: string, beforeId: string): Project {
  if (id === beforeId || !p.scenes.some(s => s.id === id) || !p.scenes.some(s => s.id === beforeId)) return p;
  const scenes = p.scenes.filter(s => s.id !== id), source = p.scenes.find(s => s.id === id)!;
  scenes.splice(scenes.findIndex(s => s.id === beforeId), 0, source);
  return { ...p, startScene: p.startScene ?? p.scenes[0].id, scenes };
}
export function deleteScene(p: Project, id: string): Project {
  if (p.scenes.length < 2 || !p.scenes.some(s => s.id === id)) return p;
  const scenes = p.scenes.filter(s => s.id !== id).map(s => ({ ...s, next: s.next === id ? '' : s.next, lines: s.lines.map(l => ({ ...l, choices: l.choices.filter(c => c.target !== id) })) }));
  return { ...p, ...(p.gallery?{gallery:p.gallery.filter(e=>e.sceneId!==id)}:{}), startScene: (p.startScene ?? p.scenes[0].id) === id ? scenes[0].id : p.startScene, scenes };
}
export function cloneLines(lines: Line[]): Line[] {
  return structuredClone(lines).map(l => ({ ...l, id: uid(), choices: l.choices.map(c => ({ ...c, id: uid() })) }));
}
export function orderBlocks(p: Project, sceneId: string, ids: string[], direction: 'up' | 'down' | string): Project {
  const scene = p.scenes.find(s => s.id === sceneId); if (!scene) return p;
  const selected = new Set(ids), lines = [...scene.lines];
  if (direction === 'up') { for (let i = 1; i < lines.length; i++) if (selected.has(lines[i].id) && !selected.has(lines[i-1].id)) [lines[i-1], lines[i]] = [lines[i], lines[i-1]]; }
  else if (direction === 'down') { for (let i = lines.length - 2; i >= 0; i--) if (selected.has(lines[i].id) && !selected.has(lines[i+1].id)) [lines[i], lines[i+1]] = [lines[i+1], lines[i]]; }
  else {
    if (selected.has(direction) || !lines.some(l => l.id === direction)) return p;
    const remaining = lines.filter(l => !selected.has(l.id)), moving = lines.filter(l => selected.has(l.id));
    remaining.splice(remaining.findIndex(l => l.id === direction),0,...moving);
    return { ...p, scenes: p.scenes.map(s => s.id === sceneId ? { ...s, lines: remaining } : s) };
  }
  return { ...p, scenes: p.scenes.map(s => s.id === sceneId ? { ...s, lines } : s) };
}
export function transferBlocks(p: Project, sourceId: string, ids: string[], targetId: string, copy: boolean): Project {
  const source = p.scenes.find(s => s.id === sourceId), target = p.scenes.find(s => s.id === targetId);
  if (!source || !target || sourceId === targetId && !copy) return p;
  const selected = source.lines.filter(l => ids.includes(l.id)); if (!selected.length) return p;
  const items = copy ? cloneLines(selected) : selected;
  return { ...p, scenes: p.scenes.map(s => {
    if (s.id === targetId) return { ...s, lines: [...s.lines, ...items] };
    if (s.id === sourceId && !copy) { const lines = s.lines.filter(l => !ids.includes(l.id)); return { ...s, lines: lines.length ? lines : [newLine()] }; }
    return s;
  }) };
}

export function reconcileGallery(p:Project):Project{
 if(!p.gallery)return p;let changed=false;
 const entries=p.gallery.flatMap(e=>{
  if(e.lineId){const scene=p.scenes.find(s=>s.lines.some(l=>l.id===e.lineId));if(!scene){changed=true;return [];}if(e.sceneId!==scene.id){changed=true;return [{...e,sceneId:scene.id}];}}
  else if(!p.scenes.some(s=>s.id===e.sceneId)){changed=true;return [];}return [e];
 });return changed?{...p,gallery:entries}:p;
}
