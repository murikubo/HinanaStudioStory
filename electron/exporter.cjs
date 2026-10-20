const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const {projectIcon,ico,icns,brandWindows}=require('./branding.cjs');
const {validFormat,signingOptions,packageMac,packageWindows}=require('./distribution.cjs');
function safeName(title) {
  const name = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').trim().slice(0, 60).replace(/\$\{/g,'_{') || 'My Story';
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name) ? `Story-${name}` : name;
}
async function writeGame(dist, output, raw) {
  await fs.mkdir(output, { recursive: true });
  for (const entry of await fs.readdir(dist, { withFileTypes: true })) {
    if (entry.name === 'index.html' || entry.name === 'game.html') continue;
    if (entry.name === 'assets') {
      await fs.mkdir(path.join(output, 'assets'), { recursive: true });
      for (const asset of await fs.readdir(path.join(dist, 'assets'))) if (!asset.startsWith('editor-')) await fs.copyFile(path.join(dist, 'assets', asset), path.join(output, 'assets', asset));
    } else if (entry.isFile()) await fs.copyFile(path.join(dist, entry.name), path.join(output, entry.name));
  }
  const project=JSON.parse(raw),icon=await projectIcon(project);
  let html=await fs.readFile(path.join(dist,'game.html'),'utf8');if(icon){await fs.writeFile(path.join(output,'game-icon.png'),icon);html=html.replace('</head>','<link rel="icon" href="./game-icon.png"/></head>');}await fs.writeFile(path.join(output,'index.html'),html);
  await fs.writeFile(path.join(output, 'story.json'), raw, 'utf8');
}
async function exportGame({ raw, target, parent, dist, electronVersion, progress = () => {}, format='directory', signing='local' }) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 80 * 1024 * 1024) throw new Error('프로젝트 크기는 80MB 이하여야 합니다.');
  if (!['web','windows','macos'].includes(target)) throw new Error('지원하지 않는 배포 형식입니다.');
  if(target==='macos'&&(process.platform!=='darwin'||!['arm64','x64'].includes(process.arch)))throw new Error('macOS 게임은 Apple Silicon 또는 Intel Mac에서 내보내 주세요.');
  if(!validFormat(target,format)||!['local','distribution'].includes(signing))throw Error('지원하지 않는 배포 옵션입니다.');
  if(signing==='distribution'&&(!(target==='macos'?signingOptions().mac:target==='windows'&&format!=='directory'&&signingOptions().windows)))throw Error('이 형식에 사용할 배포 인증서 환경이 설정되지 않았습니다.');
  const project = JSON.parse(raw);
  if (project?.version !== 1 || typeof project.title !== 'string' || !Array.isArray(project.scenes) || !project.scenes.length || !Array.isArray(project.assets)) throw new Error('프로젝트 파일이 올바르지 않습니다.');
  await fs.access(path.join(dist, 'game.html')).catch(() => { throw new Error('재생기 빌드가 없습니다. npm run build를 먼저 실행해 주세요.'); });
  const name = safeName(project.title), root = await fs.mkdtemp(path.join(parent, `${name}-${target}-`));
  try {
    if (target === 'web') {
      progress('웹 재생기와 작품 파일을 복사하고 있습니다.');
      await writeGame(dist, root, raw);
      await fs.writeFile(path.join(root, 'README.txt'), `${project.title}\n\n이 폴더 전체를 정적 웹 호스팅에 업로드하세요.\n로컬 확인: 이 폴더에서 python3 -m http.server 8080 실행 후 http://localhost:8080 접속\n브라우저에서 index.html을 파일로 직접 열면 작품 파일을 읽지 못할 수 있습니다.\n플레이 저장은 브라우저의 로컬 저장소에 보관됩니다.\n`, 'utf8');
    } else if(target==='macos'){
      const appPath=await exportMac({project,raw,root,dist,electronVersion,progress,signing});
      const artifactPath=await packageMac({root,appPath,name,format,progress});
      progress('내보내기를 완료했습니다.');
      return {path:root,target,appPath,arch:process.arch,launchable:true,format,artifactPath,signing};
    } else {
      progress('Windows x64 런타임을 준비하고 있습니다. 첫 다운로드에는 시간이 걸릴 수 있습니다.');
      const { downloadArtifact } = await import('@electron/get');
      const { unzip } = require('./unzip.cjs');
      let percent = -1;
      const zip = await downloadArtifact({ version: electronVersion, artifactName: 'electron', platform: 'win32', arch: 'x64', downloadOptions: { quiet: true, getProgressCallback: p => { const current = Math.floor(p.percent * 100); if (current >= percent + 5) { percent = current; progress(`Windows 런타임 다운로드 ${current}%`); } } } });
      progress('Windows 실행 환경을 풀고 있습니다.');
      await unzip(zip, root);
      const game = path.join(root, 'resources', 'app');
      await writeNativeGame(project,dist,game,raw);
      const rawFs = process.versions.electron ? require('original-fs').promises : fs;
      await rawFs.rm(path.join(root, 'resources', 'default_app.asar'), { force: true });
      const executable=path.join(root,`${name}.exe`);await fs.rename(path.join(root,'electron.exe'),executable);const icon=await projectIcon(project);if(icon)await fs.writeFile(path.join(root,'game-icon.ico'),ico(icon));await brandWindows(project,executable,icon);
      await fs.writeFile(path.join(root, 'PLAY.txt'), `${project.title}\n\n${name}.exe를 실행하세요.\n배포할 때는 실행 파일만이 아니라 이 폴더 전체를 전달해 주세요.\n플레이 저장은 사용자 계정의 앱 데이터에 보관됩니다.\n이 배포본은 코드 서명을 포함하지 않습니다.\n`, 'utf8');
    }
    if(target==='windows'&&format!=='directory'){const executable=await packageWindows({root,project,name,format,electronVersion,progress,signing});progress('내보내기를 완료했습니다.');return {path:root,target,format,signing,artifactPath:executable,executable,launchable:process.platform==='win32'&&format==='portable'};}
    progress('내보내기를 완료했습니다.');
    return { path: root, target, format, signing, launchable:target==='windows'&&process.platform==='win32', ...(target==='windows'?{executable:path.join(root,`${name}.exe`)}:{}) };
  } catch (error) { await fs.rm(root, { recursive: true, force: true }); throw error; }
}

