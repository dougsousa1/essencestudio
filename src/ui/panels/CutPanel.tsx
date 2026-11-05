import React, { useMemo, useRef, useState } from 'react';
import { useStudio } from '../../core/store';
import { buildTimeline } from '../../core/timeline';
import type { SfxId } from '../../core/types';
import { autoEmphasis, canTranscribe, markFillers, transcribeFile, wordsFromText, type TranscribeProgress } from '../../features/transcribe';
import { Button, Progress, Section, Segmented, Slider, Toggle, fmtTime } from '../kit';

type Tool = 'cut' | 'emphasis' | 'sfx';

export const CutPanel: React.FC = () => {
  const { project, setWords, updateWord, setCut, setStep } = useStudio();
  const [progress, setProgress] = useState<TranscribeProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [text, setText] = useState('');
  const [tool, setTool] = useState<Tool>('cut');
  const [language, setLanguage] = useState('pt');
  const [model, setModel] = useState<'base' | 'small'>('base');
  const abort = useRef<AbortController | null>(null);
  const timeline = useMemo(() => buildTimeline(project), [project]);
  const words = project.words;
  const video = project.video;

  const run = async () => {
    if (!video) return;
    setError(null);
    const check = await canTranscribe();
    if (!check.ok) {
      setError(check.reason ?? 'Seu navegador não suporta transcrição automática.');
      setManual(true);
      return;
    }
    abort.current = new AbortController();
    try {
      const blob = await fetch(video.url).then((r) => r.blob());
      const result = await transcribeFile(blob, { language, model, onProgress: setProgress, signal: abort.current.signal });
      setWords(autoEmphasis(markFillers(result)));
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message || 'Falha na transcrição.');
    } finally {
      setProgress(null);
    }
  };

  const applyManual = () => {
    if (!video || !text.trim()) return;
    setWords(autoEmphasis(wordsFromText(text, video.durationInSeconds)));
    setManual(false);
  };

  const onWord = (id: string) => {
    const w = words.find((x) => x.id === id);
    if (!w) return;
    if (tool === 'cut') updateWord(id, { removed: !w.removed });
    if (tool === 'emphasis') updateWord(id, { emphasis: !w.emphasis });
    if (tool === 'sfx') {
      const order: Array<SfxId | null> = [null, 'pop', 'swish', 'shimmer', 'paper', 'click', 'whoosh'];
      const next = order[(order.indexOf(w.sfx) + 1) % order.length];
      updateWord(id, { sfx: next });
    }
  };

  const removedCount = words.filter((w) => w.removed).length;

  return (
    <div className="space-y-4">
      <Section title="Transcrição" hint="A IA escuta o vídeo e escreve cada palavra com o tempo exato. Roda no seu computador.">
        {words.length === 0 && !progress ? (
          <>
            <Segmented
              value={language}
              onChange={setLanguage}
              options={[
                { value: 'pt', label: 'Português' },
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Español' },
              ]}
            />
            <Segmented
              value={model}
              onChange={setModel}
              options={[
                { value: 'base', label: 'Rápida · 200 MB' },
                { value: 'small', label: 'Mais precisa · 590 MB' },
              ]}
            />
            <p className="text-[11px] text-muted">O modelo de IA é baixado só na primeira vez. Use o Google Chrome.</p>
            <Button variant="primary" className="w-full" onClick={run} disabled={!video}>
              ✦ Transcrever automaticamente
            </Button>
            <button className="w-full text-center text-xs text-muted underline-offset-4 hover:text-fg hover:underline" onClick={() => setManual((m) => !m)}>
              ou colar o texto manualmente
            </button>
          </>
        ) : null}
        {progress ? (
          <div className="space-y-2">
            <Progress value={progress.progress} label={progress.message} />
            <Button size="sm" variant="ghost" onClick={() => abort.current?.abort()}>
              Cancelar
            </Button>
          </div>
        ) : null}
        {error ? <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p> : null}
        {manual ? (
          <div className="space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cole aqui o que você fala no vídeo…"
              className="h-28 w-full rounded-xl bg-subtle p-3 text-sm ring-1 ring-line-strong outline-none focus:ring-brand"
            />
            <Button size="sm" onClick={applyManual} disabled={!text.trim()}>
              Usar este texto
            </Button>
          </div>
        ) : null}
      </Section>

      {words.length > 0 ? (
        <>
          <Section title="Cortes automáticos">
            <Toggle
              label="Remover silêncios"
              hint="Corta pausas entre as frases."
              checked={project.cut.removeSilences}
              onChange={(v) => setCut({ removeSilences: v })}
            />
            {project.cut.removeSilences ? (
              <Slider label="Pausa mínima para cortar" value={project.cut.minSilence} min={0.15} max={1.5} step={0.05} onChange={(v) => setCut({ minSilence: v })} format={(v) => `${v.toFixed(2)} s`} />
            ) : null}
            <div className="flex items-center justify-between rounded-2xl bg-subtle px-4 py-3 text-xs ring-1 ring-line">
              <span className="text-muted">Duração</span>
              <span className="tabular-nums">
                {fmtTime(video?.durationInSeconds ?? 0)} → <b className="text-brand">{fmtTime(timeline.durationInSeconds)}</b>
              </span>
            </div>
          </Section>

          <Section
            title="Edite pelas palavras"
            hint={
              tool === 'cut'
                ? 'Clique numa palavra para cortá-la do vídeo. Vícios como "né" e "tipo" já vêm cortados.'
                : tool === 'emphasis'
                  ? 'Clique para destacar a palavra na legenda.'
                  : 'Clique para trocar o som que toca na palavra.'
            }
            right={<span className="text-xs text-muted">{removedCount} cortadas</span>}
          >
            <Segmented<Tool>
              value={tool}
              onChange={setTool}
              options={[
                { value: 'cut', label: '✂ Cortar' },
                { value: 'emphasis', label: '✦ Destacar' },
                { value: 'sfx', label: '♪ Som' },
              ]}
            />
            <div className="max-h-[42vh] overflow-y-auto rounded-2xl bg-subtle p-3 leading-8 ring-1 ring-line">
              {words.map((w) => (
                <button
                  key={w.id}
                  onClick={() => onWord(w.id)}
                  title={`${w.start.toFixed(2)}s`}
                  className={`mr-1 rounded-md px-1 text-sm transition ${
                    w.removed
                      ? 'text-muted/50 line-through decoration-red-300/70'
                      : w.emphasis
                        ? 'bg-brand-soft font-serif italic text-brand'
                        : 'text-fg hover:bg-subtle'
                  }`}
                >
                  {w.text}
                  {w.sfx ? <sup className="ml-0.5 text-[9px] text-brand">♪{w.sfx}</sup> : null}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setWords(words.map((w) => ({ ...w, removed: false })))}>
                Restaurar cortes
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setWords([])}>
                Refazer transcrição
              </Button>
            </div>
          </Section>
        </>
      ) : null}

      <div className="pt-1">
        <Button variant="primary" className="w-full" onClick={() => setStep('look')}>
          Próximo: estilo ›
        </Button>
      </div>
    </div>
  );
};
