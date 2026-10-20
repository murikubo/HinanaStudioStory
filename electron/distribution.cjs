const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFile}=require('node:child_process');
const exec=require('node:util').promisify(execFile);
function validFormat(target,format){return (target==='macos'?['directory','zip','dmg']:target==='windows'?['directory','installer','portable']:['directory']).includes(format);}
function signingOptions(){return {mac:Boolean(process.platform==='darwin'&&process.env.HINANA_MAC_SIGN_IDENTITY),windows:Boolean(process.platform==='win32'&&process.env.CSC_LINK)};}
async function packageMac({root,appPath,name,format,progress}){
 if(format==='directory')return null;
 if(format==='zip'){const file=path.join(root,`${name}.zip`);progress('Mac 배포 ZIP을 만들고 있습니다.');await exec('/usr/bin/ditto',['-c','-k','--sequesterRsrc','--keepParent',appPath,file],{timeout:300000});return file;}
 const work=await fs.mkdtemp(path.join(os.tmpdir(),'hinana-dmg-'));try{
  progress('Mac 설치 디스크 이미지를 만들고 있습니다.');await exec('/usr/bin/ditto',[appPath,path.join(work,path.basename(appPath))],{timeout:180000});await fs.symlink('/Applications',path.join(work,'Applications'));const file=path.join(root,`${name}.dmg`);await exec('/usr/bin/hdiutil',['create','-volname',name.slice(0,27),'-srcfolder',work,'-format','UDZO','-ov',file],{timeout:300000,maxBuffer:1024*1024});return file;
 }finally{await fs.rm(work,{recursive:true,force:true});}
}
async function packageWindows({root,project,name,format,electronVersion,progress,signing}){
 const modulePath=require.resolve('app-builder-lib');
 // Native NSIS reads its templates from disk, outside Electron's ASAR filesystem.
 const builderPath=process.versions.electron?modulePath.replace(/app\.asar([\\/])/,'app.asar.unpacked$1'):modulePath;
 const {build,Platform,Arch}=require(builderPath),work=await fs.mkdtemp(path.join(os.tmpdir(),'hinana-installer-'));
 try{
  progress(format==='installer'?'Windows 설치 프로그램을 만들고 있습니다.':'Windows 단일 실행 파일을 만들고 있습니다.');
  const game=path.join(root,'resources/app'),icon=path.join(root,'game-icon.ico'),hasIcon=await fs.access(icon).then(()=>true,()=>false),version=project.metadata?.releaseVersion||'1.0.0';
  const artifacts=await build({projectDir:game,prepackaged:root,targets:Platform.WINDOWS.createTarget(format==='installer'?'nsis':'portable',Arch.x64),publish:'never',config:{appId:`studio.hinana.${JSON.parse(await fs.readFile(path.join(game,'package.json'),'utf8')).name}`,productName:name,copyright:project.metadata?.copyright||undefined,electronVersion,asar:false,npmRebuild:false,compression:'normal',directories:{output:work,buildResources:work},win:{signAndEditExecutable:false,signExecutable:signing==='distribution',...(hasIcon?{icon}:{} )},nsis:{oneClick:false,allowToChangeInstallationDirectory:true,differentialPackage:false,artifactName:`${name}-Setup-${version}.exe`,...(hasIcon?{installerIcon:icon,uninstallerIcon:icon}:{})},portable:{artifactName:`${name}-Portable-${version}.exe`,requestExecutionLevel:'user'}}});
  const file=artifacts.find(v=>v.endsWith('.exe'));if(!file)throw Error('Windows 패키지 생성 결과가 없습니다.');
  const destination=path.join(root,path.basename(file));await fs.copyFile(file,destination);
  // The resulting installer/portable contains the runtime; leave a clean delivery folder.
  const rawFs=process.versions.electron?require('original-fs').promises:fs;
  for(const entry of await fs.readdir(root))if(entry!==path.basename(destination))await rawFs.rm(path.join(root,entry),{recursive:true,force:true});
  await fs.writeFile(path.join(root,'PLAY.txt'),`${project.title}\n\n${path.basename(destination)}을 실행하세요.\n${format==='installer'?'설치 마법사에서 설치 위치를 선택할 수 있습니다.':'설치 없이 실행하며 런타임을 임시 폴더에 풉니다.'}\n플레이 저장은 사용자 계정에 유지됩니다.\n${signing==='distribution'?'설정된 인증서를 사용하는 배포 빌드입니다.':'코드 서명 인증서를 포함하지 않는 빌드입니다.'}\n`);
  return destination;
 }finally{await fs.rm(work,{recursive:true,force:true});}
}
module.exports={validFormat,signingOptions,packageMac,packageWindows};
