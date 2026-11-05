import React from 'react';
import { useStudio, type StepId } from '../../core/store';
import { Preview } from '../Preview';
import { UploadPanel } from '../panels/UploadPanel';
import { CutPanel } from '../panels/CutPanel';
import { LookPanel } from '../panels/LookPanel';
import { EffectsPanel } from '../panels/EffectsPanel';
import { SoundPanel } from '../panels/SoundPanel';
import { ExportPanel } from '../panels/ExportPanel';
import { fmtTime } from '../kit';

const STEPS: Array<{ id: StepId; label: string; title: string; desc: string }> = [
  { id: 'upload', label: 'Vídeo', title: 'Seu vídeo', desc: 'Envie a gravação e escolha o formato.' },
  { id: 'cut', label: 'Cortar', title: 'Cortar pelas palavras', desc: 'Pausas, erros e vícios de fala saem. A sua melhor versão fica.' },
  { id: 'look', label: 'Estilo', title: 'Estilo da marca', desc: 'Look, cores, fontes e onde ficam as legendas.' },
  { id: 'effects', label: 'Efeitos', title: 'Efeitos de motion', desc: 'Uma palavra, um efeito. Escolha na biblioteca e clique na palavra.' },
  { id: 'sound', label: 'Som', title: 'Efeitos sonoros', desc: 'Sons no momento exato da palavra, baixinho por baixo da voz.' },
  { id: 'export', label: 'Exportar', title: 'Pronto para postar', desc: 'MP4, capa e legenda do post.' },
];

const PANELS: Record<StepId, React.FC> = {
  upload: UploadPanel,
  cut: CutPanel,
  look: LookPanel,
  effects: EffectsPanel,
  sound: SoundPanel,
  export: ExportPanel,
};

export const StudioPage: React.FC = () => {
  const { step, setStep, project } = useStudio();
  const Panel = PANELS[step];
  const idx = STEPS.findIndex((s) => s.id === step);
  const current = STEPS[idx];

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-16 md:px-8">
      {/* Stepper */}
      <div className="sticky top-16 z-10 -mx-4 bg-canvas/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex gap-1.5 overflow-x-auto">
          {STEPS.map((s, i) => {
            const active = s.id === step;
            const done = i < idx;
            const disabled = !project.video && s.id !== 'upload';
            return (
              <button
                key={s.id}
                disabled={disabled}
                onClick={() => setStep(s.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  active ? 'border-brand bg-brand text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)]' : 'border-line bg-bg text-fg-2 hover:border-line-strong'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                    active ? 'bg-white text-brand' : done ? 'bg-brand-soft text-brand' : 'bg-subtle text-muted'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </span>
                <span className="text-[13px] font-semibold">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
        {/* Preview */}
        <div className="lg:sticky lg:top-[132px] lg:self-start">
          <div className="rounded-3xl border border-line bg-bg p-4 md:p-6">
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-[0.12em] text-muted">Prévia ao vivo</span>
              <span className="truncate pl-3 text-muted">
                {project.video ? `${project.video.name} · ${fmtTime(project.video.durationInSeconds)} · ${project.format}` : 'Nenhum vídeo'}
              </span>
            </div>
            <div className="h-[62vh] min-h-[420px] lg:h-[calc(100vh-240px)]">
              <Preview />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div>
          <div className="mb-4">
            <div className="text-xs font-semibold text-brand">
              Passo {idx + 1} de {STEPS.length}
            </div>
            <h1 className="mt-1 font-display text-[28px] font-bold leading-tight tracking-tight text-fg">{current.title}</h1>
            <p className="mt-1 text-[14px] text-muted">{current.desc}</p>
          </div>
          <Panel />
        </div>
      </div>
    </div>
  );
};
