const fs=require('node:fs/promises');
const path=require('node:path');
async function projectIcon(project){
 const asset=project.assets.find(a=>a.id===project.metadata?.icon);if(!asset)return null;
 if(process.versions.electron){const {nativeImage}=require('electron');const image=nativeImage.createFromDataURL(asset.url);if(image.isEmpty())throw Error('작품 아이콘을 읽지 못했습니다.');return image.resize({width:256,height:256,quality:'best'}).toPNG();}
 const match=/^data:image\/png;base64,(.+)$/.exec(asset.url);if(!match)throw Error('작품 설정에서 아이콘을 PNG로 다시 등록해 주세요.');const png=Buffer.from(match[1],'base64');if(png.length<24||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||png.readUInt32BE(16)>256||png.readUInt32BE(20)>256)throw Error('아이콘은 작품 설정에서 정규화한 PNG를 사용해 주세요.');return png;
}
function ico(png){const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header[6]=png.readUInt32BE(16)%256;header[7]=png.readUInt32BE(20)%256;header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);return Buffer.concat([header,png]);}
function icns(png){const width=png.readUInt32BE(16),type=width<=16?'icp4':width<=32?'icp5':width<=64?'icp6':width<=128?'ic07':'ic08';const header=Buffer.alloc(16);header.write('icns');header.writeUInt32BE(16+png.length,4);header.write(type,8);header.writeUInt32BE(8+png.length,12);return Buffer.concat([header,png]);}
async function brandWindows(project,file,png){
 const R=require('resedit'),exe=R.NtExecutable.from(await fs.readFile(file),{ignoreCert:true}),res=R.NtExecutableResource.from(exe),m=project.metadata??{},parts=(m.releaseVersion||'1.0.0').split('.').map(Number);
 const versions=R.Resource.VersionInfo.fromEntries(res.entries);const v=versions[0]??R.Resource.VersionInfo.createEmpty();v.setFileVersion(...parts,0,1033);v.setProductVersion(...parts,0,1033);v.setStringValues({lang:1033,codepage:1200},{FileDescription:m.description||project.title,ProductName:project.title,CompanyName:m.author||'Hinana Studio Story',LegalCopyright:m.copyright||'',OriginalFilename:path.basename(file)});v.outputToResourceEntries(res.entries);
 if(png){const icons=R.Data.IconFile.from(ico(png));const groups=res.entries.filter(e=>e.type===14);for(const group of groups.length?groups:[{id:101,lang:1033}])R.Resource.IconGroupEntry.replaceIconsForResource(res.entries,group.id,group.lang,icons.icons.map(i=>i.data));}
 res.outputResource(exe);await fs.writeFile(file,Buffer.from(exe.generate()));
}
module.exports={projectIcon,ico,icns,brandWindows};
