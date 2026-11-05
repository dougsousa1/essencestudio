import React from 'react';
import { AbsoluteFill, Easing, interpolate, interpolateColors, spring } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { Circle, Highlight, StrikeThrough } from '@remotion/rough-notation';
import { fontFamily } from '../../core/fonts';
import type { EffectDef, EffectRenderProps } from '../types';
import { fadeOut, px, rand } from '../util';

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

// ===========================================================================
// Typography effects. Adapted from the Remocn registry (MIT, https://remocn.dev:
// typewriter, marker-highlight, value-swap, infinite-marquee, mask-reveal-up,
// rgb-glitch-text), Remotion Elements (text-marker, circle-marker,
// strike-through, name-lower-third — built on @remotion/rough-notation) and the
// motion library effects 13 (typewriter), 16 (ticker), 17 (highlight),
// 18 (text swap) and 20 (mask reveal).
// ===========================================================================

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Size unit that also respects short (landscape) frames. */
const unit = (width: number, height: number) => Math.min(px(width), height / 864);

const parseHex = (hex: string): [number, number, number] | null => {
  const m = hex.trim().replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (!/^[0-9a-fA-F]{6}/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};
const luminance = (hex: string) => {
  const c = parseHex(hex);
  return c ? (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 : 0.5;
};
/** Readable ink on top of a colored surface. */
const inkOn = (bg: string) => (luminance(bg) > 0.55 ? '#16110F' : '#FFFFFF');
const withAlpha = (hex: string, a: number) => {
  const c = parseHex(hex);
  return c ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : hex;
};
/** Font size that keeps `text` on one line inside `maxW` (ratio ≈ average glyph width / size). */
const fitSize = (text: string, maxW: number, base: number, ratio = 0.56) => Math.min(base, maxW / Math.max(1, text.length * ratio));
const shadowFor = (u: number) => `0 ${4 * u}px ${24 * u}px rgba(0,0,0,0.45)`;
const topFor = (pos: string) => (pos === 'top' ? 0.2 : pos === 'bottom' ? 0.6 : 0.42);
const POSITION_OPTIONS = [
  { value: 'top', label: 'Em cima' },
  { value: 'middle', label: 'No meio' },
  { value: 'bottom', label: 'Embaixo' },
];

// --- Typewriter (Remocn "typewriter" + motion library #13) -------------------

type TypeProps = { text: string; position: string };

const TypewriterFx: React.FC<EffectRenderProps<TypeProps>> = ({ props, frame, fps, durationInFrames, width, height, style, word }) => {
  const u = unit(width, height);
  const out = fadeOut(frame, durationInFrames, fps);
  const chars = Array.from((props.text || word || 'Do bruto ao pronto em minutos.').trim());
  // 25–40 characters per second, fast enough to finish in ~55% of the effect.
  const cps = clamp(chars.length / ((durationInFrames / fps) * 0.55), 25, 40);
  const startF = 0.2 * fps;
  const typed = clamp(Math.floor(((frame - startF) / fps) * cps), 0, chars.length);
  const caretOn = typed < chars.length || Math.floor((frame / fps) * 2.2) % 2 === 0;
  const appear = interpolate(frame, [0, 0.25 * fps], [0, 1], { ...CLAMP, easing: Easing.out(Easing.cubic) });
  const fs = 66 * u;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: 'absolute', left: width * 0.08, right: width * 0.08, top: height * topFor(props.position), display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            backgroundColor: 'rgba(14,11,13,0.68)',
            border: `${1.5 * u}px solid rgba(255,255,255,0.16)`,
            borderRadius: 30 * u,
            padding: `${26 * u}px ${38 * u}px ${30 * u}px`,
            boxShadow: `0 ${18 * u}px ${50 * u}px rgba(0,0,0,0.35)`,
            opacity: appear,
            transform: `translateY(${(1 - appear) * 24 * u}px) scale(${0.96 + 0.04 * appear})`,
          }}
        >
          <div style={{ fontFamily: fontFamily(style.captionFont), fontSize: fs, fontWeight: 600, lineHeight: 1.25, color: style.colors.text, letterSpacing: '-0.01em' }}>
            {chars.slice(0, typed).join('')}
            {/* zero-width caret so the layout never shifts */}
            <span style={{ display: 'inline-block', position: 'relative', width: 0, height: '1em' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 3 * u,
                  top: '-0.04em',
                  width: Math.max(2, 0.075 * fs),
                  height: '1.1em',
                  borderRadius: 2 * u,
                  backgroundColor: style.colors.accent,
                  opacity: caretOn ? 1 : 0,
                }}
              />
            </span>
            <span style={{ color: 'transparent' }}>{chars.slice(typed).join('')}</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// --- Marker highlight (Remocn "marker-highlight" + Elements "text-marker") ----

type MarkerProps = { text: string; highlight: string };

const splitHighlight = (text: string, hl: string): [string, string, string] => {
  const h = hl.trim();
  if (h) {
    const i = text.toLowerCase().indexOf(h.toLowerCase());
    if (i >= 0) return [text.slice(0, i), text.slice(i, i + h.length), text.slice(i + h.length)];
  }
  const m = text.match(/^(.*?)(\S+)(\s*)$/);
  return m ? [m[1], m[2], m[3]] : ['', text, ''];
};

const MarkerHighlight: React.FC<EffectRenderProps<MarkerProps>> = ({ props, frame, fps, durationInFrames, width, height, style, word }) => {
  const u = unit(width, height);
  const out = fadeOut(frame, durationInFrames, fps);
  const text = (props.text || word || 'Simples, rápido e com a sua cara').trim();
  const [before, mark, after] = splitHighlight(text, props.highlight || word);
  const accent = style.colors.accent;
  const ink = inkOn(accent);
  const appear = spring({ frame, fps, config: { damping: 16, stiffness: 150 } });
  const mp = interpolate(frame, [0.35 * fps, 0.95 * fps], [0, 1], {
    ...CLAMP,
    easing: Easing.spring({ damping: 200, mass: 1, stiffness: 100, allowTail: true, durationRestThreshold: 0.02, overshootClamping: false }),
  });
  const markColor = interpolateColors(mp, [0.35, 0.7], [style.colors.text, ink]);
  const fs = Math.min(100 * u, (width * 0.84 * 2.2) / Math.max(1, text.length * 0.52));
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div
        style={{
          position: 'absolute',
          left: width * 0.08,
          right: width * 0.08,
          top: height * 0.58,
          transform: `translateY(-50%) translateY(${(1 - appear) * 40 * u}px)`,
          opacity: clamp(appear * 1.4, 0, 1),
          textAlign: 'center',
          fontFamily: fontFamily(style.titleFont),
          fontSize: fs,
          fontWeight: 700,
          lineHeight: 1.18,
          color: style.colors.text,
          textShadow: shadowFor(u),
        }}
      >
        {before}
        <Highlight
          progress={mp}
          color={withAlpha(accent, 0.94)}
          roughness={2.3}
          maxRandomnessOffset={10 * u}
          bowing={0}
          seed={7}
          padding={{ left: 16 * u, right: 16 * u }}
          style={{ color: markColor, textShadow: mp > 0.5 ? 'none' : shadowFor(u) }}
        >
          {mark}
        </Highlight>
        {after}
      </div>
    </AbsoluteFill>
  );
};

