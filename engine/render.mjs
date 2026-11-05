// Usage: node engine/render.mjs "<project folder>" [--draft]
// Renders project.json to <project>/out/reel.mp4 with the full Remotion renderer (headless Chrome).
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(process.argv[2] ?? '.');
const draft = process.argv.includes('--draft');
// Optional: use an existing Chrome instead of Remotion's download (ESSENCE_BROWSER=/path/to/chrome).
const browserExecutable = process.env.ESSENCE_BROWSER || null;
// Only for test machines behind an inspecting proxy.
const chromiumOptions = process.env.ESSENCE_INSECURE_TLS === '1' ? { ignoreCertificateErrors: true } : {};

// Public folder for this render: the project's video + the sound pack.
const pub = join(dir, '.render-public');
mkdirSync(pub, { recursive: true });
cpSync(join(root, 'public', 'sfx'), join(pub, 'sfx'), { recursive: true });
const raw = JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8'));
cpSync(join(dir, raw.video.url), join(pub, raw.video.url));

// Missing settings are filled with the studio defaults inside the composition.
const project = { ...raw, assetBase: 'static' };

const serveUrl = await bundle({ entryPoint: join(root, 'src', 'remotion', 'index.ts'), publicDir: pub });
const inputProps = { project };
const composition = await selectComposition({ serveUrl, id: 'Main', inputProps, browserExecutable, chromiumOptions, chromiumOptions });
mkdirSync(join(dir, 'out'), { recursive: true });
const output = join(dir, 'out', draft ? 'rascunho.mp4' : 'reel.mp4');
let last = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation: output,
  inputProps,
  browserExecutable,
  chromiumOptions,
  scale: draft ? 0.5 : 1,
  crf: draft ? 28 : 18,
  onProgress: ({ progress }) => {
    const p = Math.floor(progress * 10);
    if (p !== last) {
      last = p;
      console.log(`Gerando… ${p * 10}%`);
    }
  },
});
await renderStill({ composition, serveUrl, inputProps, browserExecutable, chromiumOptions, output: join(dir, 'out', 'capa.jpg'), imageFormat: 'jpeg', frame: Math.min(composition.durationInFrames - 1, 30) });
console.log(`Pronto: ${output}`);
