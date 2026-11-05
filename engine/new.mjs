// Usage: node engine/new.mjs "<video>" "<project folder>"
// Creates the project folder, copies the video and writes project.json.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, basename, extname } from 'node:path';

const [video, dir] = process.argv.slice(2);
if (!video || !dir) throw new Error('Uso: node engine/new.mjs "<vídeo>" "<pasta do projeto>"');
const out = resolve(dir);
mkdirSync(join(out, 'out'), { recursive: true });
const src = `source${extname(video).toLowerCase() || '.mp4'}`;
copyFileSync(video, join(out, src));
const probe = JSON.parse(
  execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', join(out, src)]).toString(),
);
const width = probe.streams[0].width;
const height = probe.streams[0].height;
const r = width / height;
const project = {
  video: { url: src, name: basename(video), durationInSeconds: Number(probe.format.duration), width, height },
  format: r < 0.8 ? '9:16' : r > 1.25 ? '16:9' : '1:1',
  words: [],
  effects: [],
};
writeFileSync(join(out, 'project.json'), JSON.stringify(project, null, 2));
console.log(`Projeto criado em ${out}`);
