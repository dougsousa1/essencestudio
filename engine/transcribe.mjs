// Usage: node engine/transcribe.mjs "<project folder>" [language=pt] [model=small]
// Transcribes the project video locally with whisper.cpp and writes the words into project.json.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { downloadWhisperModel, installWhisperCpp, toCaptions, transcribe } from '@remotion/install-whisper-cpp';

const dir = resolve(process.argv[2] ?? '.');
const language = process.argv[3] ?? 'pt';
const model = process.argv[4] ?? 'small';
const tools = join(homedir(), '.essence-studio', 'whisper');
const project = JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8'));

await installWhisperCpp({ to: tools, version: '1.7.6', printOutput: false });
// A download cut in the middle leaves a broken file: remove it so it downloads again.
const modelFile = join(tools, `ggml-${model}.bin`);
if (existsSync(modelFile) && statSync(modelFile).size < 50 * 1024 * 1024) rmSync(modelFile);
await downloadWhisperModel({ model, folder: tools, printOutput: false });

const wav = join(dir, 'audio16k.wav');
if (!existsSync(wav)) execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', join(dir, project.video.url), '-ar', '16000', '-ac', '1', wav]);

const out = await transcribe({ inputPath: wav, whisperPath: tools, whisperCppVersion: '1.7.6', model, tokenLevelTimestamps: true, language, printOutput: false });
const { captions } = toCaptions({ whisperCppOutput: out });

const words = [];
for (const c of captions) {
  const text = c.text.trim();
  if (!text) continue;
  // Whisper splits words into pieces; a piece without a leading space continues the previous word.
  if (!/^\s/.test(c.text) && words.length) {
    const last = words[words.length - 1];
    last.text += text;
    last.end = c.endMs / 1000;
    continue;
  }
  // Punctuation-only tokens stick to the previous word.
  if (/^[.,!?;:…]+$/.test(text) && words.length) {
    words[words.length - 1].text += text;
    continue;
  }
  words.push({ id: `w${words.length}`, text, start: c.startMs / 1000, end: c.endMs / 1000, removed: false, emphasis: false, sfx: null });
}
project.words = words;
writeFileSync(join(dir, 'project.json'), JSON.stringify(project, null, 2));
writeFileSync(join(dir, 'transcript.md'), words.map((w) => `[${w.id} ${w.start.toFixed(2)}] ${w.text}`).join('\n'));
console.log(`${words.length} palavras transcritas.`);
