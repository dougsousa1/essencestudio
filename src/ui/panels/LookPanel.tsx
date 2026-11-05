import React, { useEffect, useState } from 'react';
import { useStudio } from '../../core/store';
import { LOOKS, PALETTES } from '../../core/presets';
import { FONTS, ensureFont, fontFamily } from '../../core/fonts';
import type { CaptionAnimation, CaptionMode, MotionMode, Style } from '../../core/types';
import { Badge, Button, ColorInput, Section, Segmented, Slider, TextInput, Toggle } from '../kit';

const LOOK_FONT: Record<string, string> = { soft: 'CormorantGaramond', scrapbook: 'Caveat', signature: 'PlayfairDisplay', headline: 'Rubik' };
const COMING_SOON = [
  { name: 'Trend', text: 'Rápido e vibrante, para trends e storytime' },
  { name: 'Expert', text: 'Limpo e claro, para coaches e dicas' },
  { name: 'Cinema', text: 'Visual de filme, para viagens e climas' },
];

/** A row of buttons, each showing the font name in its own font. */
const FontPicker: React.FC<{ label: string; value: string; keys: string[]; onChange: (k: string) => void }> = ({ label, value, keys, onChange }) => (
  <div>
    <div className="mb-1.5 text-xs font-medium text-fg-2">{label}</div>
    <div className="grid grid-cols-3 gap-1.5">
      {keys.map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`truncate rounded-xl border px-2 py-2.5 text-[15px] transition ${value === k ? 'border-fg bg-fg text-white' : 'border-line bg-subtle text-fg-2 hover:border-line-strong'}`}
          style={{ fontFamily: fontFamily(k) }}
        >
          {FONTS[k].label}
        </button>
      ))}
    </div>
  </div>
);

const TITLE_FONTS = ['Rubik', 'Montserrat', 'PlayfairDisplay', 'CormorantGaramond', 'Unbounded', 'Anton', 'BebasNeue', 'Syne', 'Caveat'];
const CAPTION_FONTS = ['Inter', 'InterTight', 'Poppins', 'Montserrat', 'SpaceGrotesk', 'CormorantGaramond', 'Rubik', 'Fraunces', 'Caveat'];
const ACCENT_FONTS = ['Fraunces', 'InstrumentSerif', 'PlayfairDisplay', 'DMSerifDisplay', 'Italiana', 'PinyonScript', 'Caveat', 'CormorantGaramond', 'Syne'];

const SIZE_PRESETS = { small: 42, medium: 56, big: 72 } as const;
const POS_PRESETS = { top: 0.22, middle: 0.5, bottom: 0.72 } as const;

