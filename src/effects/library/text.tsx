import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring } from 'remotion';
import { fontFamily } from '../../core/fonts';
import type { EffectDef, EffectRenderProps } from '../types';
import { fadeOut, px } from '../util';

// ---------------------------------------------------------------------------
// Animated title: the entrance motions from the motion library (fade in,
// slide in, pop in, scale up, blur in, stagger, overshoot, bounce, elastic).
// ---------------------------------------------------------------------------

type TitleProps = { text: string; entrance: string; position: string; size: number; font: string; colorMode: string };

const ENTRANCES = [
  { value: 'fade', label: 'Surgir · fade in' },
  { value: 'slide', label: 'Deslizar · slide in' },
  { value: 'pop', label: 'Aparecer com salto · pop in' },
  { value: 'scale', label: 'Crescer · scale up' },
  { value: 'blur', label: 'Do borrado ao nítido · blur in' },
  { value: 'stagger', label: 'Cascata · stagger' },
  { value: 'overshoot', label: 'Passa do ponto · overshoot' },
  { value: 'bounce', label: 'Quicar · bounce' },
  { value: 'elastic', label: 'Elástico · elastic' },
];

const entranceStyle = (kind: string, f: number, fps: number, s: number): React.CSSProperties => {
  const t = (sec: number) => interpolate(f, [0, sec * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  switch (kind) {
    case 'slide':
      return { opacity: t(0.4), transform: `translateX(${(1 - t(0.5)) * 70 * s}px)` };
    case 'pop':
      return { transform: `scale(${interpolate(f, [0, 0.35 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.7)) })})` };
    case 'scale':
      return { opacity: t(0.4), transform: `scale(${0.8 + 0.2 * t(0.6)})` };
    case 'blur':
      return { opacity: t(0.5), filter: `blur(${(1 - t(0.6)) * 12 * s}px)` };
    case 'overshoot':
      return { transform: `translateY(${(1 - interpolate(f, [0, 0.5 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) })) * 120 * s}px)` };
    case 'bounce':
      return { transform: `translateY(${-(1 - interpolate(f, [0, 0.9 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bounce })) * 400 * s}px)` };
    case 'elastic':
      return { transform: `scale(${interpolate(f, [0, 1.1 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.elastic(1.2) })})` };
    default:
      return { opacity: t(0.4) };
  }
};

const AnimatedTitle: React.FC<EffectRenderProps<TitleProps>> = ({ props, frame, fps, durationInFrames, width, height, style }) => {
  const s = px(width);
  const out = fadeOut(frame, durationInFrames, fps);
  const top = props.position === 'top' ? 0.2 : props.position === 'bottom' ? 0.62 : 0.42;
  const color = props.colorMode === 'accent' ? style.colors.accent : style.colors.text;
  const fam = fontFamily(props.font === 'caption' ? style.captionFont : props.font === 'accent' ? style.accentFont : style.titleFont);
  const words = props.text.split(/\s+/).filter(Boolean);
  const textStyle: React.CSSProperties = {
    fontFamily: fam,
    fontSize: props.size * s,
    fontWeight: 700,
    lineHeight: 1.05,
    color,
    textAlign: 'center',
    textShadow: `0 ${4 * s}px ${24 * s}px rgba(0,0,0,0.45)`,
  };
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: 'absolute', left: width * 0.08, right: width * 0.08, top: height * top, ...textStyle }}>
        {props.entrance === 'stagger' ? (
          words.map((w, i) => {
            const local = frame - i * 0.08 * fps;
            const p = spring({ frame: local, fps, config: { damping: 14, stiffness: 170 } });
            return (
              <span key={i} style={{ display: 'inline-block', margin: `0 ${0.12 * props.size * s}px`, opacity: Math.min(1, Math.max(0, p)), transform: `translateY(${(1 - p) * 40 * s}px)` }}>
                {w}
              </span>
            );
          })
        ) : (
          <div style={entranceStyle(props.entrance, frame, fps, s)}>{props.text}</div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const TEXT_EFFECTS: EffectDef<any>[] = [
  {
    id: 'animated-title',
    name: 'Título animado',
    term: 'fade · slide · pop · blur · stagger',
    category: 'text',
    description: 'Um título grande com 9 tipos de entrada da biblioteca de motion: surgir, deslizar, salto, crescer, desfoque, cascata, tranco, quicar e elástico.',
    source: 'biblioteca',
    defaultDuration: 2.5,
    sfx: 'swish',
    fields: [
      { key: 'text', label: 'Texto', type: 'text', default: 'Uma palavra, um efeito' },
      { key: 'entrance', label: 'Entrada', type: 'select', default: 'pop', options: ENTRANCES },
      {
        key: 'position',
        label: 'Posição',
        type: 'select',
        default: 'middle',
        options: [
          { value: 'top', label: 'Em cima' },
          { value: 'middle', label: 'No meio' },
          { value: 'bottom', label: 'Embaixo' },
        ],
      },
      { key: 'size', label: 'Tamanho', type: 'number', default: 110, min: 50, max: 220, step: 2 },
      {
        key: 'font',
        label: 'Fonte',
        type: 'select',
        default: 'title',
        options: [
          { value: 'title', label: 'Fonte dos títulos' },
          { value: 'caption', label: 'Fonte das legendas' },
          { value: 'accent', label: 'Fonte de destaque' },
        ],
      },
      {
        key: 'colorMode',
        label: 'Cor',
        type: 'select',
        default: 'text',
        options: [
          { value: 'text', label: 'Cor do texto' },
          { value: 'accent', label: 'Cor de destaque' },
        ],
      },
    ],
    Overlay: AnimatedTitle,
  },
];
