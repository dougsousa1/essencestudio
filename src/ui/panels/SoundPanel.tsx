import React from 'react';
import { useStudio } from '../../core/store';
import { sfxUrl } from '../../remotion/Main';
import type { SfxId } from '../../core/types';
import { Button, Section, Select, Slider, Toggle } from '../kit';

const SFX: Array<{ id: SfxId; label: string }> = [
  { id: 'pop', label: 'Pop' },
  { id: 'swish', label: 'Swish' },
  { id: 'shimmer', label: 'Brilho' },
  { id: 'paper', label: 'Papel' },
  { id: 'click', label: 'Clique' },
  { id: 'whoosh', label: 'Whoosh' },
];

const play = (id: SfxId, volume: number) => {
  const a = new Audio(sfxUrl(id));
  a.volume = volume;
  void a.play();
};

const opts = [{ value: '', label: 'Nenhum' }, ...SFX.map((s) => ({ value: s.id, label: s.label }))];

export const SoundPanel: React.FC = () => {
  const { project, setSound, setStep } = useStudio();
  const snd = project.sound;
  const withSfx = project.words.filter((w) => !w.removed && (w.sfx || (w.emphasis && snd.autoOnEmphasis))).length;

  return (
    <div>
      <Section title="Efeitos sonoros" hint="Os sons entram no momento exato da palavra, baixinho, por baixo da sua voz.">
        <Toggle label="Ativar sons" checked={snd.enabled} onChange={(v) => setSound({ enabled: v })} />
        <Slider label="Volume" value={snd.volume} min={0} max={1} onChange={(v) => setSound({ volume: v })} format={(v) => `${Math.round(v * 100)}%`} />
        <Select label="Som nas palavras em destaque" value={snd.autoOnEmphasis ?? ''} options={opts} onChange={(v) => setSound({ autoOnEmphasis: (v || null) as SfxId | null })} />
        <Select label="Som no título de abertura" value={snd.titleSfx ?? ''} options={opts} onChange={(v) => setSound({ titleSfx: (v || null) as SfxId | null })} />
        <p className="text-xs text-muted">{withSfx} palavras com som. Para escolher palavra por palavra, use a ferramenta ♪ Som no passo Cortar.</p>
      </Section>
      <Section title="Ouvir os sons">
        <div className="grid grid-cols-3 gap-2">
          {SFX.map((s) => (
            <Button key={s.id} size="sm" onClick={() => play(s.id, snd.volume)}>
              ▶ {s.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted">Música de fundo: adicione no próprio Instagram ou TikTok, com áudios em alta e sem problemas de direitos autorais.</p>
      </Section>
      <div className="p-5">
        <Button variant="primary" className="w-full" onClick={() => setStep('export')}>
          Próximo: exportar ›
        </Button>
      </div>
    </div>
  );
};
