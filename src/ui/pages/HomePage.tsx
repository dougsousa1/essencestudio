import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Player, Thumbnail } from '@remotion/player';
import { EFFECTS } from '../../effects/registry';
import { CATEGORIES } from '../../effects/types';
import { EffectStage, stageDuration, stageThumbFrame } from '../../effects/EffectStage';
import { FONTS, ensureFont } from '../../core/fonts';
import { LOOKS } from '../../core/presets';
import { useStudio } from '../../core/store';
import { useVideoUpload } from '../panels/UploadPanel';
import { navigate } from '../router';
import { Button, Card, Eyebrow } from '../kit';

const FPS = 30;

/** Phone frame cycling through a few effects from the library. */
const HeroPhone: React.FC = () => {
  const showcase = useMemo(() => {
    const wanted = ['phone-mockup', 'glass-graph', 'slot-machine', 'polaroid-orbit', 'checklist', 'animated-title'];
    const picked = wanted.filter((id) => EFFECTS.some((e) => e.id === id));
    return picked.length ? picked : EFFECTS.slice(0, 4).map((e) => e.id);
  }, []);
  const [i, setI] = useState(0);
  const id = showcase[i % showcase.length];
  const duration = stageDuration(id, FPS);
  useEffect(() => {
    const t = setTimeout(() => setI((x) => x + 1), (duration / FPS) * 1000);
    return () => clearTimeout(t);
  }, [i, duration]);
  const def = EFFECTS.find((e) => e.id === id);
  return (
    <div className="relative mx-auto w-[260px] md:w-[300px]">
      <div className="rounded-[44px] bg-fg p-2.5 shadow-[0_40px_80px_rgba(16,24,40,0.25)]">
        <div className="aspect-[9/19] overflow-hidden rounded-[36px] bg-subtle">
          <Player
            key={id}
            component={EffectStage}
            inputProps={{ effectId: id }}
            durationInFrames={duration}
            compositionWidth={1080}
            compositionHeight={2280}
            fps={FPS}
            autoPlay
            initiallyMuted
            acknowledgeRemotionLicense
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
      {def ? (
        <div className="absolute -left-10 bottom-16 hidden rounded-2xl border border-line bg-bg px-4 py-3 shadow-[0_12px_32px_rgba(16,24,40,0.12)] md:block">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Efeito</div>
          <div className="text-sm font-semibold text-fg">{def.name}</div>
          <div className="font-serif text-[13px] italic text-brand">{def.term}</div>
        </div>
      ) : null}
    </div>
  );
};

const Dropzone: React.FC = () => {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const { onFile, error } = useVideoUpload();
  const setStep = useStudio((s) => s.setStep);
  const handle = async (f: File) => {
    if (await onFile(f)) {
      setStep('cut');
      navigate('/studio');
    }
  };
  return (
    <div>
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
          if (f) void handle(f);
        }}
        onClick={() => input.current?.click()}
        className={`flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed p-4 transition ${drag ? 'border-brand bg-brand-soft' : 'border-line-strong bg-bg hover:border-brand'}`}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-lg text-brand">↑</div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-fg">Arraste seu vídeo aqui para começar</div>
          <div className="text-xs text-muted">MP4, MOV ou WebM · o vídeo não sai do seu computador</div>
        </div>
        <input
          ref={input}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handle(f);
            e.target.value = '';
          }}
        />
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
};

const STEPS = [
  { n: '1', t: 'Envie o vídeo', d: 'Uma gravação no celular, falando para a câmera.' },
  { n: '2', t: 'Corte pelas palavras', d: 'A IA transcreve e tira pausas, erros e “né”.' },
  { n: '3', t: 'Escolha o estilo', d: 'Looks prontos, com as cores e fontes da sua marca.' },
  { n: '4', t: 'Coloque os efeitos', d: 'Uma palavra, um efeito: escolha na biblioteca.' },
  { n: '5', t: 'Exporte', d: 'MP4 pronto para postar, capa e legenda do post.' },
];

const FAQ = [
  { q: 'Preciso instalar alguma coisa?', a: 'Não. Tudo roda no navegador. Use o Google Chrome para ter a transcrição automática e a exportação mais rápida.' },
  { q: 'Meu vídeo é enviado para algum servidor?', a: 'Não. O vídeo, a transcrição e a exportação acontecem no seu computador.' },
  { q: 'Funciona em português?', a: 'Sim. A transcrição reconhece português, inglês e espanhol, e todos os textos podem ser editados.' },
  { q: 'Que tipo de vídeo fica melhor?', a: 'Vídeos falando para a câmera: dicas, storytime, rotina, opinião. Não é feito para dança ou vídeos com várias câmeras.' },
];