// --- Circle / strike a word (Elements "circle-marker" / "strike-through") ----

type MarkWordProps = { text: string };

const markWordLayout = (text: string, u: number, width: number, height: number, style: EffectRenderProps['style']): React.CSSProperties => ({
  position: 'absolute',
  left: 0,
  right: 0,
  top: height * 0.44,
  textAlign: 'center',
  fontFamily: fontFamily(style.titleFont),
  fontSize: fitSize(text, width * 0.68, 150 * u, 0.55),
  fontWeight: 700,
  lineHeight: 1.1,
  color: style.colors.text,
  textShadow: shadowFor(u),
});

const CircleWord: React.FC<EffectRenderProps<MarkWordProps>> = ({ props, frame, fps, durationInFrames, width, height, style, word }) => {
  const u = unit(width, height);
  const out = fadeOut(frame, durationInFrames, fps);
  const text = (props.text || word || 'essência').trim();
  const appear = spring({ frame, fps, config: { damping: 14, stiffness: 170 } });
  // Stop-motion feel: progress and seed advance in steps (as in Elements' Circle Marker).
  const progress = interpolate(frame, [0.2 * fps, 0.95 * fps], [0, 1], { ...CLAMP, easing: Easing.bezier(0.42, 0, 0.58, 1), posterize: 3 });
  const seed = 1 + Math.floor(frame / 4);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ ...markWordLayout(text, u, width, height, style), transform: `translateY(-50%) scale(${0.85 + 0.15 * appear})`, opacity: clamp(appear * 1.5, 0, 1) }}>
        <Circle
          progress={progress}
          seed={seed}
          roughness={1.8}
          strokeWidth={11 * u}
          color={style.colors.accent}
          padding={{ left: 34 * u, right: 34 * u, top: 20 * u, bottom: 20 * u }}
        >
          {text}
        </Circle>
      </div>
    </AbsoluteFill>
  );
};

