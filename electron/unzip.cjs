const yauzl = require('yauzl');
const fs = process.versions.electron ? require('original-fs') : require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
async function unzip(zipPath, root) {
  const zip = await new Promise((resolve, reject) => yauzl.open(zipPath, { lazyEntries: true }, (error, zip) => error ? reject(error) : resolve(zip)));
  await new Promise((resolve, reject) => {
    const fail = error => { zip.close(); reject(error); };
    let total = 0;
    zip.on('error', fail);
    zip.on('end', resolve);
    zip.on('entry', entry => {
      void (async () => {
        const segments = entry.fileName.split('/');
        if (segments.some(s => s === '..' || s.includes('\\') || s.includes(':')) || path.isAbsolute(entry.fileName)) throw new Error('압축 파일 경로가 올바르지 않습니다.');
        if (((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000) throw new Error('심볼릭 링크는 허용하지 않습니다.');
        total += entry.uncompressedSize;
        if (total > 2 * 1024 * 1024 * 1024) throw new Error('런타임 압축 크기가 너무 큽니다.');
        const destination = path.resolve(root, ...segments);
        if (!destination.startsWith(path.resolve(root) + path.sep)) throw new Error('압축 경로가 허용 범위를 벗어납니다.');
        if (entry.fileName.endsWith('/')) await fsp.mkdir(destination, { recursive: true });
        else {
          await fsp.mkdir(path.dirname(destination), { recursive: true });
          const source = await new Promise((resolve, reject) => zip.openReadStream(entry, (error, stream) => error ? reject(error) : resolve(stream)));
          await pipeline(source, fs.createWriteStream(destination, { flags: 'wx' }));
        }
        zip.readEntry();
      })().catch(fail);
    });
    zip.readEntry();
  });
}
module.exports = { unzip };