export const HomePage: React.FC = () => {
  const setStep = useStudio((s) => s.setStep);
  const featured = useMemo(() => EFFECTS.slice(0, 8), []);
  useEffect(() => {
    Object.keys(FONTS).forEach((k) => void ensureFont(k));
  }, []);

  return (
    <div className="pb-20">
      {/* Hero */}
      <section className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 pb-16 pt-10 md:grid-cols-[1.15fr_1fr] md:px-8 md:pt-16">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1 text-xs font-semibold text-fg-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Estúdio de Reels no navegador
          </div>
          <h1 className="font-display text-[42px] font-bold leading-[1.02] tracking-tight text-fg md:text-[64px]">
            Edite um Reel que as pessoas <span className="font-serif font-normal italic text-brand">assistem até o fim.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
            Cortes por palavra, legendas palavra por palavra, títulos, efeitos de motion e sons, no estilo da sua marca. Sem CapCut, sem linha do tempo, sem instalar nada.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setStep('upload');
                navigate('/studio');
              }}
            >
              Abrir o estúdio
            </Button>
            <Button variant="soft" size="lg" onClick={() => navigate('/biblioteca')}>
              Ver a biblioteca de efeitos
            </Button>
          </div>
          <div className="mt-6 max-w-lg">
            <Dropzone />
          </div>
          <dl className="mt-8 grid max-w-lg grid-cols-3 gap-4">
            {[
              { k: `${EFFECTS.length}`, v: 'efeitos de motion' },
              { k: `${LOOKS.length}`, v: 'estilos prontos' },
              { k: '100%', v: 'no navegador' },
            ].map((x) => (
              <div key={x.v}>
                <dt className="font-display text-2xl font-bold tracking-tight text-fg">{x.k}</dt>
                <dd className="text-xs text-muted">{x.v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <HeroPhone />
      </section>

      {/* Two tools */}
      <section className="mx-auto max-w-[1240px] px-4 md:px-8">
        <Eyebrow className="mb-3">Duas ferramentas, um fluxo</Eyebrow>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="flex flex-col p-6 md:p-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">✦</div>
            <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">Estúdio</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">Monte o Reel em 6 passos. Veja cada escolha no seu próprio vídeo antes de exportar.</p>
            <ul className="mt-5 grid gap-2 text-sm text-fg-2">
              {['Transcrição e cortes automáticos', 'Looks Soft, Scrapbook, Signature e Headline', 'Cores, fontes e posição das legendas', 'Efeitos e sons em cada palavra', 'MP4, capa e legenda do post'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="text-brand">✓</span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-6">
              <Button
                variant="primary"
                onClick={() => {
                  setStep('upload');
                  navigate('/studio');
                }}
              >
                Abrir o estúdio ›
              </Button>
            </div>
          </Card>
          <Card className="flex flex-col p-6 md:p-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">✺</div>
            <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">Biblioteca de efeitos</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              {EFFECTS.length} animações em {CATEGORIES.length} categorias, com nome em português. Use no estúdio com um clique ou copie o pedido para a sua IA.
            </p>
            <div className="mt-5 grid grid-cols-4 gap-2">
              {featured.slice(0, 4).map((e) => (
                <div key={e.id} className="aspect-[4/5] overflow-hidden rounded-xl bg-subtle ring-1 ring-line">
                  <Thumbnail
                    component={EffectStage}
                    inputProps={{ effectId: e.id }}
                    durationInFrames={stageDuration(e.id, FPS)}
                    compositionWidth={1080}
                    compositionHeight={1350}
                    fps={FPS}
                    frameToDisplay={stageThumbFrame(e.id, FPS)}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-auto pt-6">
              <Button variant="soft" onClick={() => navigate('/biblioteca')}>
                Explorar a biblioteca ›
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto mt-16 max-w-[1240px] px-4 md:px-8">
        <Eyebrow className="mb-3">Como funciona</Eyebrow>
        <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight md:text-4xl">Do vídeo cru ao Reel pronto, em minutos.</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-5">
          {STEPS.map((s) => (
            <Card key={s.n} className="p-5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{s.n}</div>
              <div className="mt-3 font-semibold text-fg">{s.t}</div>
              <div className="mt-1 text-[13px] leading-relaxed text-muted">{s.d}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* Looks */}
      <section className="mx-auto mt-16 max-w-[1240px] px-4 md:px-8">
        <Eyebrow className="mb-3">Estilos prontos</Eyebrow>
        <div className="grid gap-3 md:grid-cols-4">
          {LOOKS.map((l) => (
            <Card key={l.id} className="p-5">
              <div className="text-xs font-semibold text-brand">{l.tagline}</div>
              <div className="mt-2 font-display text-xl font-bold tracking-tight">{l.name}</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{l.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-16 max-w-[900px] px-4 md:px-8">
        <Eyebrow className="mb-3 text-center">Perguntas frequentes</Eyebrow>
        <div className="divide-y divide-line rounded-2xl border border-line bg-bg">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-fg">
                {f.q}
                <span className="text-muted transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="mx-auto mt-16 flex max-w-[1240px] flex-wrap items-center justify-between gap-3 border-t border-line px-4 pt-6 text-xs text-muted md:px-8">
        <span>
          <b className="text-fg">Essence Studio</b> · feito com Remotion
        </span>
        <span>Seu vídeo nunca sai do seu computador.</span>
      </footer>
    </div>
  );
};
