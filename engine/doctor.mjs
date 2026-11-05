// Usage: node engine/doctor.mjs
// Checks everything Essence Studio needs and ends with one plain verdict:
// PRONTO · PRONTO COM LIMITES (funciona, falta algo opcional) · FALTANDO (resolva antes de editar).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statfsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const home = join(homedir(), '.essence-studio');
let missing = false;
let limits = false;
const ok = (t) => console.log(`  ✅ ${t}`);
const warn = (t, fix) => {
  console.log(`  ⚠️  ${t}\n     ${fix}`);
  limits = true;
};
const no = (t, fix) => {
  console.log(`  ❌ ${t}\n     como resolver: ${fix}`);
  missing = true;
};
const has = (cmd, args = ['-version']) => {
  try {
    execFileSync(cmd, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const mac = platform() === 'darwin';
const win = platform() === 'win32';

console.log('Checagem do Essence Studio');

const major = Number(process.versions.node.split('.')[0]);
major >= 20 ? ok(`Node.js ${process.versions.node}`) : no(`Node.js ${process.versions.node} (precisa da versão 20 ou mais nova)`, win ? 'winget install OpenJS.NodeJS.LTS' : 'baixe a versão LTS em https://nodejs.org');

const ffFix = mac ? 'brew install ffmpeg' : win ? 'winget install Gyan.FFmpeg' : 'sudo apt install ffmpeg';
has('ffmpeg') ? ok('ffmpeg') : no('ffmpeg', ffFix);
has('ffprobe') ? ok('ffprobe') : no('ffprobe', ffFix);

existsSync(join(root, 'node_modules', '@remotion', 'renderer'))
  ? ok('motor de vídeo (Remotion)')
  : no('motor de vídeo não instalado', `cd "${root}" && npm install`);

const whisperDir = join(home, 'whisper');
const model = existsSync(whisperDir) && readdirSync(whisperDir).some((f) => f.startsWith('ggml-') && f.endsWith('.bin'));
model ? ok('modelo de transcrição (Whisper)') : warn('modelo de transcrição ainda não baixado', 'ele baixa sozinho na primeira transcrição (cerca de 500 MB)');

existsSync(join(home, 'marca.json')) ? ok('arquivo de marca') : console.log('  ➖ ainda sem arquivo de marca: a entrevista de marca cria um na primeira edição');

if (!mac && !win) warn('sistema fora do foco', 'o Essence Studio é feito para Mac e Windows; no Linux pode funcionar, mas sem garantia');

try {
  const s = statfsSync(homedir());
  const freeGb = (s.bavail * s.bsize) / 1024 ** 3;
  freeGb >= 3 ? ok(`espaço livre: ${freeGb.toFixed(0)} GB`) : warn(`pouco espaço livre: ${freeGb.toFixed(1)} GB`, 'libere pelo menos 3 GB para as ferramentas e os vídeos');
} catch {
  /* statfs not available: skip */
}

console.log(missing ? '\nFALTANDO: resolva os itens com ❌ antes de editar.' : limits ? '\nPRONTO COM LIMITES: já dá para editar.' : '\nPRONTO: é só arrastar um vídeo e pedir para editar.');
process.exit(missing ? 1 : 0);
