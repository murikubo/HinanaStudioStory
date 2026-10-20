import type { Project, Session } from './model';
export type LogEntry = { speaker: string; text: string; lineId: string };
export type Snapshot = { version: 1; signature: string; savedAt: string; lineId: string; session: Session; log: LogEntry[]; ended: boolean; thumbnail?:string };
export type PlayerData = { signature?: string; slots: Record<string, Snapshot>; read: string[] };
export type Settings = { speed: number; autoDelay: number; music: number; sound: number; muted: boolean };
export const defaults: Settings = { speed: 30, autoDelay: 1800, music: 1, sound: 1, muted: false };
export const settingsKey = 'hinana:player:settings:v1';
export function signature(p: Project): string {
  const raw = JSON.stringify({ startScene: p.startScene, scenes: p.scenes, variables: p.variables, assets: p.assets.map(a => ({ id: a.id, name: a.name, type: a.type })) });
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619);
  return `${p.scenes[0].id}:${(hash >>> 0).toString(16)}`;
}
export function playKey(p: Project, test = false) { return `hinana:play:${test ? 'test' : 'game'}:${p.id ?? p.scenes[0].id}`; }
export function validSnapshot(p: Project, s: unknown): s is Snapshot {
  if (!s || typeof s !== 'object') return false;
  const v = s as Snapshot, scene = p.scenes.find(scene => scene.id === v.session?.sceneId);
  if (v.version !== 1 || v.signature !== signature(p) || !scene || !Number.isInteger(v.session.index) || scene.lines[v.session.index]?.id !== v.lineId) return false;
  if (typeof v.savedAt !== 'string' || !Number.isFinite(Date.parse(v.savedAt)) || typeof v.ended !== 'boolean') return false;
  if(v.thumbnail!==undefined&&(typeof v.thumbnail!=='string'||v.thumbnail.length>100000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v.thumbnail)))return false;
  if (!v.session.variables || typeof v.session.variables !== 'object' || Array.isArray(v.session.variables)) return false;
  if (!(p.variables ?? []).every(variable => typeof v.session.variables[variable.id] === 'number' && Number.isFinite(v.session.variables[variable.id]))) return false;
  if (!Object.values(v.session.variables).every(n => typeof n === 'number' && Number.isFinite(n))) return false;
  return Array.isArray(v.log) && v.log.length <= 500 && v.log.every(l => l && typeof l.speaker === 'string' && typeof l.text === 'string' && typeof l.lineId === 'string');
}
export function readData(storage: Pick<Storage, 'getItem'>, p: Project, test = false): PlayerData {
  try {
    const raw = JSON.parse(storage.getItem(playKey(p, test)) ?? '{}');
    const ids = new Set(p.scenes.flatMap(s => s.lines.map(l => l.id)));
    const slots = Object.fromEntries(Object.entries(raw.slots ?? {}).filter(([key, v]) => /^(auto|quick|[1-6])$/.test(key) && validSnapshot(p, v)));
    const read = raw.signature === signature(p) && Array.isArray(raw.read) ? raw.read.filter((id: unknown) => typeof id === 'string' && ids.has(id)) : [];
    return { signature: signature(p), slots: slots as Record<string, Snapshot>, read };
  } catch { return { slots: {}, read: [] }; }
}
export function readSettings(storage: Pick<Storage, 'getItem'>): Settings {
  try {
    const raw = JSON.parse(storage.getItem(settingsKey) ?? '{}');
    const limit = (key: keyof Settings, min: number, max: number) => typeof raw[key] === 'number' && Number.isFinite(raw[key]) ? Math.min(max, Math.max(min, raw[key])) : defaults[key];
    return { speed: limit('speed', 0, 100) as number, autoDelay: limit('autoDelay', 500, 10000) as number, music: limit('music',0,1) as number, sound: limit('sound',0,1) as number, muted: typeof raw.muted === 'boolean' ? raw.muted : false };
  } catch { return { ...defaults }; }
}
export function snapshot(p: Project, session: Session, log: LogEntry[], ended = false): Snapshot {
  return { version: 1, signature: signature(p), lineId: p.scenes.find(s => s.id === session.sceneId)!.lines[session.index].id, session: structuredClone(session), log: log.slice(-500), ended, savedAt: new Date().toISOString() };
}
export type SaveFile={format:'HinanaStudioStorySave';version:1;projectId:string;signature:string;data:PlayerData};
export function serializeSaves(p:Project,data:PlayerData):string{return JSON.stringify({format:'HinanaStudioStorySave',version:1,projectId:p.id??p.scenes[0].id,signature:signature(p),data} satisfies SaveFile,null,2);}
export function parseSaves(p:Project,raw:string):PlayerData{
 if(new TextEncoder().encode(raw).length>16*1024*1024)throw Error('저장 파일은 16MB 이하여야 합니다.');
 const value=JSON.parse(raw);
 if(value?.format!=='HinanaStudioStorySave'||value.version!==1||value.projectId!==(p.id??p.scenes[0].id)||value.signature!==signature(p))throw Error('현재 작품과 호환되는 저장 파일이 아닙니다.');
 const data=value.data;if(!data||!data.slots||typeof data.slots!=='object'||Array.isArray(data.slots)||!Array.isArray(data.read))throw Error('저장 파일 내용이 올바르지 않습니다.');
 const entries=Object.entries(data.slots);if(entries.length>8||entries.some(([slot,entry])=>!/^(auto|quick|[1-6])$/.test(slot)||!validSnapshot(p,entry)))throw Error('저장 슬롯을 검증하지 못했습니다.');
 const ids=new Set(p.scenes.flatMap(s=>s.lines.map(l=>l.id)));if(data.read.length>ids.size||data.read.some((id:unknown)=>typeof id!=='string'||!ids.has(id)))throw Error('읽음 기록이 올바르지 않습니다.');
 return {signature:signature(p),slots:Object.fromEntries(entries) as Record<string,Snapshot>,read:[...new Set<string>(data.read)]};
}
