import React, { useState } from 'react';
import { useStudio } from '../../core/store';
import { LOOKS, PALETTES } from '../../core/presets';
import { FONTS } from '../../core/fonts';
import type { CaptionAnimation, CaptionMode, MotionMode, Style } from '../../core/types';
import { Button, ColorInput, Section, Segmented, Select, Slider, TextInput, Toggle } from '../kit';

const LOOK_SWATCH: Record<string, string> = {
  soft: 'linear-gradient(135deg,#f3ebdd,#d9c7ad)',
  scrapbook: 'linear-gradient(135deg,#b8a48c,#2a1e16)',
  signature: 'linear-gradient(135deg,#2a2420,#c9b79a)',
  headline: 'linear-gradient(135deg,#1c1519,#f2a9c0)',
};
const LOOK_FONT: Record<string, string> = { soft: 'CormorantGaramond', scrapbook: 'Caveat', signature: 'PlayfairDisplay', headline: 'Rubik' };

const fontOptions = Object.entries(FONTS).map(([value, f]) => ({ value, label: `${f.label} · ${f.kind}` }));

export const LookPanel: React.FC = () => {
  const { project, applyLook, setStyle, setTitle, setStep, presets, savePreset, loadPreset } = useStudio();
  const s = project.style;
  const [presetName, setPresetName] = useState('');
  const setColors = (patch: Partial<Style['colors']>) => setStyle({ colors: { ...s.colors, ...patch } });
  const setGrade = (patch: Partial<Style['grade']>) => setStyle({ grade: { ...s.grade, ...patch } });

  return (
    <div>
      <Section title="Look" hint="Cada look é uma edição completa: títulos, legendas, ritmo e movimento.">
        <div className="grid grid-cols-2 gap-2">
          {LOOKS.map((l) => (
            <button
              key={l.id}
              onClick={() => applyLook(l.id)}
              className={`group overflow-hidden rounded-2xl text-left ring-1 transition ${project.look === l.id ? 'ring-2 ring-rose' : 'ring-line-strong hover:ring-rose/50'}`}
            >
              <div className="flex h-20 items-end p-3" style={{ background: LOOK_SWATCH[l.id] }}>
                <span className="text-2xl leading-none text-white drop-shadow" style={{ fontFamily: `'${FONTS[LOOK_FONT[l.id]].family}', serif` }}>
                  {l.name}
                </span>
              </div>
              <div className="bg-ink px-3 py-2 text-[11px] leading-snug text-muted">{l.tagline}</div>
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted">{LOOKS.find((l) => l.id === project.look)?.description}</p>
      </Section>

      <Section title="Título de abertura" right={<Toggle label="" checked={project.title.enabled} onChange={(v) => setTitle({ enabled: v })} />}>
        {project.title.enabled ? (
          <>
            <TextInput label="Título" value={project.title.text} onChange={(v) => setTitle({ text: v })} />
            <TextInput label="Linha pequena (acima)" value={project.title.kicker} onChange={(v) => setTitle({ kicker: v })} />
            <Slider label="Duração" value={project.title.durationInSeconds} min={1} max={6} step={0.5} onChange={(v) => setTitle({ durationInSeconds: v })} format={(v) => `${v.toFixed(1)} s`} />
          </>
        ) : null}
      </Section>

      <Section title="Cores">
        <div className="flex flex-wrap gap-2">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              onClick={() => setStyle({ palette: p.id, colors: p.colors })}
              className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs ring-1 transition ${s.palette === p.id ? 'bg-panel-2 ring-rose' : 'ring-line-strong hover:ring-rose/50'}`}
            >
              <span className="flex">
                <span className="h-5 w-5 rounded-full ring-2 ring-panel" style={{ background: p.colors.accent }} />
                <span className="-ml-2 h-5 w-5 rounded-full ring-2 ring-panel" style={{ background: p.colors.background }} />
              </span>
              {p.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ColorInput label="Texto" value={s.colors.text} onChange={(v) => setColors({ text: v })} />
          <ColorInput label="Destaque" value={s.colors.accent} onChange={(v) => setColors({ accent: v })} />
          <ColorInput label="Fundo" value={s.colors.background} onChange={(v) => setColors({ background: v })} />
          <ColorInput label="Detalhes" value={s.colors.secondary} onChange={(v) => setColors({ secondary: v })} />
        </div>
      </Section>

      <Section title="Fontes">
        <Select label="Títulos" value={s.titleFont} options={fontOptions} onChange={(v) => setStyle({ titleFont: v })} />
        <Select label="Legendas" value={s.captionFont} options={fontOptions} onChange={(v) => setStyle({ captionFont: v })} />
        <Select label="Palavras em destaque" value={s.accentFont} options={fontOptions} onChange={(v) => setStyle({ accentFont: v })} />
      </Section>

      <Section title="Legendas">
        <Segmented<CaptionMode>
          value={s.captionMode}
          onChange={(v) => setStyle({ captionMode: v })}
          options={[
            { value: 'word', label: 'Palavra' },
            { value: 'phrase', label: 'Frase' },
            { value: 'karaoke', label: 'Karaokê' },
            { value: 'off', label: 'Sem' },
          ]}
        />
        <Segmented<CaptionAnimation>
          value={s.captionAnimation}
          onChange={(v) => setStyle({ captionAnimation: v })}
          options={[
            { value: 'pop', label: 'Pop' },
            { value: 'fade', label: 'Suave' },
            { value: 'slide', label: 'Subir' },
            { value: 'typewriter', label: 'Digitar' },
          ]}
        />
        <Slider label="Tamanho" value={s.captionSize} min={28} max={110} step={1} onChange={(v) => setStyle({ captionSize: v })} format={(v) => `${v}px`} />
        <Slider label="Posição vertical" value={s.captionY} min={0.1} max={0.8} step={0.01} onChange={(v) => setStyle({ captionY: v })} format={(v) => `${Math.round(v * 100)}%`} />
        {s.captionMode !== 'word' ? (
          <Slider label="Palavras por vez" value={s.wordsPerPage} min={2} max={8} step={1} onChange={(v) => setStyle({ wordsPerPage: v })} format={(v) => `${v}`} />
        ) : null}
        <Toggle label="LETRAS MAIÚSCULAS" checked={s.uppercase} onChange={(v) => setStyle({ uppercase: v })} />
      </Section>

      <Section title="Movimento e imagem">
        <Segmented<MotionMode>
          value={s.motion}
          onChange={(v) => setStyle({ motion: v })}
          options={[
            { value: 'none', label: 'Parado' },
            { value: 'soft', label: 'Zoom suave' },
            { value: 'punch', label: 'Zoom de impacto' },
          ]}
        />
        <Slider label="Brilho" value={s.grade.brightness} min={0.7} max={1.3} onChange={(v) => setGrade({ brightness: v })} />
        <Slider label="Contraste" value={s.grade.contrast} min={0.7} max={1.4} onChange={(v) => setGrade({ contrast: v })} />
        <Slider label="Saturação" value={s.grade.saturate} min={0} max={1.6} onChange={(v) => setGrade({ saturate: v })} />
        <Slider label="Calor" value={s.grade.warmth} min={-1} max={1} onChange={(v) => setGrade({ warmth: v })} />
        <Slider label="Vinheta" value={s.vignette} min={0} max={0.8} onChange={(v) => setStyle({ vignette: v })} />
        <Slider label="Granulação de filme" value={s.grain} min={0} max={0.4} onChange={(v) => setStyle({ grain: v })} />
      </Section>

      <Section title="Meus estilos" hint="Salve este visual para usar em todos os próximos vídeos.">
        <div className="flex gap-2">
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Nome do estilo"
            className="h-10 min-w-0 flex-1 rounded-xl bg-ink px-3 text-sm ring-1 ring-line-strong outline-none focus:ring-rose"
          />
          <Button
            disabled={!presetName.trim()}
            onClick={() => {
              savePreset(presetName.trim());
              setPresetName('');
            }}
          >
            Salvar
          </Button>
        </div>
        {presets.length ? (
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button key={p.name} size="sm" onClick={() => loadPreset(p.name)}>
                {p.name}
              </Button>
            ))}
          </div>
        ) : null}
      </Section>

      <div className="p-5">
        <Button variant="primary" className="w-full" onClick={() => setStep('effects')}>
          Próximo: efeitos ›
        </Button>
      </div>
    </div>
  );
};
