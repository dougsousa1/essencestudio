import React, { useMemo, useState } from 'react';
import { Player } from '@remotion/player';
import { useStudio } from '../../core/store';
import { buildTimeline, durationInFrames, FORMAT_SIZE, FPS } from '../../core/timeline';
import type { EffectInstance, Project, SfxId } from '../../core/types';
import { EFFECTS, getEffect, defaultProps } from '../../effects/registry';
import { CATEGORIES, type CategoryId, type EffectDef, type FieldDef } from '../../effects/types';
import { Main } from '../../remotion/Main';
import { seekPreview } from '../Preview';
import { Button, ColorInput, Section, Select, Slider, TextInput, Toggle, fmtTime } from '../kit';

const SOURCE_LABEL: Record<EffectDef['source'], string> = {
  yanny: 'Reels',
  biblioteca: 'Biblioteca',
  remocn: 'Remocn',
  elements: 'Elements',
  essence: 'Essence',
};

const CATEGORY_ICON: Record<CategoryId, string> = {
  cards: '▣',
  camera: '◎',
  text: 'Aa',
  data: '▮▮',
  stickers: '✿',
  transitions: '⇄',
};

const SFX_OPTIONS = [
  { value: '', label: 'Padrão do efeito' },
  { value: 'none', label: 'Sem som' },
  { value: 'pop', label: 'Pop' },
  { value: 'swish', label: 'Swish' },
  { value: 'shimmer', label: 'Brilho' },
  { value: 'paper', label: 'Papel' },
  { value: 'click', label: 'Clique' },
  { value: 'whoosh', label: 'Whoosh' },
];

