import { chromium } from 'playwright';
import { mkdir, readdir, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'assets');
const videoDir = path.join(outDir, 'promo-video');
const gifPath = path.join(outDir, 'promo.gif');

const WIDTH = 960;
const HEIGHT = 540;
const DURATION_MS = Number(process.env.DURATION_MS || 9000);

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

await mkdir(outDir, { recursive: true });
await mkdir(videoDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--enable-unsafe-swiftshader',
  ],
});
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: videoDir,
    size: { width: WIDTH, height: HEIGHT },
  },
});

const page = await context.newPage();
const PORT = process.env.VITE_PORT || '5199';
const URL = process.env.APP_URL || `http://localhost:${PORT}/`;
console.log(`Recording ${URL}`);
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(
  () => document.getElementById('status')?.textContent?.includes('segs'),
  { timeout: 30000 },
);
await page.waitForTimeout(800);

await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.lil-gui .name')];
  const bokehRow = labels.find((el) => el.textContent?.trim() === 'Bokeh DOF');
  const checkbox = bokehRow?.parentElement?.querySelector('input[type="checkbox"]');
  if (checkbox && !checkbox.checked) checkbox.click();
  const gui = document.querySelector('.lil-gui');
  if (gui) gui.style.display = 'none';
});

await page.waitForTimeout(DURATION_MS);
await context.close();
await browser.close();

const files = (await readdir(videoDir)).filter((f) => f.endsWith('.webm'));
if (!files.length) throw new Error('No video file recorded');
const webmPath = path.join(videoDir, files[0]);

await run('ffmpeg', [
  '-y',
  '-i',
  webmPath,
  '-vf',
  'fps=10,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=48:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5',
  '-loop',
  '0',
  gifPath,
]);

await unlink(webmPath).catch(() => {});
console.log(`GIF saved: ${gifPath}`);
