const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const {encodeProject,decodeProject}=require('./project-assets.cjs');
const filter = [{ name: 'Hinana Studio Story', extensions: ['hinanastory'] }];
const extension = file => /\.hinanastory$/i.test(file) ? file : file.replace(/\.(hinana|json)$/i, '') + '.hinanastory';
function projectFiles({ directory, dialog, window, backups }) {
  let currentPath = null, recent = [];
  const allowed = new Set(), config = path.join(directory,'recent-projects.json');
  async function init() { try { const data = JSON.parse(await fs.readFile(config,'utf8')); recent = Array.isArray(data) ? data.filter(r=>r&&typeof r.path==='string'&&typeof r.title==='string'&&typeof r.openedAt==='string').slice(0,10) : []; for (const r of recent) allowed.add(r.path); } catch {} }
  async function remember(file, title) {
    recent = [{path:file,title,openedAt:new Date().toISOString()},...recent.filter(r=>r.path!==file)].slice(0,10);
    await fs.mkdir(directory,{recursive:true});
    const temp=config+'.tmp';await fs.writeFile(temp,JSON.stringify(recent),'utf8');await fs.rename(temp,config);
  }
  async function read(file) {
    const stat=await fs.stat(file);if(!stat.isFile()||stat.size>80*1024*1024)throw new Error('프로젝트는 80MB 이하의 파일이어야 합니다.');
    const raw=await fs.readFile(file,'utf8');const content=await decodeProject(raw,file);allowed.add(file);return {content,path:file};
  }
  return {
    init,
    state:()=>({path:currentPath,recent:[...recent]}),
    activate:async (file,title)=>{if(file!==null&&(!allowed.has(file)||typeof title!=='string'))throw new Error('허용되지 않은 프로젝트 경로입니다.');currentPath=file;if(file)await remember(file,title).catch(()=>{});return {path:currentPath,recent:[...recent]};},
    save:async(content,saveAs=false,asNew=false)=>{
      if(typeof content!=='string'||Buffer.byteLength(content)>80*1024*1024)throw new Error('프로젝트 크기는 80MB 이하여야 합니다.');
      const p=JSON.parse(content);if(!p||p.version!==1||typeof p.title!=='string'||!Array.isArray(p.scenes)||!p.scenes.length)throw new Error('올바른 프로젝트가 아닙니다.');
      let file=currentPath;
      if(saveAs||!file||!file.toLowerCase().endsWith('.hinanastory')){
        const name=(p.title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/g,'').slice(0,60)||'MyStory')+'.hinanastory';
        const result=await dialog.showSaveDialog(window(),{defaultPath:file?(asNew?path.join(path.dirname(file),name):extension(file)):name,filters:filter});
        if(result.canceled||!result.filePath)return null;file=extension(result.filePath);
      }
      if(asNew&&currentPath){
        const canonical=async value=>{const resolved=await fs.realpath(value).catch(()=>path.resolve(value));return process.platform==='win32'?resolved.toLowerCase():resolved;};
        if(await canonical(file)===await canonical(currentPath))throw new Error('새 프로젝트는 원본과 다른 파일에 저장해 주세요.');
      }
      let backupWarning;
      if(backups){try{const previous=await read(file);await backups.create(previous.content,'before-save');}catch(error){if(error.code!=='ENOENT')backupWarning='이전 버전 백업을 만들지 못했습니다.';}}
      const temp=file+`.${randomUUID()}.tmp`;
      const stored=await encodeProject(content,file);
      try{await fs.writeFile(temp,stored,'utf8');await fs.rename(temp,file);}catch(error){await fs.rm(temp,{force:true});throw error;}
      currentPath=file;allowed.add(file);await remember(file,p.title).catch(()=>{});if(backups)try{await backups.create(content,'save');}catch{backupWarning='프로젝트는 저장했으나 백업을 만들지 못했습니다.';}return {path:file,recent:[...recent],...(backupWarning?{backupWarning}:{})};
    },
    open:async()=>{const result=await dialog.showOpenDialog(window(),{properties:['openFile'],filters:[{name:'Hinana Studio Story',extensions:['hinanastory','hinana','json']}]});return result.canceled?null:read(result.filePaths[0]);},
    openRecent:async file=>{if(!recent.some(r=>r.path===file))throw new Error('최근 프로젝트 목록에 없는 파일입니다.');return read(file);}
  };
}
module.exports={projectFiles,extension};