/** Small looping preview of one effect on the user's own footage. */
const Audition: React.FC<{ def: EffectDef<any>; project: Project; at: number }> = ({ def, project, at }) => {
  const size = FORMAT_SIZE[project.format];
  const temp: Project = useMemo(
    () => ({
      ...project,
      title: { ...project.title, enabled: false },
      sound: { ...project.sound, enabled: false },
      effects: [{ id: 'audition', effectId: def.id, wordId: null, at, durationInSeconds: def.defaultDuration, props: defaultProps(def) }],
    }),
    [project, def, at],
  );
  const timeline = useMemo(() => buildTimeline(temp), [temp]);
  const total = durationInFrames(timeline);
  const inFrame = Math.min(Math.max(0, Math.round(at * FPS) - 6), Math.max(0, total - 2));
  const outFrame = Math.min(total - 1, inFrame + Math.round(def.defaultDuration * FPS) + 14);
  const w = 168;
  return (
    <div className="mx-auto overflow-hidden rounded-2xl ring-1 ring-line-strong" style={{ width: w, height: (w * size.height) / size.width }}>
      <Player
        key={def.id}
        component={Main}
        inputProps={{ project: temp }}
        durationInFrames={total}
        compositionWidth={size.width}
        compositionHeight={size.height}
        fps={FPS}
        initialFrame={inFrame}
        inFrame={inFrame}
        outFrame={Math.max(inFrame + 1, outFrame)}
        autoPlay
        loop
        initiallyMuted
        acknowledgeRemotionLicense
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

const FieldInput: React.FC<{ field: FieldDef; value: unknown; onChange: (v: unknown) => void }> = ({ field, value, onChange }) => {
  switch (field.type) {
    case 'text':
      return <TextInput label={field.label} value={String(value ?? '')} onChange={onChange} placeholder={field.placeholder} />;
    case 'textarea':
      return (
        <label className="block">
          <span className="mb-1 block text-xs text-muted">{field.label}</span>
          <textarea
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className="h-20 w-full rounded-xl bg-ink p-3 text-sm ring-1 ring-line-strong outline-none focus:ring-rose"
          />
        </label>
      );
    case 'number':
      return <Slider label={field.label} value={Number(value ?? field.default)} min={field.min} max={field.max} step={field.step ?? 1} onChange={onChange} format={(v) => `${Math.round(v * 100) / 100}`} />;
    case 'color':
      return <ColorInput label={field.label} value={String(value ?? field.default)} onChange={onChange} />;
    case 'select':
      return <Select label={field.label} value={String(value ?? field.default)} options={field.options} onChange={onChange} />;
    case 'toggle':
      return <Toggle label={field.label} checked={Boolean(value)} onChange={onChange} />;
  }
};

const PlacedItem: React.FC<{ inst: EffectInstance; open: boolean; onToggle: () => void }> = ({ inst, open, onToggle }) => {
  const { project, updateEffect, updateEffectProps, removeEffect } = useStudio();
  const def = getEffect(inst.effectId);
  const timeline = useMemo(() => buildTimeline(project), [project]);
  if (!def) return null;
  const word = inst.wordId ? timeline.words.find((w) => w.id === inst.wordId) : undefined;
  const start = word ? word.outStart : inst.at;
  const sfx = (inst.props.sfx as string | undefined) ?? '';
  return (
    <div className={`rounded-2xl ring-1 ${open ? 'bg-panel-2 ring-rose/60' : 'bg-ink ring-line'}`}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose/15 text-xs text-rose">{CATEGORY_ICON[def.category]}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{def.name}</span>
          <span className="block truncate text-[11px] text-muted">
            {word ? <>na palavra “{word.text}”</> : 'sem palavra'} · {fmtTime(start)}
          </span>
        </span>
        <span className="text-xs text-muted">{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-line px-3 py-3">
          {def.fields.map((f) => (
            <FieldInput key={f.key} field={f} value={inst.props[f.key] ?? f.default} onChange={(v) => updateEffectProps(inst.id, { [f.key]: v })} />
          ))}
          <Slider label="Duração" value={inst.durationInSeconds} min={0.5} max={8} step={0.1} onChange={(v) => updateEffect(inst.id, { durationInSeconds: v })} format={(v) => `${v.toFixed(1)} s`} />
          <Select
            label="Som"
            value={sfx}
            options={SFX_OPTIONS}
            onChange={(v) => updateEffectProps(inst.id, { sfx: v === '' ? undefined : v === 'none' ? null : (v as SfxId) })}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => seekPreview(start)}>
              ▶ Ver no vídeo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => removeEffect(inst.id)}>
              Remover
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const EffectsPanel: React.FC = () => {
  const { project, addEffect, setStep, playhead } = useStudio();
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(EFFECTS[0]?.id ?? null);
  const [openId, setOpenId] = useState<string | null>(null);
  const timeline = useMemo(() => buildTimeline(project), [project]);
  const def = selected ? getEffect(selected) : undefined;

  const list = EFFECTS.filter((e) => (cat === 'all' || e.category === cat) && (`${e.name} ${e.term} ${e.description}`.toLowerCase().includes(query.toLowerCase())));
  const wordsWithFx = new Set(project.effects.map((e) => e.wordId));

  const place = (wordId: string | null) => {
    if (!def) return;
    const id = addEffect(def.id, wordId ? { wordId } : { at: playhead });
    setOpenId(id);
    const w = wordId ? timeline.words.find((x) => x.id === wordId) : undefined;
    seekPreview(Math.max(0, (w ? w.outStart : playhead) - 0.2));
  };

  return (
    <div>
      <Section title="Biblioteca de efeitos" hint={`${EFFECTS.length} efeitos de motion. Escolha um, veja no seu vídeo e aplique numa palavra.`}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar: zoom, celular, número…"
          className="h-10 w-full rounded-xl bg-ink px-3 text-sm ring-1 ring-line-strong outline-none placeholder:text-muted/60 focus:ring-rose"
        />
        <div className="-mx-1 flex gap-1 overflow-x-auto pb-1">
          {[{ id: 'all' as const, label: 'Todos' }, ...CATEGORIES].map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${cat === c.id ? 'bg-rose text-ink ring-rose' : 'text-muted ring-line-strong hover:text-fg'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="grid max-h-[34vh] grid-cols-2 gap-2 overflow-y-auto pr-1">
          {list.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelected(e.id)}
              className={`rounded-2xl p-3 text-left ring-1 transition ${selected === e.id ? 'bg-panel-2 ring-2 ring-rose' : 'bg-ink ring-line hover:ring-rose/50'}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose/15 text-[11px] text-rose">{CATEGORY_ICON[e.category]}</span>
                <span className="text-[9px] uppercase tracking-wider text-muted">{SOURCE_LABEL[e.source]}</span>
              </div>
              <div className="text-[13px] font-semibold leading-tight">{e.name}</div>
              <div className="mt-0.5 truncate font-display text-[11px] italic text-rose/80">{e.term}</div>
            </button>
          ))}
          {list.length === 0 ? <p className="col-span-2 py-6 text-center text-xs text-muted">Nenhum efeito encontrado.</p> : null}
        </div>
      </Section>

      {def && project.video ? (
        <Section title={def.name} hint={def.description}>
          <Audition def={def} project={project} at={playhead} />
          <p className="text-center text-[11px] text-muted">Prévia no seu vídeo, a partir de {fmtTime(playhead)}</p>
          {timeline.words.length ? (
            <>
              <div className="text-xs font-semibold text-fg/90">Clique na palavra que dispara o efeito:</div>
              <div className="max-h-40 overflow-y-auto rounded-2xl bg-ink p-2 leading-7 ring-1 ring-line">
                {timeline.words.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => place(w.id)}
                    className={`mr-1 rounded-md px-1 text-[13px] transition hover:bg-rose hover:text-ink ${wordsWithFx.has(w.id) ? 'bg-rose/20 text-rose' : 'text-fg'}`}
                  >
                    {w.text}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted">Sem transcrição: o efeito entra no ponto atual da prévia. Transcreva no passo Cortar para aplicar por palavra.</p>
          )}
          <Button className="w-full" onClick={() => place(null)}>
            + Aplicar em {fmtTime(playhead)}
          </Button>
        </Section>
      ) : null}

      <Section title="No seu vídeo" hint={project.effects.length ? 'Clique para ajustar texto, cores, duração e som.' : 'Nenhum efeito ainda.'}>
        {[...project.effects]
          .sort((a, b) => {
            const ta = a.wordId ? timeline.words.find((w) => w.id === a.wordId)?.outStart ?? a.at : a.at;
            const tb = b.wordId ? timeline.words.find((w) => w.id === b.wordId)?.outStart ?? b.at : b.at;
            return ta - tb;
          })
          .map((inst) => (
            <PlacedItem key={inst.id} inst={inst} open={openId === inst.id} onToggle={() => setOpenId(openId === inst.id ? null : inst.id)} />
          ))}
      </Section>

      <div className="p-5">
        <Button variant="primary" className="w-full" onClick={() => setStep('sound')}>
          Próximo: som ›
        </Button>
      </div>
    </div>
  );
};