const StrikeWord: React.FC<EffectRenderProps<MarkWordProps>> = ({ props, frame, fps, durationInFrames, width, height, style, word }) => {
  const u = unit(width, height);
  const out = fadeOut(frame, durationInFrames, fps);
  const text = (props.text || word || 'complicado').trim();
  const appear = spring({ frame, fps, config: { damping: 14, stiffness: 170 } });
  const progress = interpolate(frame, [0.35 * fps, 0.8 * fps], [0, 1], { ...CLAMP, easing: Easing.out(Easing.quad) });
  const dim = interpolate(frame, [0.8 * fps, 1.1 * fps], [1, 0.62], CLAMP);
  // A tiny shake as the pen finishes the stroke.
  const shake = interpolate(frame, [0.75 * fps, 0.85 * fps, 0.95 * fps, 1.05 * fps], [0, 1, -0.6, 0], CLAMP) * 5 * u;
  const color = luminance(style.colors.accent) < 0.7 ? style.colors.accent : '#FF4B4B';
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div
        style={{
          ...markWordLayout(text, u, width, height, style),
          transform: `translateY(-50%) translateX(${shake}px) scale(${0.85 + 0.15 * appear})`,
          opacity: clamp(appear * 1.5, 0, 1),
        }}
      >
        <StrikeThrough
          progress={progress}
          color={color}
          strokeWidth={16 * u}
          roughness={1.6}
          seed={3}
          // The line sits at the box centre: extend the box downwards so it crosses the x-height.
          style={{ opacity: dim, paddingBottom: '0.26em', marginBottom: '-0.26em' }}
        >
          {text}
        </StrikeThrough>
      </div>
    </AbsoluteFill>
  );
};

// --- Text swap (motion library #18 + Remocn "value-swap") --------------------

type SwapProps = { prefix: string; words: string };

