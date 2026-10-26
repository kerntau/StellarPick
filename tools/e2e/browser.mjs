import { existsSync } from 'node:fs';

// Resolve a Chrome/Chromium binary once for every E2E script.
// CHROME_PATH always wins; otherwise try the usual Windows/Linux/macOS paths.
const candidates = [
  process.env.CHROME_PATH,
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter((candidate) => typeof candidate === 'string' && candidate.length > 0);

export const CHROME = candidates.find((candidate) => existsSync(candidate));

if (!CHROME) {
  throw new Error(
    '未找到 Chrome/Chromium。请安装 Google Chrome 或 Chromium，或设置 CHROME_PATH 指向可执行文件。'
  );
}
