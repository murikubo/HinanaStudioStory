function exportActions({platform,openPath}){
  const completed=new Map();
  function lookup(root){const result=completed.get(root);if(!result)throw new Error('이 실행 중에 내보낸 작품만 열 수 있습니다.');return result;}
  return {
    remember(result){completed.set(result.path,result);},
    async launch(root){
      const result=lookup(root);
      if(result.launchable===false)throw new Error('현재 운영체제에서 바로 실행할 수 없는 배포 형식입니다. 폴더에서 배포 파일을 확인해 주세요.');
      const file=platform==='darwin'&&result.target==='macos'?result.appPath:platform==='win32'&&result.target==='windows'?result.executable:null;
      if(!file)throw new Error('현재 운영체제에서 실행할 수 있는 게임을 내보내 주세요.');
      const error=await openPath(file);if(error)throw new Error(`게임을 실행하지 못했습니다: ${error}`);
    },
    async reveal(root){const result=lookup(root);const error=await openPath(result.path);if(error)throw new Error(`폴더를 열지 못했습니다: ${error}`);}
  };
}
module.exports={exportActions};
