// Speech-to-text in the browser (Whisper on WebGPU) + transcript helpers.
import type { WhisperWebGpuModel } from '@remotion/whisper-webgpu';
import type { Word } from '../core/types';

export type TranscribeProgress = {
  stage: 'checking' | 'downloading' | 'audio' | 'transcribing' | 'done';
  progress: number; // 0..1
  message: string;
};

/**
 * Default model: multilingual "base" (~206 MB download, cached after the first
 * time). "small" is better for Portuguese but ~586 MB, too heavy as a default.
 */
export const DEFAULT_MODEL: WhisperWebGpuModel = 'base';

// Lazy import so the (large) whisper / transformers bundle only loads when used.
const whisper = () => import('@remotion/whisper-webgpu');

export async function canTranscribe(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { canUseWhisperWebGpu } = await whisper();
    const res = await canUseWhisperWebGpu();
    if (res.supported) return { ok: true };
    const reasons: Record<string, string> = {
      'window-undefined': 'A transcrição só funciona no navegador.',
      'webgpu-unavailable': 'Seu navegador não tem WebGPU. Use o Chrome ou Edge atualizado no computador — ou cole o texto manualmente.',
      'webgpu-requires-secure-context': 'A transcrição precisa de uma conexão segura (https ou localhost).',
    };
    return { ok: false, reason: reasons[res.reason] ?? `Transcrição indisponível neste navegador (${res.detailedReason}).` };
  } catch (e) {
    return { ok: false, reason: `Não foi possível carregar o transcritor: ${(e as Error).message}` };
  }
}

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Transcrição cancelada', 'AbortError');
};

export async function transcribeFile(
  file: Blob,
  opts: { language?: string; model?: WhisperWebGpuModel; onProgress?: (p: TranscribeProgress) => void; signal?: AbortSignal } = {},
): Promise<Word[]> {
  const { language = 'pt', model = DEFAULT_MODEL, onProgress, signal } = opts;
  const report = (p: TranscribeProgress) => onProgress?.(p);

  report({ stage: 'checking', progress: 0, message: 'Verificando o navegador…' });
  const check = await canTranscribe();
  if (!check.ok) throw new Error(check.reason);
  const w = await whisper();
  throwIfAborted(signal);

  report({ stage: 'downloading', progress: 0, message: 'Baixando o modelo de transcrição…' });
  const dl = await w.downloadWhisperModel({
    model,
    signal,
    onProgress: (p) => {
      const mb = (n: number) => Math.round(n / 1e6);
      report({
        stage: 'downloading',
        progress: Math.max(0, Math.min(1, p.progress)),
        message: p.totalBytes > 0 ? `Baixando o modelo… ${mb(p.loadedBytes)} de ${mb(p.totalBytes)} MB` : 'Baixando o modelo…',
      });
    },
  });
  if (dl.alreadyDownloaded) report({ stage: 'downloading', progress: 1, message: 'Modelo já está salvo neste navegador.' });
  throwIfAborted(signal);

  report({ stage: 'audio', progress: 0, message: 'Extraindo o áudio…' });
  const waveform = await w.resampleTo16Khz({
    file,
    onProgress: (p) => report({ stage: 'audio', progress: p, message: 'Extraindo o áudio…' }),
  });
  throwIfAborted(signal);

  const audioSeconds = waveform.length / w.WHISPER_WEBGPU_SAMPLE_RATE;
  report({ stage: 'transcribing', progress: 0, message: 'Transcrevendo… isso pode levar um minuto.' });
  // transcribe() has no progress callback: estimate (~3x realtime on a laptop GPU).
  const started = performance.now();
  const timer = setInterval(() => {
    const elapsed = (performance.now() - started) / 1000;
    const est = Math.max(5, audioSeconds / 3);
    report({ stage: 'transcribing', progress: Math.min(0.95, elapsed / est), message: 'Transcrevendo… isso pode levar um minuto.' });
  }, 500);
  let result;
  try {
    result = await w.transcribe({ channelWaveform: waveform, model, language, signal });
  } finally {
    clearInterval(timer);
  }

  const words = normalizeWords(
    result.words.map((x) => ({ text: x.text, start: x.startInSeconds, end: x.endInSeconds })),
    audioSeconds,
  );
  report({ stage: 'done', progress: 1, message: `Pronto! ${words.length} palavras.` });
  return words;
}

/** Trim, drop empty tokens, merge stray punctuation, enforce monotonic times. */
const normalizeWords = (raw: Array<{ text: string; start: number; end: number }>, maxSeconds: number): Word[] => {
  const out: Word[] = [];
  let last = 0;
  for (const r of raw) {
    const text = r.text.trim();
    if (!text) continue;
    // Punctuation-only token: attach to the previous word.
    if (/^[\p{P}\p{S}]+$/u.test(text) && out.length) {
      const prev = out[out.length - 1];
      prev.text += text;
      prev.end = Math.max(prev.end, Math.min(maxSeconds || Infinity, Number.isFinite(r.end) ? r.end : prev.end));
      last = prev.end;
      continue;
    }
    let start = Number.isFinite(r.start) ? r.start : last;
    let end = Number.isFinite(r.end) ? r.end : start + 0.3;
    start = Math.max(start, last);
    end = Math.max(end, start + 0.05);
    if (maxSeconds > 0) {
      start = Math.min(start, maxSeconds);
      end = Math.min(end, maxSeconds);
    }
    out.push({ id: '', text, start, end, removed: false, emphasis: false, sfx: null });
    last = end;
  }
  return out.map((w, i) => ({ ...w, id: `w${i}` }));
};

