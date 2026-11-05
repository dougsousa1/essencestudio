// MP4 export + cover image + post caption, all client-side.
import { buildTimeline, durationInFrames, FORMAT_SIZE, FPS } from '../core/timeline';
import { ensureFont } from '../core/fonts';
import type { Project } from '../core/types';
import { Main } from '../remotion/Main';

export type ExportProgress = { progress: number; message: string };

const renderer = () => import('@remotion/web-renderer');

const compositionFor = (project: Project) => {
  const { width, height } = FORMAT_SIZE[project.format];
  const timeline = buildTimeline(project);
  return {
    timeline,
    composition: {
      id: 'Main',
      component: Main,
      width,
      height,
      fps: FPS,
      durationInFrames: durationInFrames(timeline),
      defaultProps: { project },
    },
  };
};

const loadFonts = (project: Project) =>
  Promise.all([project.style.titleFont, project.style.captionFont, project.style.accentFont].map((f) => ensureFont(f)));

export async function canExport(project: Project): Promise<{ ok: boolean; reason?: string }> {
  if (!project.video) return { ok: false, reason: 'Envie um vídeo primeiro.' };
  if (typeof window === 'undefined' || typeof VideoEncoder === 'undefined') {
    return { ok: false, reason: 'Seu navegador não suporta exportação de vídeo (WebCodecs). Use o Chrome ou Edge atualizado.' };
  }
  try {
    const { canRenderMediaOnWeb } = await renderer();
    const { width, height } = FORMAT_SIZE[project.format];
    const res = await canRenderMediaOnWeb({ container: 'mp4', videoCodec: 'h264', width, height });
    if (res.canRender) return { ok: true };
    const err = res.issues.find((i) => i.severity === 'error');
    return { ok: false, reason: `Não é possível exportar neste navegador${err ? `: ${err.message}` : '.'}` };
  } catch (e) {
    return { ok: false, reason: `Não foi possível preparar a exportação: ${(e as Error).message}` };
  }
}

export async function exportVideo(
  project: Project,
  opts: { onProgress?: (p: ExportProgress) => void; signal?: AbortSignal; quality?: 'medium' | 'high' } = {},
): Promise<Blob> {
  const { onProgress, signal, quality = 'high' } = opts;
  if (!project.video) throw new Error('Envie um vídeo primeiro.');
  onProgress?.({ progress: 0, message: 'Carregando fontes…' });
  await loadFonts(project);
  const { renderMediaOnWeb } = await renderer();
  const { composition } = compositionFor(project);
  onProgress?.({ progress: 0, message: 'Preparando a exportação…' });
  const res = await renderMediaOnWeb({
    composition,
    inputProps: { project },
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    videoBitrate: quality,
    signal: signal ?? null,
    licenseKey: 'free-license',
    isProduction: false,
    onProgress: (p) => {
      const pct = Math.round(p.progress * 100);
      onProgress?.({ progress: p.progress, message: `Renderizando o vídeo… ${pct}%` });
    },
  });
  onProgress?.({ progress: 1, message: 'Finalizando o arquivo…' });
  const blob = await res.getBlob();
  onProgress?.({ progress: 1, message: 'Vídeo pronto!' });
  return blob;
}

export async function exportCover(project: Project, atSeconds?: number): Promise<Blob> {
  if (!project.video) throw new Error('Envie um vídeo primeiro.');
  await loadFonts(project);
  const { renderStillOnWeb } = await renderer();
  const { composition, timeline } = compositionFor(project);
  let t = atSeconds;
  if (t === undefined) {
    const titleEnd = project.title.enabled ? project.title.durationInSeconds : 0;
    const em = timeline.words.find((w) => w.emphasis && w.outStart >= titleEnd);
    // A few frames into the word so its pop-in animation has settled.
    t = em ? em.outStart + 0.25 : Math.min(1, timeline.durationInSeconds / 2);
  }
  const frame = Math.max(0, Math.min(composition.durationInFrames - 1, Math.round(t * FPS)));
  const res = await renderStillOnWeb({
    composition,
    frame,
    inputProps: { project },
    licenseKey: 'free-license',
    isProduction: false,
  });
  return res.blob({ format: 'jpeg', quality: 0.92 });
}

const HASHTAG_STOP = new Set(
  (
    'para pra com sem sobre como quando onde porque entao tambem muito muita mais menos voce voces isso isto aquilo esse essa este esta ' +
    'sempre nunca ainda agora aqui depois antes coisa coisas gente todos todas outro outra mesmo mesma quero queria acho sabe fazer estou estava ' +
    'about because which would could should there their these those really'
  ).split(/\s+/),
);

/** Post caption: transcript with the first sentence as hook + 3 hashtags. */
export function captionText(project: Project): string {
  const words = project.words.filter((w) => !w.removed).map((w) => w.text.trim()).filter(Boolean);
  const text = words.join(' ').replace(/\s+([,.!?…;:])/g, '$1').trim();
  const titleText = project.title.enabled ? project.title.text.trim() : '';
  if (!text) return titleText;
  const m = text.match(/^(.+?[.!?…])(\s|$)/);
  let hook = (m ? m[1] : text.split(' ').slice(0, 12).join(' ')).trim();
  let rest = text.slice(m ? m[1].length : hook.length).trim();
  rest = rest.charAt(0).toUpperCase() + rest.slice(1);
  if (!m && rest) hook += '…';

  // Hashtags: emphasis words first, then the most frequent long content words.
  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '');
  const counts = new Map<string, number>();
  for (const w of project.words) {
    if (w.removed) continue;
    const c = clean(w.text);
    if (c.length < 5 || HASHTAG_STOP.has(c)) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1 + (w.emphasis ? 3 : 0));
  }
  const tags = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 3)
    .map(([w]) => `#${w}`);

  return [hook, rest, tags.join(' ')].filter(Boolean).join('\n\n');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
