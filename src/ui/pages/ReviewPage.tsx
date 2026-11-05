import React, { useMemo, useState } from 'react';
import { useStudio } from '../../core/store';
import { buildTimeline } from '../../core/timeline';
import { getEffect } from '../../effects/registry';
import { Preview } from '../Preview';
import { LookPanel } from '../panels/LookPanel';
import { CutPanel } from '../panels/CutPanel';
import { EffectsPanel } from '../panels/EffectsPanel';
import { hashParam } from '../router';
import { useProjectSync } from '../review/useProjectSync';
import { inArtifact, useArtifactSync } from '../review/useArtifactSync';

// Chosen once per page load: local plugin server, or private Claude artifact.
const ARTIFACT = inArtifact();
const useSync = ARTIFACT ? (_dir: string | null) => useArtifactSync() : useProjectSync;
import { Button, Card, Eyebrow, Section, TextArea, fmtTime } from '../kit';

type Stage = 'presets' | 'storyboard' | 'rascunho';

const STAGES: Array<{ id: Stage; label: string; sub: string }> = [
  { id: 'presets', label: 'Presets', sub: 'sua vez' },
  { id: 'storyboard', label: 'Storyboard', sub: 'o plano' },
  { id: 'rascunho', label: 'Rascunho', sub: 'para assistir' },
];

/** What the plan looks like, in plain words (cuts, title, effects). */
const PlanSummary: React.FC = () => {
  const project = useStudio((s) => s.project);
  const t = useMemo(() => buildTimeline(project), [project]);
  const cut = project.words.filter((w) => w.removed).length;
  return (
    <Section title="O plano do Claude" hint="Confira antes de gerar. Mude o que quiser aqui ou nas abas abaixo.">
      <ul className="space-y-2 text-sm text-fg-2">
        <li>
          ✂ <b>{cut}</b> palavras cortadas · duração {fmtTime(project.video?.durationInSeconds ?? 0)} → <b className="text-brand">{fmtTime(t.durationInSeconds)}</b>
        </li>
        <li>✦ Título: {project.title.enabled ? <b>“{project.title.text}”</b> : 'sem título'}</li>
        {project.effects.map((e) => {
          const w = t.words.find((x) => x.id === e.wordId);
          return (
            <li key={e.id}>
              ✺ <b>{getEffect(e.effectId)?.name ?? e.effectId}</b> {w ? <>na palavra “{w.text}”</> : `em ${fmtTime(e.at)}`}
            </li>
          );
        })}
        {project.effects.length === 0 ? <li className="text-muted">Nenhum efeito ainda.</li> : null}
      </ul>
    </Section>
  );
};

