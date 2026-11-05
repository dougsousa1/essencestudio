import React from 'react';
import { useStudio, type StepId } from './core/store';
import { Preview } from './ui/Preview';
import { UploadPanel } from './ui/panels/UploadPanel';
import { CutPanel } from './ui/panels/CutPanel';
import { LookPanel } from './ui/panels/LookPanel';
import { SoundPanel } from './ui/panels/SoundPanel';
import { ExportPanel } from './ui/panels/ExportPanel';

const STEPS: Array<{ id: StepId; label: string; icon: string; desc: string }> = [
  { id: 'upload', label: 'Vídeo', icon: '↑', desc: 'Envie seu vídeo' },
  { id: 'cut', label: 'Cortar', icon: '✂', desc: 'Pausas e erros saem' },
  { id: 'look', label: 'Estilo', icon: '✦', desc: 'Looks, cores e fontes' },
  { id: 'sound', label: 'Som', icon: '♪', desc: 'Sons nas palavras' },
  { id: 'export', label: 'Exportar', icon: '⬇', desc: 'MP4, capa e legenda' },
];

const PANELS: Record<StepId, React.FC> = {
  upload: UploadPanel,
  cut: CutPanel,
  look: LookPanel,
  sound: SoundPanel,
  export: ExportPanel,
};

export default function App() {
  const { step, setStep, project } = useStudio();
  const Panel = PANELS[step];
  const idx = STEPS.findIndex((s) => s.id === step);
  const current = STEPS[idx];

  return (
    <div className="flex h-full flex-col overflow-y-auto md:overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl italic text-rose">Essence</span>
          <span className="text-sm font-semibold tracking-tight">Studio</span>
        </div>
        <div className="hidden truncate text-xs text-muted sm:block">{project.video ? project.video.name : 'Nenhum vídeo'}</div>
        <div className="text-xs text-muted">
          Passo {idx + 1} de {STEPS.length}
        </div>
      </header>

      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-line p-2 md:w-52 md:flex-col md:border-b-0 md:border-r md:p-3">
          {STEPS.map((s, i) => {
            const active = s.id === step;
            const disabled = !project.video && s.id !== 'upload';
            return (
              <button
                key={s.id}
                disabled={disabled}
                onClick={() => setStep(s.id)}
                className={`flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition disabled:opacity-35 ${active ? 'bg-panel-2 ring-1 ring-line-strong' : 'hover:bg-panel'}`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${active ? 'bg-rose text-ink' : 'bg-panel-2 text-muted'}`}>{s.icon}</span>
                <span>
                  <span className="block text-sm font-semibold">
                    <span className="mr-1 text-muted">{i + 1}.</span>
                    {s.label}
                  </span>
                  <span className="hidden text-[11px] text-muted md:block">{s.desc}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <main className="relative min-h-[50vh] min-w-0 flex-1 bg-[linear-gradient(180deg,#141113,#0f0d0e)] p-4 md:p-8">
          <Preview />
        </main>

        <aside className="flex w-full md:min-h-0 shrink-0 flex-col border-t border-line bg-panel md:w-[380px] md:border-l md:border-t-0">
          <div className="border-b border-line px-5 py-4">
            <div className="text-xs uppercase tracking-[0.12em] text-rose">Passo {idx + 1}</div>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">{current.desc}</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Panel />
          </div>
        </aside>
      </div>
    </div>
  );
}
