import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const dir = await mkdtemp(path.join(tmpdir(), 'hinana-smoke-'));
const app = await electron.launch({ ...(process.env.ELECTRON_BINARY ? { executablePath: process.env.ELECTRON_BINARY } : {}), args: [...(process.env.ELECTRON_BINARY ? [] : ['.']), `--user-data-dir=${dir}`] });
try {
  const page = await app.firstWindow();
  await page.getByRole('heading', { name: '프롤로그 · 다시 만난 여름', exact: true }).waitFor();
  assert.equal(await page.title(), 'Hinana Studio Story');
  assert.equal(await page.evaluate(() => typeof window.studio?.save), 'function');
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  const prefs = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert.equal(prefs.contextIsolation, true);
  assert.equal(prefs.sandbox, true);
  assert.equal(prefs.nodeIntegration, false);
  await page.getByRole('button', { name: '정보', exact: true }).click();
  await page.getByRole('dialog', { name: 'HINANA STUDIO STORY' }).getByText('Ver. 0.7.0').waitFor();
  await page.keyboard.press('Escape');
  const saved = path.join(dir, 'native.hinanastory');
  await app.evaluate(({ dialog }, saved) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: saved }); }, saved);
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '프로젝트 파일을 저장했습니다.' }).waitFor();
  const data = JSON.parse(await readFile(saved, 'utf8'));
  assert.equal(data.title, '여름의 끝에서');
  await page.getByRole('textbox', { name: '프로젝트 이름' }).fill('변경한 제목');
  await app.evaluate(({ dialog }, saved) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [saved] }); }, saved);
  await page.getByRole('button', { name: '열기', exact: true }).click();
  await page.getByRole('dialog',{name:'변경 사항 저장'}).getByRole('button',{name:'저장하지 않고 계속'}).click();
  await page.getByRole('status').filter({ hasText: '프로젝트를 열었습니다.' }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: '프로젝트 이름' }).inputValue(), '여름의 끝에서');
  await page.screenshot({ path: 'test-results/electron.png' });
  console.log('PASS: packaged renderer in Electron, sandbox/isolation, native filesystem save/open roundtrip');
} finally {
  await app.evaluate(({ BrowserWindow }) => { for (const win of BrowserWindow.getAllWindows()) win.destroy(); });
  await app.close();
  await rm(dir, { recursive: true, force: true });
}
