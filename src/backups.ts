import {parseProject,type Project} from './model';
import type {BackupItem} from './bridge';
const keyOf=(p:Project)=>p.id??p.scenes[0].id;
let database:Promise<IDBDatabase>|undefined,queue:Promise<unknown>=Promise.resolve();
function db(){return database??=new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('hinana-story-backups',1);r.onupgradeneeded=()=>{r.result.createObjectStore('entries',{keyPath:'id'}).createIndex('project','projectKey');r.result.createObjectStore('contents');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function entries(projectKey:string){const database=await db();return new Promise<(BackupItem&{projectKey:string})[]>((resolve,reject)=>{const r=database.transaction('entries').objectStore('entries').index('project').getAll(projectKey);r.onsuccess=()=>resolve(r.result.sort((a:BackupItem,b:BackupItem)=>b.createdAt.localeCompare(a.createdAt)));r.onerror=()=>reject(r.error);});}
function enqueue<T>(fn:()=>Promise<T>):Promise<T>{const next=queue.then(fn,fn);queue=next.catch(()=>{});return next;}
export function listBackups(p:Project):Promise<BackupItem[]>{return window.studio?.listBackups?window.studio.listBackups(keyOf(p)):entries(keyOf(p));}
export async function readBackup(p:Project,id:string):Promise<Project>{
 if(window.studio?.readBackup)return parseProject(await window.studio.readBackup(keyOf(p),id));
 if(!(await entries(keyOf(p))).some(e=>e.id===id))throw Error('현재 프로젝트의 백업이 아닙니다.');
 const database=await db();const raw=await new Promise<string>((resolve,reject)=>{const r=database.transaction('contents').objectStore('contents').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return parseProject(raw);
}
export function createBackup(p:Project,reason='manual'):Promise<BackupItem>{return enqueue(async()=>{
 const raw=JSON.stringify(p);if(new Blob([raw]).size>80*1024*1024)throw Error('백업은 80MB 이하여야 합니다.');parseProject(raw);
 if(window.studio?.createBackup)return window.studio.createBackup(raw,reason);
 const projectKey=keyOf(p),previous=await entries(projectKey),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))).map(n=>n.toString(16).padStart(2,'0')).join('');
 if(previous[0]?.hash===hash)return previous[0];
 const item={id:crypto.randomUUID(),createdAt:new Date().toISOString(),title:p.title,reason,bytes:new Blob([raw]).size,hash,projectKey},database=await db();
 await new Promise<void>((resolve,reject)=>{const tx=database.transaction(['entries','contents'],'readwrite');tx.objectStore('entries').put(item);tx.objectStore('contents').put(raw,item.id);for(const old of previous.slice(29)){tx.objectStore('entries').delete(old.id);tx.objectStore('contents').delete(old.id);}tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});return item;
});}