const TextSwap: React.FC<EffectRenderProps<SwapProps>> = ({ props, frame, fps, durationInFrames, width, height, style, word }) => {
  const u = unit(width, height);
  const out = fadeOut(frame, durationInFrames, fps);
  const list = props.words
    .split(/\n|,/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (!list.length) list.push(word || 'cara');
  const n = list.length;
  const longest = list.reduce((a, b) => (b.length > a.length ? b : a), '');
  const fs = fitSize(longest, width * 0.84, 150 * u, 0.55);
  const lineH = fs * 1.2;
  const maskH = fs * 1.55; // room for the underline under the last word
  const t0 = 0.12 * fps;
  const swapDur = 0.3 * fps;
  const step = Math.min(0.6 * fps, (durationInFrames * 0.6 - t0) / Math.max(1, n - 1));
  const swapP = (start: number) => interpolate(frame, [start, start + swapDur], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.cubic) });
  const prefixIn = interpolate(frame, [0, 0.3 * fps], [0, 1], { ...CLAMP, easing: Easing.out(Easing.cubic) });
  const landed = t0 + (n - 1) * step + swapDur;
  const underline = interpolate(frame, [landed, landed + 0.35 * fps], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.quad) });
  const landPop = interpolate(frame, [landed - 0.05 * fps, landed + 0.08 * fps, landed + 0.25 * fps], [1, 1.07, 1], CLAMP);
  const under = 'M4 14 C 60 4 140 4 296 10';
  const ev = evolvePath(underline, under);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: 'absolute', left: width * 0.08, right: width * 0.08, top: height * 0.36, textAlign: 'center' }}>
        <div
          style={{
            fontFamily: fontFamily(style.titleFont),
            fontSize: 82 * u,
            fontWeight: 600,
            lineHeight: 1.1,
            color: style.colors.text,
            textShadow: shadowFor(u),
            opacity: prefixIn,
            transform: `translateY(${(1 - prefixIn) * 24 * u}px)`,
          }}
        >
          {props.prefix}
        </div>
        <div style={{ position: 'relative', height: maskH, overflow: 'hidden', marginTop: 4 * u }}>
          {list.map((w, i) => {
            const pIn = i === 0 ? swapP(t0 - swapDur * 0.5) : swapP(t0 + i * step);
            const pOut = i < n - 1 ? swapP(t0 + (i + 1) * step) : 0;
            if (pIn <= 0 || pOut >= 1) return null;
            const y = (1 - pIn) * maskH - pOut * maskH;
            const blur = (Math.sin(pIn * Math.PI) + Math.sin(pOut * Math.PI)) * 3 * u;
            const last = i === n - 1;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  textAlign: 'center',
                  transform: `translateY(${y}px) scale(${last ? landPop : 1})`,
                  filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
                }}
              >
                <span
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    fontFamily: fontFamily(style.accentFont),
                    fontStyle: 'italic',
                    fontSize: fs,
                    fontWeight: 600,
                    lineHeight: `${lineH}px`,
                    color: style.colors.accent,
                    textShadow: shadowFor(u),
                    whiteSpace: 'nowrap',
                  }}
                >
                  {w}
                  {last && underline > 0 ? (
                    <svg
                      viewBox="0 0 300 20"
                      preserveAspectRatio="none"
                      style={{ position: 'absolute', left: '-4%', width: '108%', top: lineH * 0.9, height: fs * 0.16, overflow: 'visible' }}
                    >
                      <path d={under} fill="none" stroke={style.colors.accent} strokeWidth={5} strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
                    </svg>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// --- Ticker (motion library #16 + Remocn "infinite-marquee") -----------------

type TickerProps = { text: string; speed: number };

const Ticker: React.FC<EffectRenderProps<TickerProps>> = ({ props, frame, fps, durationInFrames, width, height, style, word }) => {
  const u = unit(width, height);
  const accent = style.colors.accent;
  const ink = inkOn(accent);
  const label = (props.text || word || 'assista até o fim').trim();
  const fs = 60 * u;
  const bandH = fs * 1.8;
  const open = interpolate(frame, [0, 0.3 * fps], [0, 1], { ...CLAMP, easing: Easing.out(Easing.cubic) });
  const close = interpolate(frame, [durationInFrames - 0.3 * fps, durationInFrames], [1, 0], { ...CLAMP, easing: Easing.in(Easing.cubic) });
  // Constant (linear) speed; the strip is long enough to never wrap, so there is no seam.
  const pxPerSec = 240 * u * (props.speed || 1);
  const offset = (frame / fps) * pxPerSec;
  const maxOffset = (durationInFrames / fps) * pxPerSec;
  const approxUnit = Math.max(1, (label.length + 3) * fs * 0.5);
  const copies = Math.ceil((width * 1.6 + maxOffset) / (approxUnit * 0.75)) + 2;
  const itemStyle: React.CSSProperties = {
    fontFamily: fontFamily(style.captionFont),
    fontSize: fs,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: ink,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  };
  return (
    <AbsoluteFill style={{ opacity: close }}>
      <div
        style={{
          position: 'absolute',
          left: -width * 0.15,
          width: width * 1.3,
          top: height * 0.79 - bandH / 2,
          height: bandH,
          backgroundColor: accent,
          overflow: 'hidden',
          transform: `rotate(-3deg) scaleY(${open})`,
          boxShadow: `0 ${12 * u}px ${30 * u}px rgba(0,0,0,0.35)`,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', transform: `translateX(${-offset}px)`, paddingLeft: width * 0.1 }}>
          {Array.from({ length: copies }, (_, i) => (
            <React.Fragment key={i}>
              <span style={itemStyle}>{label}</span>
              <span style={{ ...itemStyle, fontSize: fs * 0.7, margin: `0 ${0.6 * fs}px`, opacity: 0.85 }}>✦</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// --- Mask reveal (motion library #20 + Remocn "mask-reveal-up") --------------

type RevealProps = { text: string; subtitle: string };

const MaskReveal: React.FC<EffectRenderProps<RevealProps>> = ({ props, frame, fps, durationInFrames, width, height, style, word }) => {
  const u = unit(width, height);
  const text = (props.text || word || 'Essência').trim();
  const fs = fitSize(text, width * 0.84, 190 * u, 0.56);
  const exitStart = durationInFrames - 0.4 * fps;
  const line = interpolate(frame, [0, 0.35 * fps], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.cubic) }) * interpolate(frame, [exitStart + 0.15 * fps, durationInFrames], [1, 0], { ...CLAMP, easing: Easing.in(Easing.cubic) });
  const rise = interpolate(frame, [0.15 * fps, 0.75 * fps], [0, 1], { ...CLAMP, easing: Easing.out(Easing.cubic) });
  const sub = interpolate(frame, [0.4 * fps, 0.95 * fps], [0, 1], { ...CLAMP, easing: Easing.out(Easing.cubic) });
  const sink = interpolate(frame, [exitStart, exitStart + 0.28 * fps], [0, 1], { ...CLAMP, easing: Easing.in(Easing.cubic) });
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: width * 0.08, right: width * 0.08, top: height * 0.5, transform: 'translateY(-60%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ overflow: 'hidden', paddingTop: fs * 0.08 }}>
          <div
            style={{
              transform: `translateY(${(1 - rise + sink) * 112}%)`,
              fontFamily: fontFamily(style.titleFont),
              fontSize: fs,
              fontWeight: 700,
              lineHeight: 1.08,
              paddingBottom: fs * 0.06,
              color: style.colors.text,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              textShadow: `0 ${2 * u}px ${18 * u}px rgba(0,0,0,0.35)`,
            }}
          >
            {text}
          </div>
        </div>
        <div style={{ width: width * 0.7, height: 5 * u, backgroundColor: style.colors.accent, transform: `scaleX(${line})`, borderRadius: 3 * u, boxShadow: `0 ${2 * u}px ${10 * u}px rgba(0,0,0,0.3)` }} />
        {props.subtitle ? (
          <div style={{ overflow: 'hidden', marginTop: 14 * u }}>
            <div
              style={{
                transform: `translateY(${-(1 - sub + sink) * 115}%)`,
                fontFamily: fontFamily(style.captionFont),
                fontSize: 34 * u,
                fontWeight: 600,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: style.colors.text,
                opacity: 0.9,
                whiteSpace: 'nowrap',
                textShadow: `0 ${2 * u}px ${12 * u}px rgba(0,0,0,0.45)`,
              }}
            >
              {props.subtitle}
            </div>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// --- Glitch word (Remocn "rgb-glitch-text") ----------------------------------

type GlitchProps = { text: string };

const RGB = ['#FF2D55', '#2DFF7A', '#2D7BFF'];

const GlitchWord: React.FC<EffectRenderProps<GlitchProps>> = ({ props, frame, fps, durationInFrames, width, height, style, word }) => {
  const u = unit(width, height);
  const out = fadeOut(frame, durationInFrames, fps, 0.25);
  const text = (props.text || word || 'glitch').trim().toUpperCase();
  const fs = fitSize(text, width * 0.84, 200 * u, 0.7);
  const lineH = fs * 1.1;
  const every = Math.max(6, Math.round(0.7 * fps));
  const burst = frame < 0.3 * fps || frame % every < 4 || frame > durationInFrames - 0.3 * fps;
  const tick = Math.floor(frame / 2);
  const r = (n: number) => (rand(tick * 13.37 + n * 7.91) - 0.5) * 2;
  const amp = (burst ? 18 : 3.5) * u;
  const flicker = frame < 0.3 * fps && rand(frame * 7.1) < 0.3 ? 0.25 : 1;
  // Horizontal slices only while glitching (a single clean stack otherwise).
  const strips = burst ? 6 : 1;
  const sh = lineH / strips;
  const padX = width * 0.12;
  const textStyle: React.CSSProperties = {
    fontFamily: fontFamily(style.captionFont),
    fontSize: fs,
    fontWeight: 900,
    lineHeight: `${lineH}px`,
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
  };
  const skew = burst ? r(99) * 6 : 0;
  return (
    <AbsoluteFill style={{ opacity: out * flicker }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: height * 0.45,
          display: 'flex',
          justifyContent: 'center',
          transform: `translateY(-50%) skewX(${skew}deg)`,
          filter: `drop-shadow(0 ${4 * u}px ${18 * u}px rgba(0,0,0,0.5))`,
        }}
      >
        <div style={{ position: 'relative', isolation: 'isolate' }}>
          <div style={{ ...textStyle, visibility: 'hidden' }}>{text}</div>
          {Array.from({ length: strips }, (_, i) => {
            const shift = burst && rand(tick * 3.3 + i * 1.7) > 0.5 ? r(i + 10) * 34 * u : 0;
            return (
              <div key={i} style={{ position: 'absolute', left: -padX, right: -padX, top: i * sh, height: sh + 0.5, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: padX, top: -i * sh, transform: `translateX(${shift}px)` }}>
                  {RGB.map((c, j) => (
                    <div
                      key={j}
                      style={{
                        ...textStyle,
                        position: j === 0 ? 'relative' : 'absolute',
                        left: 0,
                        top: 0,
                        color: c,
                        mixBlendMode: 'screen',
                        transform: `translate(${r(j * 2 + 1) * amp}px, ${r(j * 2 + 2) * amp * 0.35}px)`,
                      }}
                    >
                      {text}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {burst
        ? [0, 1].map((k) => (
            <div
              key={k}
              style={{
                position: 'absolute',
                left: width * (0.1 + rand(tick + k * 5) * 0.2),
                width: width * (0.3 + rand(tick * 2 + k) * 0.4),
                top: height * 0.45 + r(k + 40) * lineH * 0.5,
                height: (2 + rand(tick + k) * 5) * u,
                backgroundColor: k === 0 ? 'rgba(255,255,255,0.85)' : withAlpha(RGB[2], 0.8),
                mixBlendMode: 'screen',
              }}
            />
          ))
        : null}
    </AbsoluteFill>
  );
};

// --- Lower third (Elements "name-lower-third") --------------------------------

type LowerProps = { name: string; role: string };

const LowerThird: React.FC<EffectRenderProps<LowerProps>> = ({ props, frame, fps, durationInFrames, width, height, style }) => {
  const u = unit(width, height);
  const k = fps / 30;
  const ease = Easing.bezier(0.65, 0, 0.35, 1);
  const reveal = (a: number, b: number, c: number, d: number) =>
    interpolate(frame, [a * k, b * k, durationInFrames - c * k, durationInFrames - d * k], [0, 1, 1, 0], { ...CLAMP, easing: ease });
  const bar = reveal(0, 12, 20, 2);
  const nameP = reveal(4, 24, 24, 4);
  const roleP = reveal(8, 28, 28, 8);
  const accent = style.colors.accent;
  const row = (p: number, content: React.ReactNode, rowStyle: React.CSSProperties) => (
    <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
      <div style={{ ...rowStyle, visibility: 'hidden' }}>{content}</div>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${p * 100}%`, overflow: 'hidden' }}>
        <div style={{ ...rowStyle, width: 'max-content' }}>
          <div style={{ transform: `translateX(${(1 - p) * -30 * u}px)` }}>{content}</div>
        </div>
      </div>
    </div>
  );
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: width * 0.08, top: height * 0.6, display: 'flex', alignItems: 'stretch', filter: `drop-shadow(0 ${8 * u}px ${18 * u}px rgba(0,0,0,0.3))` }}>
        <div style={{ width: 10 * u, backgroundColor: accent, transform: `scaleY(${bar})`, transformOrigin: '50% 0%', marginRight: 10 * u, borderRadius: 2 * u }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {row(nameP, props.name || 'Marina Costa', {
            backgroundColor: accent,
            color: inkOn(accent),
            fontFamily: fontFamily(style.titleFont),
            fontSize: 66 * u,
            fontWeight: 700,
            lineHeight: 1,
            padding: `${20 * u}px ${32 * u}px`,
            whiteSpace: 'nowrap',
          })}
          {row(roleP, props.role || 'Criadora de conteúdo', {
            backgroundColor: '#141114',
            color: '#FFFFFF',
            fontFamily: fontFamily(style.captionFont),
            fontSize: 30 * u,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            lineHeight: 1,
            padding: `${15 * u}px ${32 * u}px`,
            whiteSpace: 'nowrap',
          })}
        </div>
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
  {
    id: 'typewriter',
    name: 'Máquina de escrever',
    term: 'typewriter',
    category: 'text',
    description: 'A frase vai sendo digitada letra por letra (25 a 40 por segundo) num cartão escuro, com cursor piscando na cor de destaque.',
    source: 'remocn',
    defaultDuration: 3,
    sfx: 'click',
    fields: [
      { key: 'text', label: 'Texto', type: 'text', default: 'Do bruto ao pronto em minutos.', placeholder: 'Vazio = palavra falada' },
      { key: 'position', label: 'Posição', type: 'select', default: 'middle', options: POSITION_OPTIONS },
    ],
    Overlay: TypewriterFx,
  },
  {
    id: 'marker-highlight',
    name: 'Marca-texto',
    term: 'highlight',
    category: 'text',
    description: 'Uma frase aparece e um marca-texto desenhado à mão passa da esquerda para a direita sobre a palavra-chave.',
    source: 'elements',
    defaultDuration: 2.5,
    sfx: 'swish',
    fields: [
      { key: 'text', label: 'Frase', type: 'text', default: 'Simples, rápido e com a sua cara', placeholder: 'Vazio = palavra falada' },
      { key: 'highlight', label: 'Palavra marcada', type: 'text', default: 'sua cara', placeholder: 'Vazio = palavra falada ou a última' },
    ],
    Overlay: MarkerHighlight,
  },
  {
    id: 'circle-word',
    name: 'Círculo à mão',
    term: 'circle marker',
    category: 'text',
    description: 'A palavra aparece grande e um círculo rabiscado à mão se desenha em volta dela, tremendo como animação quadro a quadro.',
    source: 'elements',
    defaultDuration: 2.5,
    sfx: 'swish',
    fields: [{ key: 'text', label: 'Texto circulado', type: 'text', default: '', placeholder: 'Vazio = palavra falada' }],
    Overlay: CircleWord,
  },
  {
    id: 'strike-word',
    name: 'Riscar',
    term: 'strike through',
    category: 'text',
    description: 'A palavra aparece e é riscada com um traço feito à mão — ótimo para “isso não”, preços antigos e mitos.',
    source: 'elements',
    defaultDuration: 2.5,
    sfx: 'swish',
    fields: [{ key: 'text', label: 'Texto riscado', type: 'text', default: '', placeholder: 'Vazio = palavra falada' }],
    Overlay: StrikeWord,
  },
  {
    id: 'text-swap',
    name: 'Trocar a palavra',
    term: 'text swap',
    category: 'text',
    description: 'Uma frase fixa com a última palavra trocando sozinha (sai por cima, entra por baixo) até parar na palavra final, que ganha um sublinhado.',
    source: 'biblioteca',
    defaultDuration: 3.2,
    sfx: 'click',
    fields: [
      { key: 'prefix', label: 'Começo da frase', type: 'text', default: 'Fica com a sua' },
      { key: 'words', label: 'Palavras (uma por linha, a última fica)', type: 'textarea', default: 'vibe\nvoz\nestética\ncara' },
    ],
    Overlay: TextSwap,
  },
  {
    id: 'ticker',
    name: 'Letreiro rolando',
    term: 'ticker · marquee',
    category: 'text',
    description: 'Uma faixa inclinada na cor de destaque atravessa a parte de baixo da tela com o texto rolando sem parar, como rodapé de notícia.',
    source: 'biblioteca',
    defaultDuration: 3.5,
    sfx: 'whoosh',
    fields: [
      { key: 'text', label: 'Texto', type: 'text', default: 'assista até o fim', placeholder: 'Vazio = palavra falada' },
      { key: 'speed', label: 'Velocidade', type: 'number', default: 1, min: 0.3, max: 3, step: 0.1 },
    ],
    Overlay: Ticker,
  },
  {
    id: 'mask-reveal',
    name: 'Revelar por máscara',
    term: 'mask reveal',
    category: 'text',
    description: 'Uma linha se desenha e o texto grande sobe de trás dela, com um subtítulo descendo logo abaixo.',
    source: 'biblioteca',
    defaultDuration: 2.5,
    sfx: 'whoosh',
    fields: [
      { key: 'text', label: 'Texto grande', type: 'text', default: '', placeholder: 'Vazio = palavra falada' },
      { key: 'subtitle', label: 'Subtítulo', type: 'text', default: 'uma palavra, um efeito' },
    ],
    Overlay: MaskReveal,
  },
  {
    id: 'glitch-word',
    name: 'Glitch',
    term: 'RGB glitch text',
    category: 'text',
    description: 'A palavra em caixa alta com as camadas vermelha, verde e azul separadas, tremendo e se fatiando em pequenas falhas digitais.',
    source: 'remocn',
    defaultDuration: 2,
    sfx: 'click',
    fields: [{ key: 'text', label: 'Texto', type: 'text', default: '', placeholder: 'Vazio = palavra falada' }],
    Overlay: GlitchWord,
  },
  {
    id: 'lower-third',
    name: 'Nome na tela',
    term: 'name lower third',
    category: 'text',
    description: 'Nome e função no terço inferior, com uma barra na cor de destaque — para se apresentar ou apresentar um convidado.',
    source: 'elements',
    defaultDuration: 3.5,
    sfx: 'swish',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', default: 'Marina Costa' },
      { key: 'role', label: 'Função', type: 'text', default: 'Criadora de conteúdo' },
    ],
    Overlay: LowerThird,
  },
];