/** Fallback without WebGPU: spread pasted text evenly over the video. */
export function wordsFromText(text: string, durationInSeconds: number): Word[] {
  const tokens = text.split(/\s+/).map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return [];
  const dur = Math.max(0.1, durationInSeconds);
  // Weight each word by its length (+ a pause after sentence ends) for a more natural pace.
  const weights = tokens.map((t) => 1 + t.length * 0.12 + (/[.!?…]$/.test(t) ? 0.8 : /[,;:]$/.test(t) ? 0.35 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let t = 0;
  return tokens.map((tok, i) => {
    const slot = (weights[i] / total) * dur;
    const start = t;
    t += slot;
    return { id: `w${i}`, text: tok, start, end: Math.min(dur, start + slot * 0.92), removed: false, emphasis: false, sfx: null };
  });
}

// Always fillers (pure hesitation sounds / tics).
const STRONG_FILLERS = ['hã', 'hãã', 'ã', 'ãã', 'ahn', 'ah', 'ahh', 'eh', 'ehh', 'éé', 'ééé', 'hum', 'humm', 'hmm', 'hmmm', 'mm', 'mmm', 'né', 'uh', 'uhh', 'um', 'umm', 'er', 'erm'];
// Real words that are only fillers in context ("é" = "is", "tipo de", "so good"...):
// removed only when isolated by punctuation or a pause.
const WEAK_FILLERS = ['é', 'tipo', 'então', 'aí', 'like', 'so'];

export const FILLERS: string[] = [...STRONG_FILLERS, ...WEAK_FILLERS];

const normalizeToken = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();

const STRONG_SET = new Set(STRONG_FILLERS);
const WEAK_SET = new Set(WEAK_FILLERS);
// Hesitation sounds of any length ("éééé", "hmmmm", "ahhh", "uhhh").
const HESITATION = /^(éé+|e+h+|h?ã+|a+h+n?|h?u+m+|h+m+|m+|u+h+|e+r+m*)$/u;

export function markFillers(words: Word[]): Word[] {
  return words.map((w, i) => {
    const n = normalizeToken(w.text);
    if (!n) return w;
    if (STRONG_SET.has(n) || HESITATION.test(n)) return { ...w, removed: true };
    if (WEAK_SET.has(n)) {
      const prev = words[i - 1];
      const next = words[i + 1];
      const punctAfter = /[,.…!?;:]$/.test(w.text.trim());
      const repeated = (prev && normalizeToken(prev.text) === n) || (next && normalizeToken(next.text) === n);
      const pauseBefore = !prev || w.start - prev.end > 0.3;
      const pauseAfter = !next || next.start - w.end > 0.3;
      if (punctAfter || repeated || (pauseBefore && pauseAfter)) return { ...w, removed: true };
    }
    return w;
  });
}

const STOPWORDS = new Set(
  (
    // pt
    'a o as os um uma uns umas de do da dos das no na nos nas em por para pra pro com sem sob sobre entre até ' +
    'e ou mas que se como quando onde porque porquê pois então também muito muita muitos muitas mais menos ' +
    'eu tu ele ela nós vós eles elas você vocês me te lhe nos vos se meu minha meus minhas seu sua seus suas ' +
    'nosso nossa nossos nossas este esta estes estas esse essa esses essas aquele aquela aqueles aquelas isso isto aquilo ' +
    'ser estar ter haver é são era foi foram está estão estava tem têm tinha vai vou vamos ' +
    'fazer faz feito pode podem posso poder sempre nunca ainda agora aqui ali lá já só não sim tipo assim coisa coisas ' +
    'quero queria acho sabe gente todo toda todos todas outro outra outros outras qual quais quem cada mesmo mesma ' +
    'porque depois antes ' +
    // en
    'the a an of to in on at for with without from by and or but that this these those there their they them ' +
    'you your yours we our ours he she his her it its is are was were be been being have has had do does did ' +
    'not just very really about because which would could should will can what when where while into than then'
  ).split(/\s+/),
);

export function autoEmphasis(words: Word[]): Word[] {
  const res = words.map((w) => ({ ...w, emphasis: false }));
  const candidates = (i: number) => {
    const w = res[i];
    if (w.removed) return -1;
    const n = normalizeToken(w.text);
    const letters = n.replace(/[^\p{L}]/gu, '');
    if (letters.length < 5 || STOPWORDS.has(n)) return -1;
    // Score: longer words, words right before punctuation (end of idea), numbers.
    return letters.length + (/[.!?…,]$/.test(w.text) ? 2 : 0) + (/\d/.test(w.text) ? 3 : 0);
  };
  // Work in windows of ~6 kept words; pick the best candidate in each window.
  const kept = res.map((w, i) => (w.removed ? -1 : i)).filter((i) => i >= 0);
  const WINDOW = 6;
  let lastPicked = -10;
  for (let k = 0; k < kept.length; k += WINDOW) {
    let best = -1;
    let bestScore = -1;
    for (let j = k; j < Math.min(kept.length, k + WINDOW); j++) {
      if (j - lastPicked < 2) continue; // never two in a row
      const sc = candidates(kept[j]);
      if (sc > bestScore) {
        bestScore = sc;
        best = j;
      }
    }
    if (best >= 0 && bestScore > 0) {
      res[kept[best]].emphasis = true;
      lastPicked = best;
    }
  }
  return res;
}
