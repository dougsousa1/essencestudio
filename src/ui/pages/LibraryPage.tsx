import React, { useEffect, useMemo, useState } from 'react';
import { Player, Thumbnail } from '@remotion/player';
import { EFFECTS } from '../../effects/registry';
import { CATEGORIES, type CategoryId, type EffectDef } from '../../effects/types';
import { EffectStage, effectPrompt, stageDuration, stageThumbFrame } from '../../effects/EffectStage';
import { FONTS, ensureFont } from '../../core/fonts';
import { useStudio } from '../../core/store';
import { navigate } from '../router';
import { Badge, Button } from '../kit';

const W = 1080;
const H = 1350;
const FPS = 30;

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label])) as Record<CategoryId, string>;

const EffectCard: React.FC<{ def: EffectDef<any>; hovered: boolean; onHover: (id: string | null) => void }> = ({ def, hovered, onHover }) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const { setPendingEffect, setStep, project } = useStudio();
  const duration = stageDuration(def.id, FPS);
  const inputProps = useMemo(() => ({ effectId: def.id }), [def.id]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(effectPrompt(def.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setShowPrompt(true);
    }
  };

  const use = () => {
    setPendingEffect(def.id);
    setStep(project.video ? 'effects' : 'upload');
    navigate('/studio');
  };

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-bg shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(16,24,40,0.10)]"
      onMouseEnter={() => onHover(def.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="relative aspect-[4/5] bg-subtle">
        {hovered ? (
          <Player
            component={EffectStage}
            inputProps={inputProps}
            durationInFrames={duration}
            compositionWidth={W}
            compositionHeight={H}
            fps={FPS}
            autoPlay
            loop
            initiallyMuted
            acknowledgeRemotionLicense
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Thumbnail
            component={EffectStage}
            inputProps={inputProps}
            durationInFrames={duration}
            compositionWidth={W}
            compositionHeight={H}
            fps={FPS}
            frameToDisplay={stageThumbFrame(def.id, FPS)}
            style={{ width: '100%', height: '100%' }}
          />
        )}
        <span className="absolute right-2 top-2 rounded-md bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold text-fg-2 opacity-0 transition group-hover:opacity-100">▶ prévia</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Badge tone="brand">{CATEGORY_LABEL[def.category]}</Badge>
        </div>
        <h3 className="font-display text-[15px] font-semibold leading-snug tracking-tight text-fg">{def.name}</h3>
        <p className="mt-0.5 font-serif text-[14px] italic text-brand">{def.term}</p>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">{def.description}</p>
        <button onClick={() => setShowPrompt((v) => !v)} className="mt-2 self-start text-xs font-medium text-muted hover:text-fg">
          {showPrompt ? '− Esconder o pedido' : '+ Ver o pedido'}
        </button>
        {showPrompt ? <p className="mt-2 rounded-xl bg-subtle p-3 text-[12px] leading-relaxed text-fg-2">{effectPrompt(def.id)}</p> : null}
        <div className="mt-auto flex gap-2 pt-4">
          <Button variant="primary" size="sm" className="h-9 flex-1" onClick={use}>
            Usar no meu vídeo
          </Button>
          <Button variant={copied ? 'dark' : 'soft'} size="sm" className="h-9" onClick={copy} title="Copiar o pedido para colar no Claude ou ChatGPT">
            {copied ? '✓ Copiado' : 'Copiar'}
          </Button>
        </div>
      </div>
    </article>
  );
};

export const LibraryPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    Object.keys(FONTS).forEach((k) => void ensureFont(k));
  }, []);

  const q = query.trim().toLowerCase();
  const matches = EFFECTS.filter((e) => !q || `${e.name} ${e.term} ${e.description} ${CATEGORY_LABEL[e.category]}`.toLowerCase().includes(q));
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, matches.filter((e) => e.category === c.id).length]));
  const sections = CATEGORIES.filter((c) => (cat === 'all' || c.id === cat) && counts[c.id] > 0);

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-24 md:px-8">
      <section className="mt-6 overflow-hidden rounded-3xl border border-line bg-bg md:mt-8">
        <div className="grid gap-8 p-6 md:grid-cols-[1.3fr_1fr] md:p-10">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Biblioteca de efeitos
            </div>
            <h1 className="font-display text-[34px] font-bold leading-[1.05] tracking-tight text-fg md:text-[52px]">
              Encontre o efeito. <span className="font-serif font-normal italic text-brand">Veja no seu vídeo.</span> Use.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
              {EFFECTS.length} animações de motion com nome em português e o termo técnico. Passe o mouse para ver a prévia, use direto no estúdio ou copie o pedido para colar no Claude ou ChatGPT.
            </p>
          </div>
          <ol className="grid content-center gap-2 text-sm">
            {['Encontre um efeito', 'Passe o mouse para ver a prévia', 'Clique em “Usar no meu vídeo”', 'Escolha a palavra que dispara o efeito'].map((t, i) => (
              <li key={t} className="flex items-center gap-3 rounded-xl border border-line bg-subtle px-4 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg text-xs font-bold text-brand ring-1 ring-line">{i + 1}</span>
                <span className="font-medium text-fg-2">{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="sticky top-16 z-10 -mx-4 mt-6 bg-canvas/95 px-4 pb-3 pt-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar: celular, zoom, número, polaroid, marca-texto…"
            className="h-12 w-full rounded-2xl border border-line-strong bg-bg pl-10 pr-4 text-[15px] outline-none transition focus:border-brand focus:ring-4 focus:ring-brand-ring/40"
          />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {[{ id: 'all' as const, label: 'Todos', n: matches.length }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label, n: counts[c.id] }))].map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
                cat === c.id ? 'border-fg bg-fg text-white' : 'border-line-strong bg-bg text-fg-2 hover:bg-subtle'
              }`}
            >
              {c.label}
              <span className={`text-[11px] ${cat === c.id ? 'text-white/60' : 'text-muted'}`}>{c.n}</span>
            </button>
          ))}
        </div>
      </div>

      {sections.map((c) => (
        <section key={c.id} className="mt-8">
          <div className="mb-4 flex items-baseline gap-2">
            <h2 className="font-display text-xl font-bold tracking-tight">{c.label}</h2>
            <span className="text-sm text-muted">{counts[c.id]}</span>
            <span className="ml-2 hidden text-sm text-muted md:inline">· {c.hint}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {matches
              .filter((e) => e.category === c.id)
              .map((e) => (
                <EffectCard key={e.id} def={e} hovered={hovered === e.id} onHover={setHovered} />
              ))}
          </div>
        </section>
      ))}
      {sections.length === 0 ? <p className="py-20 text-center text-muted">Nenhum efeito encontrado para “{query}”.</p> : null}
    </div>
  );
};
