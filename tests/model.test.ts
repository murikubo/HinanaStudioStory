import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, demo, parseProject, start, next, choose, matches, removeVariable } from '../src/model.ts';
test('project serialization preserves all scenes and choice targets', () => {
  const p = demo();
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
  for (const c of p.scenes[0].lines[2].choices) assert.ok(p.scenes.some(s => s.id === c.target));
});
test('playback advances dialogue and waits at a choice or ending', () => {
  const p = demo(), id = p.scenes[0].id;
  assert.deepEqual(advance(p, id, 0), { sceneId: id, index: 1 });
  assert.equal(advance(p, id, 2), null);
  assert.equal(advance(p, p.scenes[1].id, 0), null);
});
test('invalid projects, duplicate IDs, scripts in image URLs, broken branches are rejected', () => {
  assert.throws(() => parseProject('{bad'));
  for (const mutate of [
    (p: ReturnType<typeof demo>) => { p.scenes = []; },
    (p: ReturnType<typeof demo>) => { p.scenes[1].id = p.scenes[0].id; },
    (p: ReturnType<typeof demo>) => { p.scenes[0].lines[2].choices[0].target = 'missing'; },
    (p: ReturnType<typeof demo>) => { p.assets.push({ id: 'asset', type: 'background', name: 'bad', url: 'javascript:alert(1)' }); }
  ]) { const p = demo(); mutate(p); assert.throws(() => parseProject(JSON.stringify(p))); }
});

test('old projects load unchanged, while visual/audio/logic settings roundtrip', () => {
  const p = demo(); assert.deepEqual(parseProject(JSON.stringify(p)), p);
  p.variables = [{id: 'affinity', name: '호감도', initial: 0}];
  p.assets = [{id:'music',name:'theme.wav',type:'audio',url:'data:audio/wav;base64,AAAA'}, {id:'smile',name:'smile.png',type:'character',url:'data:image/png;base64,AAAA'}];
  Object.assign(p.scenes[0], {bgm:'music',volume:0.3,loop:false,position:'left',characterScale:85});
  Object.assign(p.scenes[0].lines[0], {character:'smile',position:'right',effects:[{variableId:'affinity',operation:'add',value:3}]});
  p.scenes[0].lines[2].choices[0].condition = {variableId:'affinity',operator:'>=',value:3};
  assert.deepEqual(parseProject(JSON.stringify(p)),p);
});
test('effects run once on entry, persist through branches and reset for each new test', () => {
  const p = demo(); p.variables = [{id:'score',name:'점수',initial:2}];
  p.scenes[0].lines[0].effects = [{variableId:'score',operation:'add',value:3}];
  p.scenes[0].lines[1].effects = [{variableId:'score',operation:'add',value:-1}];
  p.scenes[0].lines[2].choices[0].condition = {variableId:'score',operator:'>=',value:4};
  p.scenes[1].lines[0].effects = [{variableId:'score',operation:'set',value:10}];
  const first = start(p,p.scenes[0].id); assert.equal(first.variables.score,5);
  const second = next(p,first)!; assert.equal(second.variables.score,4); assert.equal(first.variables.score,5);
  const third = next(p,second)!; assert.equal(third.variables.score,4);
  assert.equal(choose(p,third,p.scenes[0].lines[2].choices[0].id).variables.score,10);
  assert.equal(start(p,p.scenes[0].id).variables.score,5);
  assert.equal(start(p,p.scenes[0].id,2).variables.score,4);
  assert.throws(() => choose(p, {...third,variables:{score:0}}, p.scenes[0].lines[2].choices[0].id));
  assert.throws(() => choose(p,first,p.scenes[0].lines[2].choices[0].id));
});
test('all comparison operators and missing variables are handled without evaluating code', () => {
  for (const [operator,value,result] of [['==',3,true],['!=',3,false],['>',2,true],['>=',3,true],['<',4,true],['<=',2,false]] as const)
    assert.equal(matches({variableId:'score',operator,value},{score:3}),result);
  assert.equal(matches({variableId:'missing',operator:'!=',value:0},{}),false);
  assert.equal(matches(undefined,{}),true);
});
test('variable deletion clears references and malformed extensions are rejected', () => {
  const p=demo();p.variables=[{id:'score',name:'점수',initial:0}];
  p.scenes[0].lines[0].effects=[{variableId:'score',operation:'add',value:1}];
  p.scenes[0].lines[2].choices[0].condition={variableId:'score',operator:'>',value:0};
  const clean=removeVariable(p,'score');assert.equal(clean.variables?.length,0);
  assert.equal(clean.scenes[0].lines[0].effects?.length,0);assert.equal(clean.scenes[0].lines[2].choices[0].condition,undefined);
  assert.doesNotThrow(()=>parseProject(JSON.stringify(clean)));
  for(const mutate of [
    (p: ReturnType<typeof demo>)=>{p.scenes[0].volume=2},
    (p: ReturnType<typeof demo>)=>{p.scenes[0].bgm='missing'},
    (p: ReturnType<typeof demo>)=>{p.scenes[0].character='missing'},
    (p: ReturnType<typeof demo>)=>{p.scenes[0].lines[0].effects=[{variableId:'missing',operation:'set',value:0}]},
    (p: ReturnType<typeof demo>)=>{p.variables=[{id:'a',name:'dup',initial:0},{id:'b',name:'dup',initial:1}]}
  ]){const bad=demo();mutate(bad);assert.throws(()=>parseProject(JSON.stringify(bad)))}
});
