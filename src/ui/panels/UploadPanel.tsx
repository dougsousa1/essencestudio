import React, { useRef, useState } from 'react';
import { useStudio } from '../../core/store';
import type { FormatId } from '../../core/types';
import { Button, Section, Segmented, fmtTime } from '../kit';

const readMeta = (url: string) =>
  new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
    v.onerror = () => reject(new Error('Não foi possível ler este vídeo.'));
    v.src = url;
  });

export const UploadPanel: React.FC = () => {
  const { project, setVideo, setFormat, setStep } = useStudio();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith('video/')) {
      setError('Escolha um arquivo de vídeo (MP4, MOV ou WebM).');
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const meta = await readMeta(url);
      if (project.video) URL.revokeObjectURL(project.video.url);
      setVideo({ url, name: file.name, durationInSeconds: meta.duration, width: meta.width, height: meta.height });
      // Pick the format that matches the footage.
      const r = meta.width / meta.height;
      setFormat(r < 0.8 ? '9:16' : r > 1.25 ? '16:9' : '1:1');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <Section title="Seu vídeo" hint="O vídeo fica só no seu navegador. Nada é enviado para servidores.">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) onFile(f);
          }}
          onClick={() => input.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-10 text-center transition ${
            drag ? 'border-rose bg-rose/10' : 'border-line-strong bg-ink hover:border-rose/60'
          }`}
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose/15 text-xl text-rose">↑</div>
          <div className="text-sm font-semibold">Arraste seu vídeo aqui</div>
          <div className="mt-1 text-xs text-muted">ou clique para escolher · MP4, MOV, WebM</div>
          <input
            ref={input}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
        </div>
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
        {project.video ? (
          <div className="rounded-2xl bg-ink p-3 text-xs ring-1 ring-line">
            <div className="truncate font-medium text-fg">{project.video.name}</div>
            <div className="mt-1 text-muted">
              {fmtTime(project.video.durationInSeconds)} · {project.video.width}×{project.video.height}
            </div>
          </div>
        ) : null}
      </Section>
      <Section title="Formato" hint="9:16 para Reels, TikTok e Shorts.">
        <Segmented<FormatId>
          value={project.format}
          onChange={setFormat}
          options={[
            { value: '9:16', label: '9:16 Reels' },
            { value: '1:1', label: '1:1 Feed' },
            { value: '16:9', label: '16:9 YouTube' },
          ]}
        />
      </Section>
      <div className="p-5">
        <Button variant="primary" className="w-full" disabled={!project.video} onClick={() => setStep('cut')}>
          Próximo: cortar ›
        </Button>
      </div>
    </div>
  );
};
