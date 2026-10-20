import test from 'node:test';
import assert from 'node:assert/strict';
import { demo, next, parseProject, start } from '../src/model.ts';
import { playKey, readData, readSettings, settingsKey, signature, snapshot, validSnapshot } from '../src/player-store.ts';
const memory = () => { const values = new Map<string,string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string,value: string) => { values.set(key,value); } }; };
test('save/load restores exact values without replaying block effects', () => {
  const p=demo();p.variables=[{id:'score',name:'점수',initial:0}];p.scenes[0].lines[0].effects=[{variableId:'score',operation:'add',value:3}];
  const session=start(p,p.scenes[0].id), stored=snapshot(p,session,[]);
  assert.ok(validSnapshot(p,stored));assert.equal(stored.session.variables.score,3);
  const restored=structuredClone(stored.session);assert.equal(next(p,restored)?.variables.score,3);
  session.variables.score=9;assert.equal(stored.session.variables.score,3);
});
test('project/test namespaces are isolated; content edits invalidate saves and read marks', () => {
  const p=demo(), storage=memory(), slot=snapshot(p,start(p,p.scenes[0].id),[]);
  storage.setItem(playKey(p),JSON.stringify({signature:signature(p),slots:{1:slot},read:[p.scenes[0].lines[0].id,'missing']}));
  assert.equal(readData(storage,p).read.length,1);assert.ok(readData(storage,p).slots['1']);assert.deepEqual(readData(storage,p,true).slots,{});
  p.scenes[0].lines[0].text+='edited';assert.equal(validSnapshot(p,slot),false);assert.deepEqual(readData(storage,p).slots,{});assert.deepEqual(readData(storage,p).read,[]);
  const other=demo();assert.notEqual(playKey(p),playKey(other));
});
test('corrupt saves and unsafe numbers are rejected, settings are bounded', () => {
  const p=demo(), storage=memory();storage.setItem(playKey(p),'{broken');assert.deepEqual(readData(storage,p).slots,{});
  const slot=snapshot(p,start(p,p.scenes[0].id),[]);slot.session.index=-1;assert.equal(validSnapshot(p,slot),false);
  const bad=snapshot(p,start(p,p.scenes[0].id),[]);bad.session.variables.bad=Infinity;assert.equal(validSnapshot(p,bad),false);
  storage.setItem(settingsKey,JSON.stringify({speed:-4,autoDelay:90000,music:3,sound:-1,muted:'yes'}));
  assert.deepEqual(readSettings(storage),{speed:0,autoDelay:10000,music:1,sound:0,muted:false});
});
test('transition and sound settings serialize and reject broken audio references', () => {
  const p=demo();p.assets.push({id:'sound',name:'step.wav',type:'audio',url:'data:audio/wav;base64,AAAA'});
  Object.assign(p.scenes[0],{transition:'slide',duration:800,characterMotion:'fade',bgmFade:1000});
  Object.assign(p.scenes[0].lines[0],{sfx:'sound',sfxVolume:0.4});assert.deepEqual(parseProject(JSON.stringify(p)),p);
  p.scenes[0].lines[0].sfx='missing';assert.throws(()=>parseProject(JSON.stringify(p)));
  p.scenes[0].lines[0].sfx='sound';p.scenes[0].duration=-1;assert.throws(()=>parseProject(JSON.stringify(p)));
});
