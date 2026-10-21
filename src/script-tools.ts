import { newLine, newScene, parseProject, uid, type Project, type Scene } from './model.ts';
export type SearchOptions={query:string;caseSensitive:boolean;field:'all'|'text'|'speaker'|'choice'};
export type SearchHit={sceneId:string;lineId:string;choiceId?:string;field:'text'|'speaker'|'choice';text:string;count:number};
function pattern(options:SearchOptions){return new RegExp(options.query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),options.caseSensitive?'gu':'giu');}
export function searchScript(p:Project,options:SearchOptions):SearchHit[]{
 if(!options.query)return [];const regex=pattern(options),hits:SearchHit[]=[];
 for(const scene of p.scenes)for(const line of scene.lines){
  const add=(field:SearchHit['field'],text:string,choiceId?:string)=>{if(options.field!=='all'&&options.field!==field)return;const count=[...text.matchAll(regex)].length;if(count)hits.push({sceneId:scene.id,lineId:line.id,choiceId,field,text,count});};
  add('text',line.text);add('speaker',p.characters?.find(c=>c.id===line.speakerId)?.name??line.speaker);for(const c of line.choices)add('choice',c.text,c.id);
 }return hits;
}
export function replaceScript(p:Project,options:SearchOptions,replacement:string,only?:SearchHit):Project{
 const hits=searchScript(p,options).filter(h=>!only||h.sceneId===only.sceneId&&h.lineId===only.lineId&&h.field===only.field&&h.choiceId===only.choiceId);if(!hits.length)return p;
 const keys=new Set(hits.map(h=>`${h.lineId}:${h.field}:${h.choiceId??''}`)),regex=pattern(options);
 return {...p,scenes:p.scenes.map(s=>({...s,lines:s.lines.map(l=>{
  let next=l;if(keys.has(`${l.id}:text:`))next={...next,text:l.text.replace(regex,()=>replacement)};
  if(keys.has(`${l.id}:speaker:`)){const name=(p.characters?.find(c=>c.id===l.speakerId)?.name??l.speaker).replace(regex,()=>replacement);next={...next,speaker:name,speakerId:p.characters?.find(c=>c.name===name)?.id};}
  if(l.choices.some(c=>keys.has(`${l.id}:choice:${c.id}`)))next={...next,choices:l.choices.map(c=>keys.has(`${l.id}:choice:${c.id}`)?{...c,text:c.text.replace(regex,()=>replacement)}:c)};
  return next;
 })}))};
}
export type ScriptRow={scene_id:string;scene:string;block_id:string;type:'dialogue'|'choice';speaker:string;text:string;choice_id:string;choice:string;target:string;next:string};
const columns=['scene_id','scene','block_id','type','speaker','text','choice_id','choice','target','next'] as const;
export function scriptRows(p:Project):ScriptRow[]{return p.scenes.flatMap(s=>s.lines.flatMap(l=>{
 const row={scene_id:s.id,scene:s.title,block_id:l.id,type:l.type,speaker:p.characters?.find(c=>c.id===l.speakerId)?.name??l.speaker,text:l.text,choice_id:'',choice:'',target:'',next:s.next??''};
 return l.choices.length?l.choices.map(c=>({...row,choice_id:c.id,choice:c.text,target:c.target})):[row];
}));}
const protect=(s:string)=>(/^[\s]*[=+\-@]/.test(s)||/^[\t\r']/.test(s))?`'${s}`:s;
export function exportScript(p:Project,format:'txt'|'csv'):string{
 if(format==='txt')return '\ufeff'+p.scenes.map(s=>`# ${s.title}\n\n${s.lines.map(l=>{const name=p.characters?.find(c=>c.id===l.speakerId)?.name??l.speaker;return (name?`${name}: `:'')+l.text+(l.type==='choice'?'\n'+l.choices.map(c=>`  → ${c.text}`).join('\n'):'');}).join('\n\n')}`).join('\n\n');
 const cell=(s:string)=>`"${protect(s).replaceAll('"','""')}"`;
 return '\ufeff'+[columns.join(',')+',encoding',...scriptRows(p).map(r=>columns.map(c=>cell(r[c])).join(',')+',safe-v1')].join('\r\n');
}
export function parseCsv(raw:string):string[][]{
 raw=raw.replace(/^\ufeff/,'');const rows:string[][]=[];let row:string[]=[],value='',quoted=false,closed=false;
 for(let i=0;i<raw.length;i++){const c=raw[i];if(quoted){if(c==='"'){if(raw[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;continue;}
  if(c==='"'){if(value||closed)throw Error('CSV 따옴표 형식이 올바르지 않습니다.');quoted=true;}
  else if(c===','||c==='\n'||c==='\r'){row.push(value);if(row.length>64)throw Error('CSV 열이 너무 많습니다.');value='';closed=false;if(c!==','){if(c==='\r'&&raw[i+1]==='\n')i++;if(row.some(Boolean))rows.push(row);row=[];}}
  else {if(closed)throw Error('CSV 따옴표 뒤에는 구분자가 필요합니다.');value+=c;}
  if(rows.length>10001)throw Error('대본은 최대 10,000행까지 가져올 수 있습니다.');
 }
 if(quoted)throw Error('CSV 따옴표가 닫히지 않았습니다.');if(value||row.length||closed){row.push(value);if(row.some(Boolean))rows.push(row);}if(rows.length>10001)throw Error('대본은 최대 10,000행까지 가져올 수 있습니다.');return rows;
}
export function importScriptRows(raw:string,format:'txt'|'csv'):ScriptRow[]{
 if(new TextEncoder().encode(raw).length>8*1024*1024)throw Error('대본은 8MB 이하여야 합니다.');
 if(format==='txt'){
  let name='가져온 대본',section=0;const rows:ScriptRow[]=[];
  for(const line of raw.replace(/^\ufeff/,'').split(/\r?\n/)){const text=line.trim();if(!text)continue;if(text.startsWith('# ')){name=text.slice(2).trim()||'가져온 대본';section++;continue;}if(text.startsWith('→'))continue;
   const match=/^([^:：]{1,80})[:：]\s*(.*)$/.exec(text);rows.push({scene_id:`txt-${section}`,scene:name,block_id:uid(),type:'dialogue',speaker:match?.[1]??'',text:match?.[2]??text,choice_id:'',choice:'',target:'',next:''});
  }if(!rows.length)throw Error('가져올 대사가 없습니다.');if(rows.length>10000)throw Error('대본은 최대 10,000행까지 가져올 수 있습니다.');return rows;
 }
 const table=parseCsv(raw),header=table.shift()?.map(s=>s.trim().toLowerCase())??[];if(!header.includes('text'))throw Error('CSV에 text 열이 필요합니다.');if(new Set(header).size!==header.length)throw Error('CSV 열 이름이 중복됩니다.');
 const rows=table.map((cells,i)=>{if(cells.length!==header.length)throw Error(`CSV ${i+2}행의 열 수가 맞지 않습니다.`);const rawRow=Object.fromEntries(header.map((h,n)=>[h,cells[n]]));const safe=rawRow.encoding==='safe-v1';const get=(key:string)=>{const v=rawRow[key]??'';return safe&&v.startsWith("'")?v.slice(1):v;};const type=get('type')||'dialogue';if(type!=='dialogue'&&type!=='choice')throw Error(`CSV ${i+2}행의 type은 dialogue 또는 choice여야 합니다.`);return {scene_id:get('scene_id')||get('scene')||'imported',scene:get('scene')||'가져온 대본',block_id:get('block_id')||uid(),type,speaker:get('speaker'),text:get('text'),choice_id:get('choice_id'),choice:get('choice'),target:get('target'),next:get('next')} as ScriptRow;});
 if(!rows.length)throw Error('가져올 대사가 없습니다.');return rows;
}
export function appendScript(p:Project,rows:ScriptRow[]):Project{
 const scenes:Scene[]=[],map=new Map<string,Scene>(),blocks=new Map<string,{scene:string;row:ScriptRow;line:Scene['lines'][number];choices:Set<string>}>();
 for(const r of rows){let scene=map.get(r.scene_id);if(!scene){scene={...newScene(p.scenes.length+scenes.length+1),title:r.scene,lines:[],next:r.next};map.set(r.scene_id,scene);scenes.push(scene);}else if(scene.title!==r.scene||scene.next!==r.next)throw Error('같은 장면 ID의 이름 또는 다음 연결이 서로 다릅니다.');
  const blockKey=JSON.stringify([r.scene_id,r.block_id]);let block=blocks.get(blockKey);if(!block){const c=p.characters?.find(c=>c.name===r.speaker);const line={...newLine(r.type),speaker:r.speaker,text:r.text,...(c?{speakerId:c.id}:{})};block={scene:r.scene_id,row:r,line,choices:new Set()};blocks.set(blockKey,block);scene.lines.push(line);}else if(block.row.type!==r.type||block.row.text!==r.text||block.row.speaker!==r.speaker)throw Error('같은 블록 ID의 대사 또는 종류가 서로 다릅니다.');
  if(r.type==='dialogue'&&(r.choice_id||r.choice||r.target))throw Error('대사 행에는 선택지 정보를 넣을 수 없습니다.');
  if(r.type==='choice'&&(r.choice_id||r.choice||r.target)){if(r.choice_id&&block.choices.has(r.choice_id))throw Error('선택지 ID가 중복됩니다.');if(r.choice_id)block.choices.add(r.choice_id);block.line.choices.push({id:uid(),text:r.choice,target:r.target});}
 }
 for(const scene of scenes)if(scene.next)scene.next=map.get(scene.next)?.id??scene.next;
 for(const block of blocks.values())for(const c of block.line.choices)c.target=map.get(c.target)?.id??c.target;
 const next={...p,scenes:[...p.scenes,...scenes]};parseProject(JSON.stringify(next));return next;
}
export function updateScript(p:Project,rows:ScriptRow[]):Project{
 const edits=new Map<string,ScriptRow>(),choices=new Map<string,ScriptRow>();
 for(const row of rows){const scene=p.scenes.find(s=>s.id===row.scene_id),line=scene?.lines.find(l=>l.id===row.block_id);if(!line||line.type!==row.type)throw Error('원본 장면·블록 ID가 맞지 않습니다. 새 대본은 장면 추가로 가져오세요.');
  const previous=edits.get(line.id);if(previous&&(previous.text!==row.text||previous.speaker!==row.speaker))throw Error('같은 블록 ID의 수정 내용이 서로 다릅니다.');edits.set(line.id,row);
  if(row.choice_id){if(!line.choices.some(c=>c.id===row.choice_id))throw Error('선택지 ID가 원본과 맞지 않습니다.');if(choices.has(row.choice_id))throw Error('선택지 ID가 중복됩니다.');choices.set(row.choice_id,row);}
 }
 return {...p,scenes:p.scenes.map(s=>({...s,lines:s.lines.map(l=>{const r=edits.get(l.id);if(!r)return l;return {...l,text:r.text,speaker:r.speaker,speakerId:p.characters?.find(c=>c.name===r.speaker)?.id,choices:l.choices.map(c=>choices.has(c.id)?{...c,text:choices.get(c.id)!.choice}:c)};})}))};
}
