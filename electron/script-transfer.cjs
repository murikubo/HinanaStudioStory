const fs=require('node:fs/promises');const {randomUUID}=require('node:crypto');
function scriptTransfer({dialog,window}){return {save:async(raw,title,format)=>{
 if(typeof raw!=='string'||Buffer.byteLength(raw)>8*1024*1024||typeof title!=='string'||!['txt','csv'].includes(format))throw Error('대본 내보내기 요청이 올바르지 않습니다.');
 const safe=(title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/g,'').slice(0,60)||'Script'),result=await dialog.showSaveDialog(window(),{title:'대본 내보내기',defaultPath:`${safe}.${format}`,filters:[{name:format.toUpperCase(),extensions:[format]}]});
 if(result.canceled||!result.filePath)return false;const file=result.filePath.toLowerCase().endsWith('.'+format)?result.filePath:`${result.filePath}.${format}`,temp=`${file}.${randomUUID()}.tmp`;try{await fs.writeFile(temp,raw,'utf8');await fs.rename(temp,file);}catch(e){await fs.rm(temp,{force:true});throw e;}return true;
}};}
module.exports={scriptTransfer};
