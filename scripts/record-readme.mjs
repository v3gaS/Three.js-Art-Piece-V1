import { chromium } from 'playwright';
import { mkdir, readdir, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'assets');
const videoDir = path.join(outDir, 'readme-video');
const gifPath = path.join(outDir, 'demo.gif');

const WIDTH = 1280;
const HEIGHT = 720;
const DURATION_MS = Number(process.env.DURATION_MS || 10000);
const OUTPUT_WIDTH = Number(process.env.OUTPUT_WIDTH || 720);
const FPS = Number(process.env.FPS || 10);
const MAX_COLORS = Number(process.env.MAX_COLORS || 64);

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
const URL = process.env.APP_URL || `http://localhost:${PORT}/?demo=1`;
console.log(`Recording README demo: ${URL}`);
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(
  () => document.getElementById('status')?.textContent?.includes('segs'),
  { timeout: 30000 },
);
await page.waitForTimeout(1500);

await page.evaluate(() => {
  const gui = document.querySelector('.lil-gui');
  if (gui) gui.style.display = 'none';
  const status = document.getElementById('status');
  if (status) status.style.display = 'none';
});

await page.waitForTimeout(DURATION_MS);
await context.close();
await browser.close();

const files = (await readdir(videoDir)).filter((f) => f.endsWith('.webm'));
if (!files.length) throw new Error('No video file recorded');
const webmPath = path.join(videoDir, files[0]);

const paletteFilter = [
  `fps=${FPS}`,
  `scale=${OUTPUT_WIDTH}:-1:flags=lanczos`,
  'split[s0][s1]',
  `[s0]palettegen=max_colors=${MAX_COLORS}:stats_mode=diff:reserve_transparent=0[p]`,
  '[s1][p]paletteuse=dither=bayer:bayer_scale=4',
].join(',');

await run('ffmpeg', ['-y', '-ss', '0.4', '-i', webmPath, '-vf', paletteFilter, '-t', '10', '-loop', '0', gifPath]);

await unlink(webmPath).catch(() => {});

try {
  const optimizedPath = `${gifPath}.opt`;
  await run('gifsicle', ['-O3', '--lossy=40', '--colors', '64', gifPath, '-o', optimizedPath]);
  await run('mv', [optimizedPath, gifPath]);
  console.log('Optimized with gifsicle');
} catch {
  console.log('gifsicle not available — using raw ffmpeg output');
}

console.log(`README GIF saved: ${gifPath}`);