export const ReviewPage: React.FC = () => {
  const dir = hashParam('projeto');
  const sync = useSync(dir);
  const project = useStudio((s) => s.project);
  const [stage, setStage] = useState<Stage>('presets');
  const [tab, setTab] = useState<'cortes' | 'efeitos'>('cortes');
  const [mudancas, setMudancas] = useState('');

  if (!dir && !ARTIFACT) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Janela de revisão</h1>
        <p className="mt-2 text-muted">Ela abre pelo Claude, com o projeto do seu vídeo. No Claude Code, arraste um vídeo e escreva “editar”.</p>
      </div>
    );
  }
  if (sync.error) return <p className="px-4 py-20 text-center text-red-600">{sync.error}</p>;
  if (!sync.ready) return <p className="px-4 py-20 text-center text-muted">Abrindo o projeto…</p>;

  const busy = sync.pedidoPendente || /Gerando|recebeu/.test(sync.status);
  const send = (acao: string, extra: Record<string, unknown> = {}) => void sync.send({ acao, ...extra });

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-16 md:px-8">
      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-2 bg-canvas/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        {STAGES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setStage(s.id)}
            className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 transition ${stage === s.id ? 'border-brand bg-brand text-white' : 'border-line bg-bg text-fg-2 hover:border-line-strong'}`}
          >
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${stage === s.id ? 'bg-white text-brand' : 'bg-subtle text-muted'}`}>{i + 1}</span>
            <span className="text-left leading-tight">
              <span className="block text-[13px] font-semibold">{s.label}</span>
              <span className={`block text-[10px] ${stage === s.id ? 'text-white/80' : 'text-muted'}`}>{s.sub}</span>
            </span>
          </button>
        ))}
        {sync.status ? (
          <span className={`ml-auto rounded-full px-3 py-1.5 text-xs font-semibold ${busy ? 'bg-brand-soft text-brand' : 'bg-subtle text-fg-2'}`}>
            {busy ? '● ' : '✓ '}
            {sync.status}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
        <div className="lg:sticky lg:top-[140px] lg:self-start">
          <div className="rounded-3xl border border-line bg-bg p-4 md:p-6">
            <div className="mb-3 flex items-center justify-between text-xs">
              <Eyebrow>{stage === 'rascunho' ? 'Seu rascunho' : 'Prévia ao vivo'}</Eyebrow>
              <span className="truncate pl-3 text-muted">{project.video?.name}</span>
            </div>
            <div className="h-[62vh] min-h-[420px] lg:h-[calc(100vh-250px)]">
              {stage === 'rascunho' ? (
                sync.rascunho ? (
                  <div className="flex h-full items-center justify-center">
                    <video key={sync.rascunho} src={sync.outputUrl('rascunho.mp4', sync.rascunho)} controls className="max-h-full rounded-[26px] bg-black shadow-[0_30px_60px_rgba(16,24,40,0.22)]" />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-sm text-muted">O rascunho aparece aqui quando o Claude terminar de gerar.</div>
                )
              ) : (
                <Preview />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-brand">Etapa {STAGES.findIndex((s) => s.id === stage) + 1} de 3</div>
            <h1 className="mt-1 font-display text-[28px] font-bold leading-tight tracking-tight">
              {stage === 'presets' ? 'Escolha o seu estilo' : stage === 'storyboard' ? 'Confira o plano' : 'Seu Reel está quase pronto'}
            </h1>
            <p className="mt-1 text-[14px] text-muted">
              {stage === 'presets'
                ? 'Escolha um look e ajuste cores, fontes e posições. Depois, envie para o Claude montar o plano.'
                : stage === 'storyboard'
                  ? 'Toque nas palavras para cortar, ajuste os efeitos e, quando estiver bom, peça o rascunho.'
                  : 'Assista. Quer mudanças? Escreva todas aqui, uma por linha.'}
            </p>
          </div>

          {stage === 'presets' ? (
            <>
              <Card className="flex items-center justify-between gap-3 p-4">
                <div className="text-sm">
                  <div className="font-semibold">Pronto com o estilo?</div>
                  <div className="text-muted">O Claude monta cortes, título e efeitos.</div>
                </div>
                <Button variant="primary" disabled={busy} onClick={() => (send('montar-storyboard'), setStage('storyboard'))}>
                  Enviar para o Claude
                </Button>
              </Card>
              <LookPanel />
            </>
          ) : null}

          {stage === 'storyboard' ? (
            <>
              <PlanSummary />
              <Card className="flex items-center justify-between gap-3 p-4">
                <div className="text-sm">
                  <div className="font-semibold">Tudo certo?</div>
                  <div className="text-muted">O rascunho leva alguns minutos.</div>
                </div>
                <Button variant="primary" disabled={busy} onClick={() => (send('gerar-rascunho'), setStage('rascunho'))}>
                  Gerar rascunho
                </Button>
              </Card>
              <div className="flex gap-1 rounded-xl bg-subtle p-1">
                {(['cortes', 'efeitos'] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-2 text-xs font-semibold ${tab === t ? 'bg-bg text-brand shadow ring-1 ring-line' : 'text-muted'}`}>
                    {t === 'cortes' ? 'Cortes e legendas' : 'Efeitos'}
                  </button>
                ))}
              </div>
              {tab === 'cortes' ? <CutPanel /> : <EffectsPanel />}
            </>
          ) : null}

          {stage === 'rascunho' ? (
            <>
              <Section title="Quer mudanças?" hint="Uma por linha. Ex.: “legenda maior”, “tira o efeito do celular”, “corta a parte do minuto 0:12”.">
                <TextArea value={mudancas} onChange={setMudancas} rows={6} placeholder={'legenda um pouco maior\ncoloca o número contando na palavra cinco\n…'} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    disabled={busy || !mudancas.trim()}
                    onClick={() => {
                      send('mudancas', { mudancas: mudancas.split('\n').map((l) => l.trim()).filter(Boolean) });
                      setMudancas('');
                    }}
                  >
                    Enviar mudanças
                  </Button>
                  <Button variant="dark" disabled={busy || !sync.rascunho} onClick={() => send('versao-final')}>
                    Aprovar e gerar a versão final
                  </Button>
                </div>
              </Section>
              {sync.final ? (
                <Section title="Versão final" hint="Pronta para postar.">
                  <div className="flex flex-wrap gap-2">
                    <a className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white" href={sync.outputUrl('reel.mp4', sync.final)} download>
                      Baixar o MP4
                    </a>
                    <a className="inline-flex h-10 items-center rounded-xl border border-line-strong px-4 text-sm font-semibold" href={sync.outputUrl('capa.jpg', sync.final)} download>
                      Baixar a capa
                    </a>
                  </div>
                </Section>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