async function writeNativeGame(project,dist,game,raw){
  await writeGame(dist,game,raw);
  const id=crypto.createHash('sha256').update(project.id??project.scenes[0].id).digest('hex').slice(0,20);
  await fs.writeFile(path.join(game,'package.json'),JSON.stringify({name:`hinana-game-${id}`,productName:project.title,version:project.metadata?.releaseVersion||'1.0.0',description:project.metadata?.description||project.title,author:project.metadata?.author||'Hinana Studio Story',main:'main.cjs'},null,2));
  await fs.copyFile(path.join(__dirname,'game-main.cjs'),path.join(game,'main.cjs'));
  await fs.copyFile(path.join(__dirname,'game-preload.cjs'),path.join(game,'preload.cjs'));
  await fs.copyFile(path.join(__dirname,'save-transfer.cjs'),path.join(game,'save-transfer.cjs'));
  return id;
}
async function exportMac({project,raw,root,dist,electronVersion,progress,signing='local'}){
  const {downloadArtifact}=await import('@electron/get');
  const architecture=process.arch==='arm64'?'Apple Silicon':'Intel';
  progress(`macOS ${architecture} 런타임을 준비하고 있습니다. 첫 다운로드에는 시간이 걸릴 수 있습니다.`);
  let percent=-1;
  const zip=await downloadArtifact({version:electronVersion,artifactName:'electron',platform:'darwin',arch:process.arch,downloadOptions:{quiet:true,getProgressCallback:p=>{const current=Math.floor(p.percent*100);if(current>=percent+10){percent=current;progress(`macOS 런타임 다운로드 ${current}%`);}}}});
  // @electron/get verifies the official archive's SHA256. ditto preserves the
  // framework symlinks and executable permissions required by macOS bundles.
  progress('macOS 앱과 프레임워크를 풀고 있습니다.');
  await exec('/usr/bin/ditto',['-x','-k',zip,root],{timeout:180000});
  const appPath=path.join(root,`${safeName(project.title)}.app`);
  await fs.rename(path.join(root,'Electron.app'),appPath);
  const contents=path.join(appPath,'Contents'),resources=path.join(contents,'Resources');
  const rawFs=process.versions.electron?require('original-fs').promises:fs;
  await rawFs.rm(path.join(resources,'default_app.asar'),{force:true});
  progress('이야기·이미지·음악·엔딩 로고를 앱에 포함하고 있습니다.');
  const id=await writeNativeGame(project,dist,path.join(resources,'app'),raw),bundleId=`studio.hinana.game.${id}`;
  const displayName=project.title.replace(/\x00/g,'');
  const set=async(file,key,value)=>exec('/usr/bin/plutil',['-replace',key,'-string',value,file]);
  const plist=path.join(contents,'Info.plist');
  for(const [key,value] of Object.entries({CFBundleDisplayName:displayName,CFBundleName:displayName,CFBundleIdentifier:bundleId,CFBundleShortVersionString:project.metadata?.releaseVersion||'1.0.0',CFBundleVersion:project.metadata?.releaseVersion||'1.0.0'}))await set(plist,key,value);
  const icon=await projectIcon(project);if(icon){await fs.writeFile(path.join(resources,'game-icon.icns'),icns(icon));await set(plist,'CFBundleIconFile','game-icon.icns');}
  if(project.metadata?.copyright){try{await set(plist,'NSHumanReadableCopyright',project.metadata.copyright);}catch{await exec('/usr/bin/plutil',['-insert','NSHumanReadableCopyright','-string',project.metadata.copyright,plist]);}}
  const frameworks=path.join(contents,'Frameworks');
  for(const entry of await fs.readdir(frameworks)){
    if(!entry.startsWith('Electron Helper')||!entry.endsWith('.app'))continue;
    const helper=path.join(frameworks,entry,'Contents','Info.plist'),suffix=entry.slice(0,-4).toLowerCase().replace(/[^a-z0-9]+/g,'.');
    await set(helper,'CFBundleIdentifier',`${bundleId}.${suffix}`);
    await set(helper,'CFBundleDisplayName',`${displayName} Helper`);
  }
  for(const license of ['LICENSE','LICENSES.chromium.html']){
    try{await fs.copyFile(path.join(root,license),path.join(resources,license));}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  progress('이 Mac에서 실행할 수 있도록 앱을 서명하고 있습니다.');
  const entitlements=path.join(root,'.entitlements.plist');
  await fs.writeFile(entitlements,'<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>com.apple.security.cs.allow-jit</key><true/></dict></plist>');
  await exec('/usr/bin/codesign',['--force','--deep','--sign',signing==='distribution'?process.env.HINANA_MAC_SIGN_IDENTITY:'-',...(signing==='distribution'?['--options','runtime','--timestamp']:['--timestamp=none']),'--entitlements',entitlements,appPath],{timeout:180000,maxBuffer:1024*1024});
  await fs.rm(entitlements);
  await exec('/usr/bin/codesign',['--verify','--deep','--strict',appPath],{timeout:60000});
  await fs.writeFile(path.join(root,'PLAY.txt'),`${project.title}\n\n${path.basename(appPath)}을 실행하세요.\n${architecture} (${process.arch}) Mac용입니다. 이미지와 음악은 앱 안에 포함되어 있습니다.\n플레이 저장은 사용자 계정의 Application Support 폴더에 보관됩니다.\n${signing==='distribution'?'설정된 Developer ID로 서명한 앱입니다. Apple 공증은 포함하지 않습니다.':'로컬 테스트용 임시 서명을 사용하며 Developer ID 서명·공증은 포함하지 않습니다.'}\n`,'utf8');
  return appPath;
}

module.exports = { exportGame, safeName, writeGame };
