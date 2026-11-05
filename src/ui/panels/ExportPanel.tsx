import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from '../../core/store';
import { buildTimeline } from '../../core/timeline';
import { captionText, canExport, downloadBlob, exportCover, exportVideo, type ExportProgress } from '../../features/export';
import { Button, Progress, Section, Segmented, fmtTime } from '../kit';

const baseName = (n?: string) => (n ?? 'video').replace(/\.[^.]+$/, '');

export const ExportPanel: React.FC = () => {
  const project = useStudio((s) => s.project);
  const [quality, setQuality] = useState<'medium' | 'high'>('high');
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [support, setSupport] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const timeline = useMemo(() => buildTimeline(project), [project]);
  const caption = useMemo(() => captionText(project), [project]);
  const name = baseName(project.video?.name);

  useEffect(() => {
    canExport(project).then(setSupport).catch(() => setSupport({ ok: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.format]);

  const run = async () => {
    setError(null);
    setResult(null);
    abort.current = new AbortController();
    try {
      const blob = await exportVideo(project, { onProgress: setProgress, signal: abort.current.signal, quality });
      const url = URL.createObjectURL(blob);
      setResult({ url, size: blob.size });
      downloadBlob(blob, `${name}-essence.mp4`);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message || 'Falha ao exportar.');
    } finally {
      setProgress(null);
    }
  };

  const cover = async () => {
    try {
      const blob = await exportCover(project);
      downloadBlob(blob, `${name}-capa.${blob.type.includes('png') ? 'png' : 'jpg'}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <Section title="Exportar vídeo" hint={`MP4 ${project.format} · ${fmtTime(timeline.durationInSeconds)} · gerado no seu navegador`}>
        <Segmented
          value={quality}
          onChange={setQuality}
          options={[
            { value: 'medium', label: 'Rápido' },
            { value: 'high', label: 'Alta qualidade' },
          ]}
        />
        {support && !support.ok ? <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{support.reason ?? 'Use o Google Chrome para exportar.'}</p> : null}
        {progress ? (
          <div className="space-y-2">
            <Progress value={progress.progress} label={progress.message} />
            <Button size="sm" variant="ghost" onClick={() => abort.current?.abort()}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button variant="primary" className="w-full" onClick={run} disabled={!project.video}>
            ⬇ Exportar MP4
          </Button>
        )}
        {error ? <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p> : null}
        {result ? (
          <div className="space-y-2 rounded-2xl bg-subtle p-3 ring-1 ring-line">
            <video src={result.url} controls className="max-h-64 w-full rounded-xl bg-black" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">{(result.size / 1024 / 1024).toFixed(1)} MB · pronto para postar</span>
              <a href={result.url} download={`${name}-essence.mp4`} className="font-semibold text-brand">
                Baixar de novo
              </a>
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="Capa" hint="Um quadro do vídeo com o seu estilo, para a capa do Reels.">
        <Button className="w-full" onClick={cover} disabled={!project.video}>
          Baixar capa (JPG)
        </Button>
      </Section>

      <Section title="Legenda do post" hint="Texto pronto para colar no Instagram.">
        <textarea readOnly value={caption} className="h-32 w-full rounded-xl bg-subtle p-3 text-xs leading-relaxed ring-1 ring-line-strong outline-none" />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(caption);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* clipboard blocked */
              }
            }}
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => downloadBlob(new Blob([caption], { type: 'text/plain' }), `${name}-legenda.txt`)}>
            Baixar .txt
          </Button>
        </div>
      </Section>
    </div>
  );
};
