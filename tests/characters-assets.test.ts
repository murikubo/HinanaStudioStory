import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, parseProject } from '../src/model.ts';
import { moveActor, resolveCast, speaker, placement, deleteCharacter, deleteExpression } from '../src/characters.ts';
import { assetUsage, removeUnused } from '../src/asset-tools.ts';
function fixture(){const p=newProject('인물 테스트');p.assets=[{id:'a',name:'a',type:'character',url:'data:image/png;base64,YQ=='},{id:'b',name:'b',type:'character',url:'data:image/png;base64,Yg=='},{id:'unused',name:'unused',type:'background',url:'data:image/png;base64,Yw=='}];p.characters=[{id:'alice',name:'앨리스',color:'#aabbcc',defaultExpression:'e1',expressions:[{id:'e1',name:'보통',assetId:'a'},{id:'e2',name:'미소',assetId:'b'}]},{id:'bob',name:'밥',color:'#ddeeff',expressions:[{id:'e3',name:'보통',assetId:'b'}]}];p.scenes[0].cast=p.characters.map(placement);p.scenes[0].lines[0].speakerId='alice';return p;}
test('cast resolves expressions, layers, active speaker, overrides and legacy projects',()=>{const p=fixture(),s=p.scenes[0],l=s.lines[0];assert.equal(speaker(p,l).name,'앨리스');assert.equal(speaker(p,l).color,'#aabbcc');let actors=resolveCast(p,s,l);assert.equal(actors.length,2);assert.equal(actors[0].dim,false);assert.equal(actors[1].dim,true);s.cast![0].layer=9;assert.equal(resolveCast(p,s,l).at(-1)?.characterId,'alice');l.cast=[{...s.cast![0],expressionId:'e2',position:'center'}];assert.equal(resolveCast(p,s,l)[0].assetId,'b');l.cast=[];assert.equal(resolveCast(p,s,l).length,0);l.cast=undefined;s.cast=undefined;s.character='a';assert.equal(resolveCast(p,s,l)[0].key,'legacy');l.character='__none';assert.equal(resolveCast(p,s,l).length,0);});
test('character and expression removal clean references and keep projects serializable',()=>{const p=fixture();p.scenes[0].lines[0].cast=structuredClone(p.scenes[0].cast);const q=deleteExpression(p,'alice','e1');assert.equal(q.characters![0].defaultExpression,'e2');assert.equal(q.scenes[0].cast![0].expressionId,'e2');assert.doesNotThrow(()=>parseProject(JSON.stringify(q)));q.characters![0].name='새 이름';const r=deleteCharacter(q,'alice');assert.equal(r.scenes[0].lines[0].speaker,'새 이름');assert.equal(r.scenes[0].cast!.length,1);assert.doesNotThrow(()=>parseProject(JSON.stringify(r)));});
test('character library references protect assets; invalid references and placements are rejected',()=>{const p=fixture();assert.equal(assetUsage(p).get('b'),2);assert.equal(removeUnused(p).assets.length,2);assert.doesNotThrow(()=>parseProject(JSON.stringify(p)));for(const mutate of [(q:typeof p)=>q.scenes[0].cast!.push(q.scenes[0].cast![0]),(q:typeof p)=>q.scenes[0].cast![0].layer=100,(q:typeof p)=>q.scenes[0].cast![0].expressionId='missing',(q:typeof p)=>q.characters![0].expressions[0].assetId='missing',(q:typeof p)=>q.scenes[0].lines[0].speakerId='missing']){const q=structuredClone(p);mutate(q);assert.throws(()=>parseProject(JSON.stringify(q)));}});

test('manual positions inherit safely, override one block, reset, and survive serialization',()=>{
 const p=fixture(),s=p.scenes[0],l=s.lines[0];s.cast=[placement(p.characters![0]),placement(p.characters![1],1)];
 const original=structuredClone(p),sceneMoved=moveActor(p,s.id,l.id,'scene','alice',{x:31.5,y:87.2});
 assert.deepEqual(p,original);assert.deepEqual(resolveCast(sceneMoved,sceneMoved.scenes[0],sceneMoved.scenes[0].lines[0]).map(a=>[a.x,a.y]),[[31.5,87.2],[77,100]]);
 const moved=moveActor(sceneMoved,s.id,l.id,'line','alice',{x:64,y:92});
 assert.equal(moved.scenes[0].cast![0].x,31.5);assert.equal(moved.scenes[0].lines[0].cast![0].x,64);assert.equal(moved.scenes[0].lines[0].cast![1].x,undefined);
 assert.deepEqual(parseProject(JSON.stringify(moved)),moved);
 const reset=moveActor(moved,s.id,l.id,'line','alice',null);assert.equal(resolveCast(reset,reset.scenes[0],reset.scenes[0].lines[0])[0].x,23);
 assert.equal(moveActor(p,s.id,l.id,'line','missing',{x:10,y:10}),p);
 for(const point of [{x:-1,y:0},{x:101,y:0},{x:0,y:NaN}])assert.throws(()=>parseProject(JSON.stringify(moveActor(p,s.id,l.id,'scene','alice',point))));
});
test('legacy image positions preserve preset overrides and reject invalid coordinates',()=>{
 const p=fixture(),s=p.scenes[0],l=s.lines[0];delete s.cast;delete l.cast;s.character='a';s.characterX=40;s.characterY=90;
 assert.deepEqual(resolveCast(p,s,l).map(a=>[a.x,a.y]),[[40,90]]);
 l.position='right';assert.deepEqual(resolveCast(p,s,l).map(a=>[a.x,a.y]),[[77,100]]);
 const moved=moveActor(p,s.id,l.id,'line','legacy',{x:10,y:80});assert.deepEqual(resolveCast(moved,moved.scenes[0],moved.scenes[0].lines[0]).map(a=>[a.x,a.y]),[[10,80]]);
 assert.doesNotThrow(()=>parseProject(JSON.stringify(moved)));s.characterX=Infinity;assert.throws(()=>parseProject(JSON.stringify(p)));
});
