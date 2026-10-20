import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneLines, deleteScene, demo, newProject, next, orderBlocks, parseProject, reorderScenes, start, transferBlocks } from '../src/model.ts';
import { edges, inspectFlow } from '../src/flow.ts';
test('scene reorder preserves start and deletion cleans both link kinds',()=>{
 const p=demo(),a=p.scenes[0].id,b=p.scenes[1].id;p.scenes[2].next=b;
 const reordered=reorderScenes(p,b,a);assert.equal(reordered.startScene,a);assert.equal(reordered.scenes[0].id,b);
 const deleted=deleteScene(reordered,b);assert.equal(deleted.scenes.find(s=>s.id===p.scenes[2].id)?.next,'');assert.equal(deleted.scenes.find(s=>s.id===a)?.lines[2].choices.length,1);assert.doesNotThrow(()=>parseProject(JSON.stringify(deleted)));
 const deletedStart=deleteScene(reordered,a);assert.equal(deletedStart.startScene,deletedStart.scenes[0].id);
});
test('ordered multi-block movement and cloning preserve content with unique nested IDs',()=>{
 const p=demo(),s=p.scenes[0],ids=s.lines.map(l=>l.id);
 assert.deepEqual(orderBlocks(p,s.id,[ids[1],ids[2]],'up').scenes[0].lines.map(l=>l.id),[ids[1],ids[2],ids[0]]);
 assert.deepEqual(orderBlocks(p,s.id,[ids[0],ids[1]],'down').scenes[0].lines.map(l=>l.id),[ids[2],ids[0],ids[1]]);
 assert.deepEqual(orderBlocks(p,s.id,[ids[2]],ids[0]).scenes[0].lines.map(l=>l.id),[ids[2],ids[0],ids[1]]);
 const copied=cloneLines(s.lines);assert.notEqual(copied[0].id,s.lines[0].id);assert.notEqual(copied[2].choices[0].id,s.lines[2].choices[0].id);copied[2].choices[0].text='changed';assert.notEqual(s.lines[2].choices[0].text,'changed');
});
test('bulk transfer moves identities, copy creates identities, empty source retains a block',()=>{
 const p=demo(),source=p.scenes[0],target=p.scenes[1];
 const moved=transferBlocks(p,source.id,source.lines.map(l=>l.id),target.id,false);
 assert.equal(moved.scenes[0].lines.length,1);assert.equal(moved.scenes[0].lines[0].text,'');assert.equal(moved.scenes[1].lines.at(-1)?.id,source.lines.at(-1)?.id);assert.doesNotThrow(()=>parseProject(JSON.stringify(moved)));
 const copied=transferBlocks(p,source.id,[source.lines[2].id],target.id,true);assert.equal(copied.scenes[0].lines.length,3);assert.notEqual(copied.scenes[1].lines.at(-1)?.id,source.lines[2].id);assert.doesNotThrow(()=>parseProject(JSON.stringify(copied)));
 assert.equal(transferBlocks(p,source.id,[],target.id,false),p);
});
test('plain next-scene connection runs destination effects once and rejects missing targets',()=>{
 const p=newProject('test'),other=demo().scenes[1];p.scenes.push(other);p.variables=[{id:'n',name:'n',initial:0}];p.scenes[0].next=other.id;other.lines[0].effects=[{variableId:'n',operation:'add',value:4}];
 const first=start(p,p.startScene!),second=next(p,first)!;assert.equal(second.sceneId,other.id);assert.equal(second.variables.n,4);assert.equal(next(p,second),null);assert.doesNotThrow(()=>parseProject(JSON.stringify(p)));
 p.scenes[0].next='missing';assert.throws(()=>parseProject(JSON.stringify(p)));
});
test('graph uses first branch, reports unreachable and blocked blocks, supports plain links',()=>{
 const p=demo();assert.equal(inspectFlow(p).length,0);assert.equal(edges(p).length,2);
 p.scenes[0].lines.push(structuredClone({...p.scenes[0].lines[0],id:'after-choice'}));
 assert.ok(inspectFlow(p).some(i=>i.lineId==='after-choice'));
 p.scenes[0].lines[2].choices=[];assert.ok(inspectFlow(p).some(i=>i.severity==='error'));assert.ok(inspectFlow(p).some(i=>i.message.includes('도달')));
 const plain=newProject('plain');plain.scenes.push(demo().scenes[1]);assert.ok(inspectFlow(plain).some(i=>i.sceneId===plain.scenes[1].id));plain.scenes[0].next=plain.scenes[1].id;assert.equal(inspectFlow(plain).length,0);assert.equal(edges(plain)[0].kind,'next');
});

test('scene deletion preserves every unrelated block, asset and setting without mutating history',()=>{
 const p=demo();p.metadata={author:'제작자',credits:'크레딧'};p.scenes[2].next=p.scenes[1].id;
 const original=structuredClone(p),deleted=deleteScene(p,p.scenes[1].id);
 assert.equal(deleted.scenes.length,p.scenes.length-1);
 assert.deepEqual(p,original);
 assert.deepEqual(deleted.scenes[1].lines,p.scenes[2].lines);
 assert.deepEqual(deleted.scenes[0].lines.slice(0,2),p.scenes[0].lines.slice(0,2));
 assert.deepEqual(deleted.assets,p.assets);assert.deepEqual(deleted.metadata,p.metadata);
 assert.equal(deleteScene(p,'missing'),p);
 const single=newProject('마지막 장면');assert.equal(deleteScene(single,single.scenes[0].id),single);
});