export const LookPanel: React.FC = () => {
  const { project, applyLook, setStyle, setTitle, setStep, presets, savePreset, loadPreset } = useStudio();
  const s = project.style;
  const [presetName, setPresetName] = useState('');
  const setColors = (patch: Partial<Style['colors']>) => setStyle({ colors: { ...s.colors, ...patch } });
  const setGrade = (patch: Partial<Style['grade']>) => setStyle({ grade: { ...s.grade, ...patch } });

  // Load every font once so the buttons show the real letterforms.
  useEffect(() => {
    Object.keys(FONTS).forEach((k) => void ensureFont(k));
  }, []);

  const sizeKey = Object.entries(SIZE_PRESETS).find(([, v]) => v === s.captionSize)?.[0] ?? '';
  const posKey = Object.entries(POS_PRESETS).find(([, v]) => Math.abs(v - s.captionY) < 0.005)?.[0] ?? '';

  return (
    <div className="space-y-4">
      <Section title="Escolha um estilo" hint="Estilos prontos: escolha um e ajuste cores, fontes e posições abaixo. Tudo aparece na prévia na hora.">
        <div className="grid grid-cols-2 gap-2">
          {LOOKS.map((l) => (
            <button
              key={l.id}
              onClick={() => applyLook(l.id)}
              className={`rounded-xl border p-3 text-left transition ${project.look === l.id ? 'border-brand bg-brand-soft ring-4 ring-brand-ring/40' : 'border-line bg-subtle hover:border-line-strong'}`}
            >
              <Badge tone={project.look === l.id ? 'brand' : 'gray'}>{project.look === l.id ? 'Em uso' : 'Pronto'}</Badge>
              <div
                className="mt-2 text-[22px] leading-none text-fg"
                style={{ fontFamily: fontFamily(LOOK_FONT[l.id]), fontWeight: l.id === 'headline' ? 800 : 500, fontStyle: l.id === 'signature' ? 'italic' : 'normal' }}
              >
                {l.id === 'headline' ? l.name.toUpperCase() : l.name}
              </div>
              <div className="mt-1.5 text-[12px] leading-snug text-muted">{l.tagline}</div>
            </button>
          ))}
          <button
            onClick={() => document.getElementById('meus-estilos')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="rounded-xl border border-line bg-bg p-3 text-left transition hover:border-brand"
          >
            <Badge tone="brand">Seu</Badge>
            <div className="mt-2 text-[17px] font-semibold leading-none text-fg">+ Criar meu estilo</div>
            <div className="mt-1.5 text-[12px] leading-snug text-muted">Ajuste tudo abaixo e salve com o seu nome</div>
          </button>
          {COMING_SOON.map((c) => (
            <div key={c.name} className="rounded-xl border border-dashed border-line p-3 opacity-60">
              <Badge>Em breve</Badge>
              <div className="mt-2 text-[18px] font-semibold leading-none text-muted">{c.name}</div>
              <div className="mt-1.5 text-[12px] leading-snug text-muted">{c.text}</div>
            </div>
          ))}
        </div>
        <p className="text-[13px] leading-relaxed text-muted">{LOOKS.find((l) => l.id === project.look)?.description}</p>
      </Section>

      <Section title="Título de abertura" right={<Toggle label="" checked={project.title.enabled} onChange={(v) => setTitle({ enabled: v })} />}>
        {project.title.enabled ? (
          <>
            <TextInput label="Título" value={project.title.text} onChange={(v) => setTitle({ text: v })} />
            <TextInput label="Linha pequena (acima do título)" value={project.title.kicker} onChange={(v) => setTitle({ kicker: v })} />
            <Slider label="Duração" value={project.title.durationInSeconds} min={1} max={6} step={0.5} onChange={(v) => setTitle({ durationInSeconds: v })} format={(v) => `${v.toFixed(1)} s`} />
          </>
        ) : (
          <p className="text-[13px] text-muted">Sem título de abertura.</p>
        )}
      </Section>

      <Section title="Cores">
        <div className="flex flex-wrap gap-2">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              onClick={() => setStyle({ palette: p.id, colors: p.colors })}
              className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-medium transition ${s.palette === p.id ? 'border-brand bg-brand-soft text-brand' : 'border-line text-fg-2 hover:border-line-strong'}`}
            >
              <span className="flex">
                <span className="h-5 w-5 rounded-full ring-2 ring-white" style={{ background: p.colors.accent }} />
                <span className="-ml-2 h-5 w-5 rounded-full ring-2 ring-white" style={{ background: p.colors.background }} />
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

      <Section title="Fontes e tamanhos">
        <FontPicker label="Fonte dos títulos" value={s.titleFont} keys={TITLE_FONTS} onChange={(k) => setStyle({ titleFont: k })} />
        <FontPicker label="Fonte das legendas" value={s.captionFont} keys={CAPTION_FONTS} onChange={(k) => setStyle({ captionFont: k })} />
        <FontPicker label="Fonte das palavras em destaque" value={s.accentFont} keys={ACCENT_FONTS} onChange={(k) => setStyle({ accentFont: k })} />
        <div>
          <div className="mb-1.5 text-xs font-medium text-fg-2">Tamanho da legenda</div>
          <Segmented
            value={sizeKey}
            onChange={(v) => setStyle({ captionSize: SIZE_PRESETS[v as keyof typeof SIZE_PRESETS] })}
            options={[
              { value: 'small', label: 'Pequena' },
              { value: 'medium', label: 'Média' },
              { value: 'big', label: 'Grande' },
            ]}
          />
        </div>
        <Slider label="Ajuste fino" value={s.captionSize} min={28} max={110} step={1} onChange={(v) => setStyle({ captionSize: v })} format={(v) => `${v}px`} />
      </Section>

      <Section title="Onde ficam as legendas" hint="O texto nunca fica embaixo dos botões do Instagram.">
        <Segmented
          value={posKey}
          onChange={(v) => setStyle({ captionY: POS_PRESETS[v as keyof typeof POS_PRESETS] })}
          options={[
            { value: 'top', label: 'Em cima' },
            { value: 'middle', label: 'No meio' },
            { value: 'bottom', label: 'Embaixo' },
          ]}
        />
        <Slider label="Posição exata" value={s.captionY} min={0.1} max={0.8} step={0.01} onChange={(v) => setStyle({ captionY: v })} format={(v) => `${Math.round(v * 100)}%`} />
      </Section>

      <Section title="Como as legendas aparecem">
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
        {s.captionMode !== 'word' ? (
          <Slider label="Palavras por vez" value={s.wordsPerPage} min={2} max={8} step={1} onChange={(v) => setStyle({ wordsPerPage: v })} format={(v) => `${v}`} />
        ) : null}
        <Toggle label="Letras maiúsculas" checked={s.uppercase} onChange={(v) => setStyle({ uppercase: v })} />
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
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Slider label="Brilho" value={s.grade.brightness} min={0.7} max={1.3} onChange={(v) => setGrade({ brightness: v })} />
          <Slider label="Contraste" value={s.grade.contrast} min={0.7} max={1.4} onChange={(v) => setGrade({ contrast: v })} />
          <Slider label="Saturação" value={s.grade.saturate} min={0} max={1.6} onChange={(v) => setGrade({ saturate: v })} />
          <Slider label="Calor" value={s.grade.warmth} min={-1} max={1} onChange={(v) => setGrade({ warmth: v })} />
          <Slider label="Vinheta" value={s.vignette} min={0} max={0.8} onChange={(v) => setStyle({ vignette: v })} />
          <Slider label="Granulação" value={s.grain} min={0} max={0.4} onChange={(v) => setStyle({ grain: v })} />
        </div>
      </Section>

      <div id="meus-estilos" />
      <Section title="Meus estilos" hint="Salve este visual e use em todos os próximos vídeos.">
        <div className="flex gap-2">
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Nome do estilo"
            className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-bg px-3 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand-ring/40"
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

      <div className="pt-1">
        <Button variant="primary" size="lg" className="w-full" onClick={() => setStep('effects')}>
          Próximo: efeitos ›
        </Button>
      </div>
    </div>
  );
};
