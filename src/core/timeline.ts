import type { Project, Segment, Timeline, TimedWord } from './types';

export const FPS = 30;

export const FORMAT_SIZE = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
} as const;

/**
 * Turns the transcript + cut settings into kept segments of the source video
 * and words re-timed to the output.
 */
export const buildTimeline = (project: Project): Timeline => {
  const video = project.video;
  if (!video) return { segments: [], words: [], durationInSeconds: 1 };

  const total = video.durationInSeconds;
  const { words, cut } = project;
  const hasCuts = words.length > 0 && (cut.removeSilences || words.some((w) => w.removed));

  // Ranges of source time to keep.
  let keep: Array<[number, number]>;
  if (!hasCuts) {
    keep = [[0, total]];
  } else if (cut.removeSilences) {
    keep = [];
    for (const w of words) {
      if (w.removed) continue;
      const s = Math.max(0, w.start - cut.padding);
      const e = Math.min(total, w.end + cut.padding);
      const last = keep[keep.length - 1];
      if (last && s - last[1] <= cut.minSilence) last[1] = Math.max(last[1], e);
      else keep.push([s, e]);
    }
  } else {
    // Keep everything except removed words.
    keep = [[0, total]];
    for (const w of words) {
      if (!w.removed) continue;
      const next: Array<[number, number]> = [];
      for (const [s, e] of keep) {
        if (w.end <= s || w.start >= e) next.push([s, e]);
        else {
          if (w.start > s) next.push([s, w.start]);
          if (w.end < e) next.push([w.end, e]);
        }
      }
      keep = next;
    }
  }
  keep = keep.filter(([s, e]) => e - s > 1 / FPS);
  if (keep.length === 0) keep = [[0, Math.min(total, 1)]];

  // Snap to frames so segments line up exactly.
  const segments: Segment[] = [];
  let out = 0;
  for (const [s, e] of keep) {
    const srcStart = Math.round(s * FPS) / FPS;
    const srcEnd = Math.round(e * FPS) / FPS;
    if (srcEnd - srcStart <= 0) continue;
    segments.push({ srcStart, srcEnd, outStart: out });
    out += srcEnd - srcStart;
  }

  const toOut = (t: number): number | null => {
    for (const seg of segments) {
      if (t >= seg.srcStart && t <= seg.srcEnd) return seg.outStart + (t - seg.srcStart);
    }
    return null;
  };

  const timed: TimedWord[] = [];
  for (const w of words) {
    if (w.removed) continue;
    const a = toOut(Math.max(w.start, 0));
    const b = toOut(w.end) ?? (a !== null ? a + (w.end - w.start) : null);
    if (a === null || b === null) continue;
    timed.push({ ...w, outStart: a, outEnd: Math.max(b, a + 0.05) });
  }

  return { segments, words: timed, durationInSeconds: Math.max(out, 1 / FPS) };
};

export const durationInFrames = (t: Timeline) => Math.max(1, Math.round(t.durationInSeconds * FPS));

/** Group words into caption "pages". */
export const paginate = (words: TimedWord[], perPage: number): TimedWord[][] => {
  const pages: TimedWord[][] = [];
  let cur: TimedWord[] = [];
  for (const w of words) {
    const prev = cur[cur.length - 1];
    const gap = prev ? w.outStart - prev.outEnd : 0;
    const endsSentence = prev ? /[.!?…]$/.test(prev.text.trim()) : false;
    if (cur.length >= perPage || gap > 0.6 || endsSentence) {
      if (cur.length) pages.push(cur);
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) pages.push(cur);
  return pages;
};
