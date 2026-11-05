// Dev-only harness: open /test/export-harness.html?video=<url>&look=<look>
// Exports the project and reports results on window.__result.
import { initialProject, styleForLook } from '../src/core/presets';
import type { LookId, Project, Word } from '../src/core/types';
import { canExport, captionText, exportCover, exportVideo } from '../src/features/export';
import { autoEmphasis, markFillers, wordsFromText } from '../src/features/transcribe';

declare global {
  interface Window {
    __result?: unknown;
    __log: string[];
  }
}

window.__log = [];
const log = (s: string) => {
  window.__log.push(s);
  document.getElementById('log')!.textContent = window.__log.join('\n');
  console.log('[harness]', s);
};

const blobToBase64 = (b: Blob) =>
  new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(',')[1]);
    r.readAsDataURL(b);
  });

(async () => {
  const q = new URLSearchParams(location.search);
  const look = (q.get('look') ?? 'soft') as LookId;
  const useBlob = q.get('blob') !== '0';
  const format = (q.get('format') ?? '9:16') as Project['format'];
  try {
    const src = q.get('video') ?? '/__test/video.mp4';
    let url = src;
    if (useBlob) {
      const blob = await (await fetch(src)).blob();
      url = URL.createObjectURL(blob);
    }
    const duration = Number(q.get('duration') ?? 4);
    let words: Word[] = wordsFromText('Hoje eu vou te mostrar, né, como transformar seu conteúdo em vídeos incríveis. Tipo, simples assim.', duration);
    words = autoEmphasis(markFillers(words));
    words[2].sfx = 'whoosh';
    log(`words: ${words.map((w) => `${w.text}${w.removed ? '[X]' : ''}${w.emphasis ? '[*]' : ''}`).join(' ')}`);
    const project: Project = {
      ...initialProject(),
      look,
      format,
      style: styleForLook(look),
      video: { url, name: 'test.mp4', durationInSeconds: duration, width: 540, height: 960 },
      words,
      title: { enabled: true, kicker: 'ESSENCE · 01', text: 'Teste de exportação', durationInSeconds: 1.5 },
    };
    log(`caption:\n${captionText(project)}`);
    const can = await canExport(project);
    log(`canExport: ${JSON.stringify(can)}`);
    const t0 = performance.now();
    const cover = await exportCover(project);
    log(`cover: ${cover.type} ${cover.size} bytes in ${Math.round(performance.now() - t0)}ms`);
    const t1 = performance.now();
    let lastPct = -1;
    const mp4 = await exportVideo(project, {
      onProgress: (p) => {
        const pct = Math.floor(p.progress * 10);
        if (pct !== lastPct) {
          lastPct = pct;
          log(`progress ${p.message}`);
        }
      },
    });
    const ms = Math.round(performance.now() - t1);
    log(`mp4: ${mp4.type} ${mp4.size} bytes in ${ms}ms`);
    window.__result = { ok: true, ms, size: mp4.size, mp4: await blobToBase64(mp4), cover: await blobToBase64(cover) };
  } catch (e) {
    log(`ERROR: ${(e as Error).stack ?? e}`);
    window.__result = { ok: false, error: String((e as Error).stack ?? e) };
  }
})();
