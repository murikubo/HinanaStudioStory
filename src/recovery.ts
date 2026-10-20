import { parseProject, type Project } from './model';
const KEY='hinana-story-v1';
export type Recovery={project:Project;meta:{path?:string|null;dirty?:boolean}};
let database:Promise<IDBDatabase>|undefined;
function db(){return database??=new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('hinana-story-recovery',1);request.onupgradeneeded=()=>request.result.createObjectStore('recovery');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function readRecovery():Promise<Recovery|null>{
 try{const legacy=localStorage.getItem(KEY);if(legacy){const project=parseProject(legacy);let meta={};try{meta=JSON.parse(localStorage.getItem(KEY+'-meta')??'{}');}catch{}return {project,meta};}}catch{}
 try{const database=await db();const value=await new Promise<Recovery|undefined>((resolve,reject)=>{const request=database.transaction('recovery').objectStore('recovery').get('last');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});if(value)return {project:parseProject(JSON.stringify(value.project)),meta:value.meta??{}};}catch{}
 return null;
}
async function persistRecovery(project:Project,meta:Recovery['meta']):Promise<boolean>{
 try{
  const database=await db();await new Promise<void>((resolve,reject)=>{const transaction=database.transaction('recovery','readwrite');transaction.objectStore('recovery').put({project,meta},'last');transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);});
  try{localStorage.removeItem(KEY);localStorage.setItem(KEY+'-meta',JSON.stringify(meta));}catch{}
  return true;
 }catch{try{localStorage.setItem(KEY,JSON.stringify(project));localStorage.setItem(KEY+'-meta',JSON.stringify(meta));return true;}catch{return false;}}
}

// Keep discard/exit operations behind any autosave already in flight.
let writes:Promise<unknown>=Promise.resolve();
function enqueue<T>(operation:()=>Promise<T>):Promise<T>{const next=writes.then(operation,operation);writes=next.catch(()=>{});return next;}
export function writeRecovery(project:Project,meta:Recovery['meta']){return enqueue(()=>persistRecovery(project,meta));}
export function clearRecovery():Promise<boolean>{return enqueue(async()=>{
 try{const database=await db();await new Promise<void>((resolve,reject)=>{const tx=database.transaction('recovery','readwrite');tx.objectStore('recovery').delete('last');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});localStorage.removeItem(KEY);localStorage.removeItem(KEY+'-meta');return true;}catch{return false;}
});}
