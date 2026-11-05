import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring } from 'remotion';
import { getLength, getPointAtLength } from '@remotion/paths';
import { fontFamily } from '../../core/fonts';
import type { EffectDef, EffectRenderProps } from '../types';
import { fadeOut, pop } from '../util';

// ---------------------------------------------------------------------------
// Numbers & charts: count-up, liquid glass graph, bar grow, slot machine,
// match cut, progress slider and a result card.
// Everything is frame-driven and uses only CSS the MP4 exporter can draw.
// ---------------------------------------------------------------------------

// ---------- small local helpers ----------

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const clamp01 = (x: number) => clamp(x, 0, 1);

/** 0 → 1 between frames a and b. */
const ramp = (f: number, a: number, b: number, easing: (t: number) => number = Easing.out(Easing.cubic)) =>
  b <= a ? (f >= b ? 1 : 0) : interpolate(f, [a, b], [0, 1], { ...CLAMP, easing });

/** Fast start, long soft landing: the classic counter feel. */
const COUNT_EASE = Easing.bezier(0.2, 0.85, 0.3, 1);

/**
 * Scale factor. Designed at 1080 wide (9:16); for square / landscape the
 * height is the limit, so layouts never overflow the frame.
 */
const fit = (w: number, h: number) => Math.min(w, h * 0.75) / 1080;

const num = (v: unknown, d = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : d;
};

const list = (v: unknown) =>
  String(v ?? '')
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

const numList = (v: unknown, fallback: number[]) => {
  const out = list(v)
    .map((x) => parseFloat(x.replace(/\s/g, '')))
    .filter((x) => Number.isFinite(x));
  return out.length >= 2 ? out : fallback;
};

const decimalsOf = (...xs: number[]) => Math.min(2, Math.max(0, ...xs.map((x) => (String(x).split('.')[1] ?? '').length)));

/** pt-BR number: 12.480 / 3,8 */
const fmt = (n: number, d = 0) => {
  const fixed = Math.abs(n).toFixed(d);
  const [i, f] = fixed.split('.');
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '−' : '') + int + (f ? ',' + f : '');
};

// ---------- color helpers ----------

type RGB = [number, number, number];

const toRgb = (c: string): RGB => {
  const s = String(c ?? '').trim();
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h.slice(0, 6), 16);
    if (Number.isFinite(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = s.match(/(\d+(\.\d+)?)/g);
  if (m && m.length >= 3) return [Number(m[0]), Number(m[1]), Number(m[2])];
  return [242, 169, 192];
};

const rgbStr = ([r, g, b]: RGB, a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
const rgba = (c: string, a: number) => rgbStr(toRgb(c), a);

const lumOf = (rgb: RGB) => {
  const [r, g, b] = rgb.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Darkens a color (keeping its hue) until its luminance is <= target. Good for white text on top. */
const deepen = (c: string, target = 0.22) => {
  const base = toRgb(c);
  let rgb: RGB = base;
  for (let t = 0; t <= 0.85 && lumOf(rgb) > target; t += 0.04) {
    rgb = [base[0] * (1 - t), base[1] * (1 - t), base[2] * (1 - t)];
  }
  return rgbStr(rgb);
};

/** Text color that reads on top of `c`. */
const inkOn = (c: string) => (lumOf(toRgb(c)) > 0.42 ? '#1A1512' : '#FFFFFF');

const fonts = (style: EffectRenderProps['style']) => ({
  title: fontFamily(style.titleFont),
  caption: fontFamily(style.captionFont),
  accent: fontFamily(style.accentFont),
});

// ---------- rolling digits ----------
// Odometer idea adapted from Remocn's rolling-number (MIT, https://remocn.dev).
// Each digit lives in a fixed-width cell (the MP4 export can't use tabular-nums),
// so the number never jitters while it counts.

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

// Cell width (in em) = widest digit of the font, measured once the font is loaded.
const cellCache = new Map<string, number>();
let measureCtx: CanvasRenderingContext2D | null = null;
const measureCell = (family: string, weight: number, italic = false) => {
  const key = `${family}|${weight}|${italic}`;
  const hit = cellCache.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined') return 0.58;
  try {
    const font = `${italic ? 'italic ' : ''}${weight} 100px ${family}`;
    measureCtx = measureCtx ?? document.createElement('canvas').getContext('2d');
    if (!measureCtx) return 0.58;
    measureCtx.font = font;
    let w = 0;
    for (const d of '0123456789') w = Math.max(w, measureCtx.measureText(d).width);
    const cell = clamp(w / 100 + 0.025, 0.38, 0.78);
    if (document.fonts?.check(font)) cellCache.set(key, cell);
    return cell;
  } catch {
    return 0.58;
  }
};

/** Column position (0..10) of the digit at `place` for a continuous value: odometer carry. */
const columnPos = (v: number, place: number) => {
  const P = 10 ** place;
  const base = Math.floor(v / P);
  const rem = v - base * P;
  return (base % 10) + Math.max(0, rem - (P - 1));
};

type OdometerProps = {
  value: number;
  /** Value one frame earlier (motion blur). */
  prev: number;
  /** Largest value this number will show (sets the number of digits). */
  max: number;
  decimals: number;
  size: number;
  family: string;
  color: string;
  weight?: number;
  italic?: boolean;
  cell?: number;
};

const Odometer: React.FC<OdometerProps> = ({ value, prev, max, decimals, size, family, color, weight = 600, italic, cell: cellProp }) => {
  const cell = cellProp ?? measureCell(family, weight, italic);
  const D = clamp(Math.round(decimals), 0, 3);
  const k = 10 ** D;
  const V = Math.abs(value) * k;
  const Vp = Math.abs(prev) * k;
  const total = Math.max(String(Math.round(Math.max(Math.abs(max), Math.abs(value)) * k)).length, D + 1);
  const h = size * 1.12;
  const cw = cell * size;
  const nodes: React.ReactNode[] = [];
  const sep = (key: string, ch: string, reveal: number) => (
    <span key={key} style={{ display: 'inline-block', width: 0.24 * size * reveal, height: h, lineHeight: `${h}px`, textAlign: 'center', overflow: 'hidden', opacity: reveal }}>
      {ch}
    </span>
  );
  for (let p = total - 1; p >= 0; p--) {
    const q = p - D;
    const P = 10 ** p;
    const reveal = q <= 0 ? 1 : clamp01((V - 0.9 * P) / (0.1 * P));
    const pos = columnPos(V, p);
    let speed = Math.abs(pos - columnPos(Vp, p));
    speed = Math.min(speed, 10 - speed);
    const blur = Math.min(size * 0.035, speed * size * 0.025);
    const w = cw * reveal;
    nodes.push(
      <span key={`d${p}`} style={{ display: 'inline-block', position: 'relative', width: w, height: h, overflow: 'hidden', opacity: reveal }}>
        <span
          style={{
            position: 'absolute',
            left: (w - cw) / 2,
            top: 0,
            width: cw,
            transform: `translateY(${-pos * h}px)`,
            filter: blur > 0.5 ? `blur(${blur.toFixed(2)}px)` : undefined,
          }}
        >
          {DIGITS.map((d, i) => (
            <span key={i} style={{ display: 'block', height: h, lineHeight: `${h}px`, textAlign: 'center' }}>
              {d}
            </span>
          ))}
        </span>
      </span>,
    );
    if (q > 0 && q % 3 === 0) nodes.push(sep(`s${p}`, '.', reveal));
    if (q === 0 && D > 0) nodes.push(sep('dec', ',', 1));
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'flex-start',
        height: h,
        fontFamily: family,
        fontSize: size,
        fontWeight: weight,
        fontStyle: italic ? 'italic' : 'normal',
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {value < 0 ? sep('neg', '−', 1) : null}
      {nodes}
    </span>
  );
};

/** Rough width (px) of an Odometer, used to auto-fit long numbers. */
const odometerWidth = (max: number, decimals: number, size: number, cell = 0.58) => {
  const k = 10 ** decimals;
  const digits = Math.max(String(Math.round(Math.abs(max) * k)).length, decimals + 1);
  const intDigits = digits - decimals;
  const seps = Math.floor((intDigits - 1) / 3) + (decimals > 0 ? 1 : 0);
  return (digits * cell + seps * 0.24) * size;
};

/** Frosted glass: a heavily blurred copy of the footage, aligned to the frame, inside a clipped card. */
const Frost: React.FC<{ VideoCopy: EffectRenderProps['VideoCopy']; x: number; y: number; width: number; height: number; blur: number; tint: string }> = ({
  VideoCopy,
  x,
  y,
  width,
  height,
  blur,
  tint,
}) => (
  <>
    <div style={{ position: 'absolute', left: -x, top: -y, width, height, filter: `blur(${blur}px) saturate(1.15)` }}>
      <VideoCopy />
    </div>
    <div style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: tint }} />
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.06) 38%, rgba(255,255,255,0) 60%, rgba(0,0,0,0.10) 100%)',
      }}
    />
  </>
);

/** Small "trending up" arrow drawn in SVG (glyphs like ↗ are missing from many fonts). */
const TrendIcon: React.FC<{ size: number; color: string; stroke?: number }> = ({ size, color, stroke = 2.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
    <path d="M3 17 L9.5 10.5 L13.5 14.5 L21 7" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14.5 7 L21 7 L21 13.5" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Smooth curve through points (Catmull-Rom → cubic Bézier). */
const smoothPath = (pts: Array<{ x: number; y: number }>) => {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
};

const useSvgId = (prefix: string) => prefix + React.useId().replace(/[^a-zA-Z0-9]/g, '');

const POSITION_3 = [
  { value: 'top', label: 'Em cima' },
  { value: 'middle', label: 'No meio' },
  { value: 'bottom', label: 'Embaixo' },
];

// ---------------------------------------------------------------------------
// 1. Count-up — "Número contando"
// ---------------------------------------------------------------------------

type CountUpProps = { from: number; to: number; prefix: string; suffix: string; label: string; decimals: number; position: string; size: number; colorMode: string; numFont: string };

const CountUp: React.FC<EffectRenderProps<CountUpProps>> = ({ props, frame, fps, durationInFrames, width, height, style }) => {
  const s = fit(width, height);
  const f = fonts(style);
  const accent = style.colors.accent;
  const from = num(props.from, 0);
  const to = num(props.to, 100);
  const dec = clamp(Math.round(num(props.decimals, 0)), 0, 3);
  const c0 = 0.15 * fps;
  const c1 = c0 + Math.min(1.5 * fps, durationInFrames * 0.5);
  const valueAt = (fr: number) => from + (to - from) * ramp(fr, c0, c1, COUNT_EASE);

  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 150 } });
  const appear = ramp(frame, 0, 0.3 * fps);
  const out = fadeOut(frame, durationInFrames, fps);
  const land = frame - c1;
  const punch = interpolate(land, [0, 0.07 * fps, 0.45 * fps], [0, 1, 0], { ...CLAMP, easing: Easing.out(Easing.quad) });
  const under = ramp(frame, c1 - 0.05 * fps, c1 + 0.4 * fps, Easing.out(Easing.cubic));
  const labelIn = ramp(frame, 0.05 * fps, 0.5 * fps);

  const numColor = props.colorMode === 'accent' ? accent : style.colors.text;
  const affixColor = props.colorMode === 'accent' ? style.colors.text : accent;
  const max = Math.max(Math.abs(from), Math.abs(to));
  // Auto-shrink long numbers so they stay inside the side margins.
  let size = num(props.size, 220) * s;
  const numFam = props.numFont === 'title' ? f.title : props.numFont === 'caption' ? f.caption : f.accent;
  const numWeight = props.numFont === 'accent' || !props.numFont ? 500 : 600;
  const cell = measureCell(numFam, numWeight);
  const est = odometerWidth(max, dec, size, cell) + (String(props.prefix ?? '').length + String(props.suffix ?? '').length) * size * 0.4;
  size *= Math.min(1, (width * 0.84) / Math.max(1, est));

  const topF = props.position === 'middle' ? 0.36 : props.position === 'bottom' ? 0.56 : 0.14;
  const scrim =
    props.position === 'bottom'
      ? 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.25) 35%, rgba(0,0,0,0) 62%)'
      : props.position === 'middle'
        ? 'linear-gradient(to bottom, rgba(0,0,0,0) 22%, rgba(0,0,0,0.38) 42%, rgba(0,0,0,0.38) 58%, rgba(0,0,0,0) 78%)'
        : 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.25) 25%, rgba(0,0,0,0) 48%)';

  const affix = (text: string, side: 'l' | 'r') =>
    text ? (
      <span
        style={{
          fontFamily: f.accent,
          fontStyle: 'italic',
          fontWeight: 500,
          fontSize: size * 0.6,
          lineHeight: 1,
          color: affixColor,
          marginBottom: size * 0.16,
          marginLeft: side === 'r' ? size * 0.1 : 0,
          marginRight: side === 'l' ? size * 0.05 : 0,
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    ) : null;

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <AbsoluteFill style={{ backgroundImage: scrim, opacity: appear * 0.9 }} />
      <div
        style={{
          position: 'absolute',
          left: width * 0.06,
          right: width * 0.06,
          top: height * topF,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: clamp01(enter * 1.5),
          transform: `translateY(${(1 - enter) * 50 * s}px) scale(${0.95 + 0.05 * out})`,
          filter: out < 1 ? `blur(${((1 - out) * 10 * s).toFixed(2)}px)` : undefined,
        }}
      >
        {props.label ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 * s, opacity: labelIn, transform: `translateY(${(1 - labelIn) * 14 * s}px)` }}>
            <div style={{ width: 44 * s * labelIn, height: 2.5 * s, backgroundColor: accent, borderRadius: 2 * s }} />
            <span
              style={{
                fontFamily: f.caption,
                fontSize: 30 * s,
                fontWeight: 600,
                letterSpacing: `${0.42 - 0.12 * labelIn}em`,
                color: style.colors.text,
                textTransform: 'uppercase',
                textShadow: `0 ${2 * s}px ${12 * s}px rgba(0,0,0,0.5)`,
                whiteSpace: 'nowrap',
              }}
            >
              {props.label}
            </span>
            <div style={{ width: 44 * s * labelIn, height: 2.5 * s, backgroundColor: accent, borderRadius: 2 * s }} />
          </div>
        ) : null}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            marginTop: 4 * s,
            transform: `scale(${1 + 0.12 * punch})`,
            filter: `drop-shadow(0 ${6 * s}px ${22 * s}px rgba(0,0,0,0.45))${punch > 0.01 ? ` drop-shadow(0 0 ${(28 * s * punch).toFixed(2)}px ${rgba(accent, 0.85 * punch)})` : ''}`,
          }}
        >
          {affix(String(props.prefix ?? ''), 'l')}
          <Odometer value={valueAt(frame)} prev={valueAt(frame - 1)} max={max} decimals={dec} size={size} family={numFam} color={numColor} weight={numWeight} cell={cell} />
          {affix(String(props.suffix ?? ''), 'r')}
        </div>
        <div
          style={{
            width: Math.min(380 * s, est * 0.45),
            height: 9 * s,
            marginTop: 6 * s,
            borderRadius: 9 * s,
            backgroundColor: accent,
            transform: `scaleX(${under})`,
            boxShadow: `0 0 ${24 * s}px ${rgba(accent, 0.6)}`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 2. Liquid glass graph — "Gráfico de vidro"
// ---------------------------------------------------------------------------

type GlassGraphProps = { label: string; number: number; startLabel: string; endLabel: string; values: string; blurBg: boolean };

const graphWindow = (fps: number, durationInFrames: number) => {
  const d0 = 0.35 * fps;
  const d1 = Math.max(d0 + 0.6 * fps, Math.min(2.2 * fps, durationInFrames - 0.9 * fps));
  return { d0, d1 };
};

const GlassGraph: React.FC<EffectRenderProps<GlassGraphProps>> = ({ props, frame, fps, durationInFrames, width, height, style, VideoCopy }) => {
  const s = fit(width, height);
  const id = useSvgId('gg');
  const f = fonts(style);
  const accent = style.colors.accent;
  const out = fadeOut(frame, durationInFrames, fps, 0.35);
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 140 } });

  const cw = Math.min(width * 0.86, 920 * s);
  const ch = cw * 0.86;
  const u = cw / 920;
  const x = (width - cw) / 2;
  const y = height * 0.46 - ch / 2 + (1 - enter) * 80 * s + (1 - out) * 30 * s;
  const R = 46 * u;
  const pad = 58 * u;

  const vals = numList(props.values, [12, 18, 21, 34, 47, 58, 63]);
  const vmin = Math.min(...vals);
  const vmax = Math.max(...vals);
  const cTop = ch * 0.4;
  const cBottom = ch - pad - 58 * u;
  const cLeft = pad + 4 * u;
  const cRight = cw - pad - 14 * u;
  const pts = vals.map((v, i) => ({
    x: cLeft + ((cRight - cLeft) * i) / (vals.length - 1),
    y: cBottom - ((v - vmin) / (vmax - vmin || 1)) * (cBottom - cTop),
  }));
  const d = smoothPath(pts);
  const len = React.useMemo(() => getLength(d), [d]);

  const { d0, d1 } = graphWindow(fps, durationInFrames);
  const dp = ramp(frame, d0, d1, Easing.inOut(Easing.cubic));
  const head = getPointAtLength(d, Math.max(0.001, len * dp)) ?? pts[0];
  const total = num(props.number, 0);
  const countP = (fr: number) => Easing.out(Easing.quad)(ramp(fr, d0, d1, Easing.inOut(Easing.cubic)));
  const last = pts[pts.length - 1];

  const sinceDone = frame - d1;
  const land = interpolate(sinceDone, [0, 0.12 * fps, 0.45 * fps], [0, 1, 0], CLAMP);
  const pulseT = sinceDone > 0 ? (sinceDone % (1.1 * fps)) / (1.1 * fps) : 0;
  const textIn = ramp(frame, 0.15 * fps, 0.6 * fps);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: cw,
          height: ch,
          borderRadius: R,
          overflow: 'hidden',
          opacity: clamp01(enter * 1.4),
          transform: `scale(${(0.94 + 0.06 * enter) * (0.97 + 0.03 * out)})`,
          border: `${2 * u}px solid rgba(255,255,255,0.55)`,
          boxSizing: 'border-box',
          boxShadow: `0 ${30 * s}px ${80 * s}px rgba(0,0,0,0.35)`,
        }}
      >
        <Frost VideoCopy={VideoCopy} x={x} y={y} width={width} height={height} blur={46 * s} tint="rgba(30,24,27,0.3)" />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: ch * 0.7, backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.26), rgba(0,0,0,0))' }} />

        {/* Label + number */}
        <div
          style={{
            position: 'absolute',
            left: pad,
            top: pad + 12 * u,
            fontFamily: f.caption,
            fontSize: 25 * u,
            fontWeight: 600,
            letterSpacing: '0.22em',
            color: 'rgba(255,255,255,0.92)',
            textTransform: 'uppercase',
            textShadow: `0 ${2 * u}px ${10 * u}px rgba(0,0,0,0.35)`,
            opacity: textIn,
            whiteSpace: 'nowrap',
          }}
        >
          {props.label}
        </div>
        <div
          style={{
            position: 'absolute',
            right: pad - 6 * u,
            top: pad + 26 * u,
            opacity: textIn,
            transform: `scale(${1 + 0.06 * land})`,
            transformOrigin: '100% 50%',
            filter: `drop-shadow(0 ${4 * u}px ${16 * u}px rgba(0,0,0,0.3))`,
          }}
        >
          <Odometer value={total * countP(frame)} prev={total * countP(frame - 1)} max={total} decimals={0} size={112 * u} family={f.accent} color="#FFFFFF" weight={500} />
        </div>

        {/* Chart */}
        <svg width={cw} height={ch} viewBox={`0 0 ${cw} ${ch}`} style={{ position: 'absolute', left: 0, top: 0 }}>
          <defs>
            <linearGradient id={`${id}fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.55} />
              <stop offset="100%" stopColor={accent} stopOpacity={0} />
            </linearGradient>
            <clipPath id={`${id}clip`}>
              <rect x={0} y={0} width={Math.max(0, head.x)} height={ch} />
            </clipPath>
            <filter id={`${id}glow`} filterUnits="userSpaceOnUse" x={0} y={0} width={cw} height={ch}>
              <feGaussianBlur stdDeviation={9 * u} />
            </filter>
          </defs>
          <path d={`${d} L ${last.x} ${cBottom + 30 * u} L ${pts[0].x} ${cBottom + 30 * u} Z`} fill={`url(#${id}fill)`} clipPath={`url(#${id}clip)`} opacity={dp > 0 ? 1 : 0} />
          <path d={d} fill="none" stroke={accent} strokeWidth={16 * u} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - dp)} filter={`url(#${id}glow)`} opacity={0.9} />
          <path d={d} fill="none" stroke="#FFFFFF" strokeWidth={5.5 * u} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - dp)} />
          {dp > 0 ? (
            <>
              <circle cx={head.x} cy={head.y} r={24 * u} fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.7)" strokeWidth={2 * u} />
              {pulseT > 0 ? <circle cx={head.x} cy={head.y} r={24 * u + 40 * u * pulseT} fill="none" stroke="#FFFFFF" strokeWidth={2.5 * u} opacity={0.7 * (1 - pulseT)} /> : null}
              <circle cx={head.x} cy={head.y} r={20 * u} fill={accent} opacity={0.55} filter={`url(#${id}glow)`} />
              <circle cx={head.x} cy={head.y} r={11 * u * (1 + 0.35 * land)} fill="#FFFFFF" />
            </>
          ) : null}
        </svg>

        {/* Dates */}
        {[props.startLabel, props.endLabel].map((t, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              bottom: pad - 4 * u,
              left: i === 0 ? pad : undefined,
              right: i === 1 ? pad : undefined,
              fontFamily: f.caption,
              fontSize: 22 * u,
              fontWeight: 600,
              letterSpacing: '0.14em',
              color: 'rgba(255,255,255,0.85)',
              textTransform: 'uppercase',
              opacity: i === 0 ? textIn : ramp(frame, d1 - 0.25 * fps, d1 + 0.1 * fps),
              whiteSpace: 'nowrap',
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const glassGraphVideoStyle = ({ props, frame, fps, durationInFrames, width, height }: EffectRenderProps<GlassGraphProps>): React.CSSProperties => {
  if (props.blurBg === false) return {};
  const k = ramp(frame, 0, 0.45 * fps) * fadeOut(frame, durationInFrames, fps, 0.35);
  return { filter: `blur(${(14 * fit(width, height) * k).toFixed(2)}px) brightness(${(1 - 0.18 * k).toFixed(3)})` };
};

// ---------------------------------------------------------------------------
// 3. Chart grow — "Barras crescendo"
// ---------------------------------------------------------------------------

type ChartGrowProps = { values: string; labels: string; suffix: string; tag: string };

const ChartGrow: React.FC<EffectRenderProps<ChartGrowProps>> = ({ props, frame, fps, durationInFrames, width, height, style }) => {
  const s = fit(width, height);
  const f = fonts(style);
  const accent = style.colors.accent;
  const ink = inkOn(accent);
  const out = fadeOut(frame, durationInFrames, fps);
  const appear = ramp(frame, 0, 0.3 * fps);

  const vals = numList(props.values, [18, 26, 24, 41, 57, 82]).slice(0, 8).map((v) => Math.max(0, v));
  const labels = list(props.labels);
  const n = vals.length;
  const vmax = Math.max(...vals, 1e-6);
  const top = height * 0.12;
  const barTop = top + 58 * s;
  const base = barTop + 300 * s;
  const H = base - barTop;
  const gapRatio = 0.42;
  let barW = Math.min(width * 0.84, 940 * s) / (n + (n - 1) * gapRatio);
  barW = Math.min(barW, 150 * s);
  const gap = barW * gapRatio;
  const totalW = n * barW + (n - 1) * gap;
  const left = (width - totalW) / 2;
  const hi = vals.indexOf(vmax);
  const grow = 0.6 * fps;
  const startOf = (i: number) => (0.18 + i * Math.min(0.11, 1.1 / n)) * fps;
  const baseLine = ramp(frame, 0, 0.35 * fps);
  const lastDone = startOf(n - 1) + grow * 0.8;
  const tagP = spring({ frame: frame - lastDone, fps, config: { damping: 12, stiffness: 190 } });
  const dec = decimalsOf(...vals);

  return (
    <AbsoluteFill style={{ opacity: out, transform: `translateY(${-(1 - out) * 24 * s}px)` }}>
      <AbsoluteFill style={{ backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.28) 22%, rgba(0,0,0,0) 42%)', opacity: appear }} />
      {vals.map((v, i) => {
        const st = startOf(i);
        const p = interpolate(frame, [st, st + grow], [0, 1], { ...CLAMP, easing: Easing.out(Easing.back(1.25)) });
        const h = Math.max(0.05, v / vmax) * H * p;
        const isHi = i === hi;
        const lp = spring({ frame: frame - (st + grow * 0.5), fps, config: { damping: 11, stiffness: 200 } });
        const bx = left + i * (barW + gap);
        const r = Math.min(barW * 0.3, 26 * s);
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute',
                left: bx,
                top: base - h,
                width: barW,
                height: h,
                borderRadius: `${r}px ${r}px ${4 * s}px ${4 * s}px`,
                backgroundImage: `linear-gradient(to top, ${rgba(accent, 0.55)} 0%, ${rgba(accent, 0.92)} 55%, ${accent} 100%)`,
                boxShadow: isHi ? `0 0 ${36 * s}px ${rgba(accent, 0.7)}` : `0 ${10 * s}px ${26 * s}px rgba(0,0,0,0.25)`,
                opacity: p > 0 ? 1 : 0,
              }}
            >
              <div style={{ position: 'absolute', left: barW * 0.14, top: r * 0.5, width: barW * 0.12, bottom: r * 0.5, borderRadius: barW, backgroundColor: 'rgba(255,255,255,0.28)' }} />
            </div>
            {/* value label */}
            <div
              style={{
                position: 'absolute',
                left: bx - 40 * s,
                width: barW + 80 * s,
                top: base - h - 52 * s,
                display: 'flex',
                justifyContent: 'center',
                opacity: clamp01(lp * 1.4),
                transform: `scale(${0.4 + 0.6 * lp})`,
                transformOrigin: '50% 100%',
              }}
            >
              <span
                style={{
                  fontFamily: f.caption,
                  fontSize: (isHi ? 30 : 27) * s,
                  fontWeight: 700,
                  color: isHi ? ink : '#FFFFFF',
                  backgroundColor: isHi ? accent : 'rgba(0,0,0,0)',
                  padding: isHi ? `${3 * s}px ${12 * s}px` : 0,
                  borderRadius: 999,
                  textShadow: isHi ? undefined : `0 ${2 * s}px ${10 * s}px rgba(0,0,0,0.6)`,
                  whiteSpace: 'nowrap',
                }}
              >
                {fmt(v * Math.min(1, p), dec)}
                {props.suffix}
              </span>
            </div>
            {/* axis label */}
            {labels[i] ? (
              <div
                style={{
                  position: 'absolute',
                  left: bx - 30 * s,
                  width: barW + 60 * s,
                  top: base + 14 * s,
                  textAlign: 'center',
                  fontFamily: f.caption,
                  fontSize: 22 * s,
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  color: 'rgba(255,255,255,0.88)',
                  textTransform: 'uppercase',
                  textShadow: `0 ${2 * s}px ${8 * s}px rgba(0,0,0,0.6)`,
                  opacity: ramp(frame, st, st + 0.3 * fps),
                }}
              >
                {labels[i]}
              </div>
            ) : null}
          </React.Fragment>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: left - 12 * s,
          top: base,
          width: totalW + 24 * s,
          height: 2.5 * s,
          backgroundColor: 'rgba(255,255,255,0.6)',
          transform: `scaleX(${baseLine})`,
          transformOrigin: '0% 50%',
        }}
      />
      {props.tag ? (
        <div
          style={{
            position: 'absolute',
            left: left - 4 * s,
            top: base + 62 * s,
            display: 'flex',
            alignItems: 'center',
            gap: 10 * s,
            padding: `${8 * s}px ${18 * s}px`,
            borderRadius: 12 * s,
            backgroundColor: accent,
            boxShadow: `0 ${10 * s}px ${26 * s}px rgba(0,0,0,0.3)`,
            opacity: clamp01(tagP * 1.5),
            transform: `scale(${tagP}) rotate(${-4 * tagP}deg)`,
            transformOrigin: '0% 50%',
          }}
        >
          <span style={{ fontFamily: f.caption, fontSize: 28 * s, fontWeight: 800, letterSpacing: '0.06em', color: ink, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{props.tag}</span>
          <TrendIcon size={30 * s} color={ink} stroke={3} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 4. Slot machine — "Caça-níquel"
// ---------------------------------------------------------------------------

type SlotProps = { labelA: string; wordsA: string; labelB: string; wordsB: string; position: string };

const SPIN_EASE = Easing.bezier(0.45, 0.05, 0.2, 1);

const reelPos = (fr: number, start: number, landF: number, finalIdx: number) => {
  let x = finalIdx * SPIN_EASE(clamp01((fr - start) / Math.max(1, landF - start)));
  const l = fr - landF;
  if (l > 0) x += 0.2 * Math.sin(l * 0.6) * Math.exp(-l * 0.25);
  return x;
};

const SlotCard: React.FC<{
  label: string;
  words: string[];
  frame: number;
  fps: number;
  start: number;
  landF: number;
  width: number;
  height: number;
  s: number;
  accent: string;
  labelFont: string;
  wordFont: string;
  flash: number;
  bump: number;
}> = ({ label, words, frame, fps, start, landF, width, height, s, accent, labelFont, wordFont, flash, bump }) => {
  const rounds = words.length <= 2 ? 5 : 3;
  const strip: string[] = [];
  for (let r = 0; r < rounds; r++) strip.push(...words);
  const finalIdx = strip.length - 1;
  strip.push(words[0]);
  const b = 4 * s;
  const labelH = 38 * s;
  const ih = height - 2 * b - labelH - 8 * s;
  const x = reelPos(frame, start, landF, finalIdx);
  const v = Math.abs(x - reelPos(frame - 1, start, landF, finalIdx));
  const blur = Math.min(6 * s, v * ih * 0.1);
  const border = deepen(accent, 0.3);
  void fps;
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        boxSizing: 'border-box',
        borderRadius: 26 * s,
        backgroundColor: '#FFFFFF',
        border: `${b}px solid ${border}`,
        overflow: 'hidden',
        boxShadow: `0 ${16 * s}px ${40 * s}px rgba(0,0,0,0.32)${flash > 0.01 ? `, 0 0 ${(54 * s * flash).toFixed(2)}px ${rgba(accent, 0.95 * flash)}` : ''}`,
        transform: `scale(${1 + 0.05 * bump})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 22 * s,
          top: 12 * s,
          fontFamily: labelFont,
          fontSize: 18 * s,
          fontWeight: 700,
          letterSpacing: '0.2em',
          color: border,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: labelH, height: ih, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, transform: `translateY(${-x * ih}px)`, filter: blur > 0.4 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
          {strip.map((w, i) => (
            <div
              key={i}
              style={{
                height: ih,
                lineHeight: `${ih}px`,
                textAlign: 'center',
                fontFamily: wordFont,
                fontStyle: 'italic',
                fontWeight: 500,
                fontSize: Math.min(62 * s, ((width - 40 * s) / Math.max(4, w.length)) * 1.9),
                color: '#1B1614',
                whiteSpace: 'nowrap',
              }}
            >
              {w}
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: ih * 0.22, backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,1), rgba(255,255,255,0))' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: ih * 0.22, backgroundImage: 'linear-gradient(to top, rgba(255,255,255,1), rgba(255,255,255,0))' }} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: accent, opacity: 0.55 * flash }} />
    </div>
  );
};

const SlotMachine: React.FC<EffectRenderProps<SlotProps>> = ({ props, frame, fps, durationInFrames, width, height, style }) => {
  const s = fit(width, height);
  const f = fonts(style);
  const accent = style.colors.accent;
  const out = fadeOut(frame, durationInFrames, fps);
  const wordsA = list(props.wordsA);
  const wordsB = list(props.wordsB);
  const A = wordsA.length ? wordsA : ['—'];
  const B = wordsB.length ? wordsB : ['—'];
  const start = 0.2 * fps;
  const landA = Math.min(1.25 * fps, durationInFrames * 0.42);
  const landB = landA + 0.4 * fps;
  const fB = landB + 0.06 * fps;
  const flash = interpolate(frame - fB, [0, 0.05 * fps, 0.5 * fps], [0, 1, 0], CLAMP);
  const growP = spring({ frame: frame - fB, fps, config: { damping: 11, stiffness: 170 } });
  const bump = (l: number) => interpolate(frame - l, [0, 0.06 * fps, 0.3 * fps], [0, 1, 0], CLAMP);
  const cardW = Math.min(width * 0.4, 440 * s);
  const cardH = 158 * s;
  const gap = 24 * s;
  const cy = props.position === 'top' ? 0.24 : props.position === 'middle' ? 0.5 : 0.64;
  const cards = [
    { label: props.labelA, words: A, land: landA },
    { label: props.labelB, words: B, land: landB },
  ];
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: height * cy - cardH / 2,
          display: 'flex',
          justifyContent: 'center',
          gap,
          transform: `scale(${(1 + 0.08 * growP) * (0.92 + 0.08 * out)})`,
        }}
      >
        {cards.map((c, i) => {
          const p = pop(frame, fps, i * 0.07);
          return (
            <div key={i} style={{ opacity: clamp01(p * 1.6), transform: `translateY(${(1 - p) * 90 * s}px) scale(${0.85 + 0.15 * p})` }}>
              <SlotCard
                label={c.label}
                words={c.words}
                frame={frame}
                fps={fps}
                start={start + i * 0.05 * fps}
                landF={c.land}
                width={cardW}
                height={cardH}
                s={s}
                accent={accent}
                labelFont={f.caption}
                wordFont={f.accent}
                flash={flash}
                bump={bump(c.land)}
              />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 5. Match cut — "a palavra fica, o mundo muda"
// ---------------------------------------------------------------------------

type MatchCutProps = { word: string; text: string; text2: string; mode: string };

type World = { bg: string; ink: string; family: string; weight: number; italic?: boolean; lines?: boolean };

const WORLDS: World[] = [
  { bg: '#EFE5CF', ink: '#3A2F25', family: "Georgia, 'Times New Roman', serif", weight: 700 },
  { bg: '#16110F', ink: '#EFE7DA', family: "'Helvetica Neue', Arial, sans-serif", weight: 700 },
  { bg: '#FBFAF7', ink: '#2B2B2B', family: "'Helvetica Neue', Arial, sans-serif", weight: 500 },
  { bg: '#D9D3CA', ink: '#4A4642', family: "'Courier New', Courier, monospace", weight: 700 },
  { bg: '#FBF5EC', ink: '#3B3340', family: `${fontFamily('Caveat')}, cursive`, weight: 600, italic: true, lines: true },
];

const buildLines = (text: string, nLines: number, target: number, offset: number, centerIdx: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  const ws = words.length ? words : ['texto'];
  let k = offset;
  const take = (chars: number) => {
    let line = '';
    while (line.length < chars) line += (line ? ' ' : '') + ws[k++ % ws.length];
    return line;
  };
  const lines: Array<string | [string, string]> = [];
  for (let i = 0; i < nLines; i++) lines.push(i === centerIdx ? [take(target * 0.5), take(target * 0.5)] : take(target));
  return lines;
};

const MatchCut: React.FC<EffectRenderProps<MatchCutProps>> = ({ props, frame, fps, durationInFrames, width, height, style, word }) => {
  const s = fit(width, height);
  const f = fonts(style);
  const accent = style.colors.accent;
  const chipBg = deepen(accent, 0.2);
  const chipWord = String(props.word || word || 'agora').trim();
  const out = fadeOut(frame, durationInFrames, fps, 0.3);

  // Which "world" (page style + paragraph) is on screen.
  const cuts = props.mode === 'cuts';
  const interval = Math.max(4, Math.round(0.42 * fps));
  const half = Math.round(durationInFrames * 0.5);
  const idx = cuts ? Math.floor(frame / interval) : frame < half ? 0 : 1;
  const lastCut = cuts ? idx * interval : idx === 0 ? 0 : half;
  const world = WORLDS[idx % WORLDS.length];
  const paragraph = idx % 2 === 0 ? props.text : props.text2 || props.text;

  const fs = 74 * s;
  const lineH = fs * 1.32;
  const nLines = Math.ceil(height / lineH) + 3;
  const centerIdx = Math.floor(nLines / 2);
  const topOffset = height / 2 - (centerIdx + 0.5) * lineH;
  const target = Math.ceil((width * 1.35) / (fs * 0.5));
  const lines = buildLines(paragraph, nLines, target, (idx * 5) % 17, centerIdx);

  const chipFs = 96 * s;
  const gapW = chipWord.length * chipFs * 0.46 + 96 * s;

  const pageIn = ramp(frame, 0, 0.1 * fps);
  const blur = 5 * s * ramp(frame, 0.05 * fps, 0.55 * fps, Easing.inOut(Easing.quad));
  const drift = 1 + 0.08 * (frame / durationInFrames);
  const chipP = spring({ frame: frame - 0.12 * fps, fps, config: { damping: 13, stiffness: 190 } });
  const cutKick = lastCut > 0 ? interpolate(frame - lastCut, [0, 2, 9], [1, 1, 0], CLAMP) : 0;
  const flash = !cuts && lastCut > 0 ? interpolate(frame - lastCut, [0, 1, 6], [0.4, 0.4, 0], CLAMP) : 0;

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: world.bg, opacity: pageIn * out, overflow: 'hidden' }}>
        <AbsoluteFill style={{ transform: `scale(${drift}) translateX(${-14 * s * (frame / durationInFrames)}px)`, transformOrigin: '50% 50%' }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: topOffset,
              fontFamily: world.family,
              fontWeight: world.weight,
              fontStyle: world.italic ? 'italic' : 'normal',
              fontSize: world.lines ? fs * 1.1 : fs,
              color: world.ink,
              filter: blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : undefined,
            }}
          >
            {lines.map((ln, i) => {
              const lineStyle: React.CSSProperties = {
                height: lineH,
                lineHeight: `${lineH}px`,
                display: 'flex',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box',
                borderBottom: world.lines ? `${2 * s}px solid rgba(214,130,150,0.35)` : undefined,
              };
              return typeof ln === 'string' ? (
                <div key={i} style={{ ...lineStyle, justifyContent: 'center' }}>
                  {ln}
                </div>
              ) : (
                <div key={i} style={lineStyle}>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>{ln[0]}</div>
                  <div style={{ width: gapW, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', justifyContent: 'flex-start' }}>{ln[1]}</div>
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
        <AbsoluteFill style={{ backgroundColor: '#FFFFFF', opacity: flash }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            opacity: clamp01(chipP * 1.5) * out,
            transform: `scale(${(0.7 + 0.3 * chipP) * (1 + 0.05 * cutKick) * (0.88 + 0.12 * out)})`,
            backgroundColor: chipBg,
            color: '#FFFFFF',
            fontFamily: f.accent,
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: chipFs,
            lineHeight: 1.15,
            padding: `${6 * s}px ${30 * s}px ${12 * s}px`,
            borderRadius: 18 * s,
            boxShadow: `0 ${14 * s}px ${40 * s}px rgba(0,0,0,0.3)`,
            whiteSpace: 'nowrap',
          }}
        >
          {chipWord}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 6. Progress slider — "Barra de progresso"
// ---------------------------------------------------------------------------

type SliderProps = { label: string; from: number; to: number; max: number; unit: string; position: string };

const ProgressSlider: React.FC<EffectRenderProps<SliderProps>> = ({ props, frame, fps, durationInFrames, width, height, style, VideoCopy }) => {
  const s = fit(width, height);
  const f = fonts(style);
  const accent = style.colors.accent;
  const out = fadeOut(frame, durationInFrames, fps);
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 160 } });
  const from = num(props.from, 0);
  const to = num(props.to, 1);
  const maxV = Math.max(num(props.max, 0), from, to, 1e-6);
  const dec = decimalsOf(from, to);
  const g0 = 0.45 * fps;
  const g1 = g0 + Math.min(1.4 * fps, durationInFrames * 0.45);
  const dragEase = Easing.inOut(Easing.cubic);
  const valueAt = (fr: number) => from + (to - from) * ramp(fr, g0, g1, dragEase);
  const value = valueAt(frame);
  const frac = clamp01(value / maxV);
  const grab = ramp(frame, g0 - 0.15 * fps, g0 + 0.05 * fps) * (1 - ramp(frame, g1 - 0.05 * fps, g1 + 0.12 * fps));
  const release = interpolate(frame - g1, [0, 0.08 * fps, 0.4 * fps], [0, 1, 0], CLAMP);
  const pulseT = frame > g1 ? clamp01((frame - g1) / (0.7 * fps)) : 0;

  const cw = Math.min(width * 0.84, 880 * s);
  const ch = 250 * s;
  const x = (width - cw) / 2;
  const topF = props.position === 'middle' ? 0.42 : props.position === 'bottom' ? 0.58 : 0.15;
  const y = height * topF + (1 - enter) * 70 * s + (1 - out) * 20 * s;
  const padX = 46 * s;
  const trackW = cw - padX * 2;
  const trackY = 150 * s;
  const knob = 52 * s * (1 + 0.16 * grab);
  const unit = String(props.unit ?? '');

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: cw,
          height: ch,
          borderRadius: 40 * s,
          overflow: 'hidden',
          opacity: clamp01(enter * 1.5),
          border: `${1.5 * s}px solid rgba(255,255,255,0.4)`,
          boxSizing: 'border-box',
          boxShadow: `0 ${24 * s}px ${60 * s}px rgba(0,0,0,0.35)`,
        }}
      >
        <Frost VideoCopy={VideoCopy} x={x} y={y} width={width} height={height} blur={30 * s} tint="rgba(18,14,16,0.42)" />
        {/* header */}
        <div style={{ position: 'absolute', left: padX, right: padX, top: 26 * s, height: 86 * s, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontFamily: f.caption,
              fontSize: 27 * s,
              fontWeight: 700,
              letterSpacing: '0.22em',
              color: 'rgba(255,255,255,0.88)',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            {props.label}
          </span>
          <div style={{ display: 'flex', alignItems: 'flex-end', transform: `scale(${1 + 0.1 * release})`, transformOrigin: '100% 50%' }}>
            <Odometer value={value} prev={valueAt(frame - 1)} max={maxV} decimals={dec} size={78 * s} family={f.accent} color="#FFFFFF" weight={500} />
            {unit ? (
              <span style={{ fontFamily: f.accent, fontStyle: 'italic', fontSize: 50 * s, lineHeight: 1, color: accent, marginLeft: 10 * s, marginBottom: 14 * s, whiteSpace: 'nowrap' }}>{unit}</span>
            ) : null}
          </div>
        </div>
        {/* track */}
        <div style={{ position: 'absolute', left: padX, top: trackY - 10 * s, width: trackW, height: 20 * s, borderRadius: 20 * s, backgroundColor: 'rgba(255,255,255,0.16)' }} />
        <div
          style={{
            position: 'absolute',
            left: padX,
            top: trackY - 10 * s,
            width: Math.max(20 * s, trackW * frac),
            height: 20 * s,
            borderRadius: 20 * s,
            backgroundImage: `linear-gradient(to right, ${deepen(accent, 0.3)} 0%, ${accent} 100%)`,
            boxShadow: `0 0 ${20 * s}px ${rgba(accent, 0.55)}`,
          }}
        />
        {/* ticks + scale */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ position: 'absolute', left: padX + (trackW * i) / 5 - 1 * s, top: trackY + 22 * s, width: 2 * s, height: (i % 5 === 0 ? 14 : 9) * s, backgroundColor: 'rgba(255,255,255,0.4)' }} />
        ))}
        {[0, 1].map((i) => (
          <div
            key={`l${i}`}
            style={{
              position: 'absolute',
              top: trackY + 40 * s,
              left: i === 0 ? padX : undefined,
              right: i === 1 ? padX : undefined,
              fontFamily: f.caption,
              fontSize: 19 * s,
              fontWeight: 600,
              letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.6)',
              whiteSpace: 'nowrap',
            }}
          >
            {i === 0 ? '0' : `${fmt(maxV, decimalsOf(maxV))}${unit ? ` ${unit}` : ''}`}
          </div>
        ))}
        {/* knob */}
        {pulseT > 0 && pulseT < 1 ? (
          <div
            style={{
              position: 'absolute',
              left: padX + trackW * frac - (knob / 2) * (1 + pulseT),
              top: trackY - (knob / 2) * (1 + pulseT),
              width: knob * (1 + pulseT),
              height: knob * (1 + pulseT),
              borderRadius: 999,
              border: `${2.5 * s}px solid ${accent}`,
              boxSizing: 'border-box',
              opacity: 0.9 * (1 - pulseT),
            }}
          />
        ) : null}
        <div
          style={{
            position: 'absolute',
            left: padX + trackW * frac - knob / 2,
            top: trackY - knob / 2,
            width: knob,
            height: knob,
            borderRadius: 999,
            backgroundColor: '#FFFFFF',
            boxShadow: `0 ${6 * s}px ${18 * s}px rgba(0,0,0,0.35)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: knob * 0.32, height: knob * 0.32, borderRadius: 999, backgroundColor: deepen(accent, 0.35) }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 7. Stat card — "Card de resultado"
// ---------------------------------------------------------------------------

type StatProps = { title: string; number: number; delta: string; position: string };

const StatCard: React.FC<EffectRenderProps<StatProps>> = ({ props, frame, fps, durationInFrames, width, height, style, VideoCopy }) => {
  const s = fit(width, height);
  const id = useSvgId('sc');
  const f = fonts(style);
  const accent = style.colors.accent;
  const ink = inkOn(accent);
  const out = fadeOut(frame, durationInFrames, fps);
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 150 } });
  const total = num(props.number, 0);
  const c0 = 0.25 * fps;
  const c1 = c0 + Math.min(1.4 * fps, durationInFrames * 0.48);
  const countP = (fr: number) => ramp(fr, c0, c1, COUNT_EASE);
  const deltaP = spring({ frame: frame - (c1 - 0.1 * fps), fps, config: { damping: 10, stiffness: 210 } });
  const land = interpolate(frame - c1, [0, 0.07 * fps, 0.4 * fps], [0, 1, 0], CLAMP);

  const cw = Math.min(width * 0.62, 640 * s);
  const ch = 312 * s;
  const right = props.position === 'top-right';
  const center = props.position === 'center';
  const side = right ? 1 : -1;
  const baseX = center ? (width - cw) / 2 : right ? width - width * 0.07 - cw : width * 0.07;
  const x = baseX + (center ? 0 : side * (1 - enter) * 80 * s);
  const y = (center ? height * 0.38 : height * 0.13) + (center ? (1 - enter) * 60 * s : 0) - (1 - out) * 16 * s;
  const pad = 36 * s;

  // Mini sparkline (bottom-right), drawn while the number counts.
  const sw = 190 * s;
  const sh = 74 * s;
  const sparkPts = [0.1, 0.22, 0.16, 0.38, 0.33, 0.6, 0.92].map((v, i, a) => ({ x: 6 * s + ((sw - 12 * s) * i) / (a.length - 1), y: sh - 6 * s - v * (sh - 14 * s) }));
  const sd = smoothPath(sparkPts);
  const slen = React.useMemo(() => getLength(sd), [sd]);
  const sp = ramp(frame, c0, c1, Easing.inOut(Easing.cubic));
  const sHead = getPointAtLength(sd, Math.max(0.001, slen * sp)) ?? sparkPts[0];
  const lastSp = sparkPts[sparkPts.length - 1];

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: cw,
          height: ch,
          borderRadius: 36 * s,
          overflow: 'hidden',
          opacity: clamp01(enter * 1.5),
          border: `${1.5 * s}px solid rgba(255,255,255,0.42)`,
          boxSizing: 'border-box',
          boxShadow: `0 ${24 * s}px ${60 * s}px rgba(0,0,0,0.35)`,
        }}
      >
        <Frost VideoCopy={VideoCopy} x={x} y={y} width={width} height={height} blur={30 * s} tint="rgba(18,14,16,0.4)" />
        {/* title row */}
        <div style={{ position: 'absolute', left: pad, top: pad - 4 * s, display: 'flex', alignItems: 'center', gap: 16 * s }}>
          <div
            style={{
              width: 54 * s,
              height: 54 * s,
              borderRadius: 999,
              backgroundColor: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 ${22 * s}px ${rgba(accent, 0.55)}`,
              transform: `scale(${pop(frame, fps, 0.1)})`,
            }}
          >
            <TrendIcon size={30 * s} color={ink} stroke={2.8} />
          </div>
          <span style={{ fontFamily: f.caption, fontSize: 30 * s, fontWeight: 600, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap' }}>{props.title}</span>
        </div>
        {/* number */}
        <div style={{ position: 'absolute', left: pad - 4 * s, top: 98 * s, transform: `scale(${1 + 0.07 * land})`, transformOrigin: '0% 50%' }}>
          <Odometer value={total * countP(frame)} prev={total * countP(frame - 1)} max={total} decimals={0} size={112 * s} family={f.accent} color="#FFFFFF" weight={500} />
        </div>
        {/* delta chip */}
        {props.delta ? (
          <div
            style={{
              position: 'absolute',
              left: pad,
              bottom: pad - 4 * s,
              display: 'flex',
              alignItems: 'center',
              gap: 8 * s,
              padding: `${7 * s}px ${16 * s}px ${7 * s}px ${12 * s}px`,
              borderRadius: 999,
              backgroundColor: accent,
              boxShadow: `0 ${8 * s}px ${22 * s}px ${rgba(accent, 0.45)}`,
              opacity: clamp01(deltaP * 1.6),
              transform: `scale(${deltaP})`,
              transformOrigin: '0% 50%',
            }}
          >
            <TrendIcon size={24 * s} color={ink} stroke={3} />
            <span style={{ fontFamily: f.caption, fontSize: 27 * s, fontWeight: 800, color: ink, whiteSpace: 'nowrap' }}>{props.delta}</span>
          </div>
        ) : null}
        {/* sparkline */}
        <svg width={sw} height={sh} viewBox={`0 0 ${sw} ${sh}`} style={{ position: 'absolute', right: pad - 6 * s, bottom: pad - 6 * s }}>
          <defs>
            <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.45} />
              <stop offset="100%" stopColor={accent} stopOpacity={0} />
            </linearGradient>
            <clipPath id={`${id}c`}>
              <rect x={0} y={0} width={Math.max(0, sHead.x)} height={sh} />
            </clipPath>
          </defs>
          <path d={`${sd} L ${lastSp.x} ${sh} L ${sparkPts[0].x} ${sh} Z`} fill={`url(#${id}f)`} clipPath={`url(#${id}c)`} />
          <path d={sd} fill="none" stroke={accent} strokeWidth={4 * s} strokeLinecap="round" strokeDasharray={slen} strokeDashoffset={slen * (1 - sp)} />
          {sp > 0 ? <circle cx={sHead.x} cy={sHead.y} r={6 * s * (1 + 0.5 * land)} fill="#FFFFFF" /> : null}
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------

export const DATA_EFFECTS: EffectDef<any>[] = [
  {
    id: 'count-up',
    name: 'Número contando',
    term: 'count-up',
    category: 'data',
    description: 'Um número grande subindo até o valor final, com rótulo em cima e um soco de zoom quando ele para.',
    source: 'biblioteca',
    defaultDuration: 2.8,
    sfx: 'click',
    fields: [
      { key: 'from', label: 'De', type: 'number', default: 0, min: 0, max: 100000000, step: 1 },
      { key: 'to', label: 'Até', type: 'number', default: 250, min: 0, max: 100000000, step: 1 },
      { key: 'prefix', label: 'Antes do número', type: 'text', default: '+', placeholder: '+, R$, US$' },
      { key: 'suffix', label: 'Depois do número', type: 'text', default: 'mil', placeholder: 'K, %, mil' },
      { key: 'label', label: 'Rótulo', type: 'text', default: 'Visualizações em 30 dias' },
      { key: 'decimals', label: 'Casas decimais', type: 'number', default: 0, min: 0, max: 2, step: 1 },
      { key: 'position', label: 'Posição', type: 'select', default: 'top', options: POSITION_3 },
      { key: 'size', label: 'Tamanho', type: 'number', default: 220, min: 100, max: 340, step: 4 },
      {
        key: 'numFont',
        label: 'Fonte do número',
        type: 'select',
        default: 'accent',
        options: [
          { value: 'accent', label: 'Fonte de destaque' },
          { value: 'title', label: 'Fonte dos títulos' },
          { value: 'caption', label: 'Fonte das legendas' },
        ],
      },
      {
        key: 'colorMode',
        label: 'Cor do número',
        type: 'select',
        default: 'text',
        options: [
          { value: 'text', label: 'Cor do texto' },
          { value: 'accent', label: 'Cor de destaque' },
        ],
      },
    ],
    Overlay: CountUp,
  },
  {
    id: 'glass-graph',
    name: 'Gráfico de vidro',
    term: 'liquid glass graph',
    category: 'data',
    description: 'Card de vidro fosco sobre o vídeo: o número sobe enquanto a linha do gráfico se desenha, com brilho e ponto pulsando no fim.',
    source: 'yanny',
    defaultDuration: 3.8,
    sfx: 'shimmer',
    fields: [
      { key: 'label', label: 'Rótulo', type: 'text', default: 'Visualizações · 7 dias' },
      { key: 'number', label: 'Número', type: 'number', default: 186420, min: 0, max: 100000000, step: 1 },
      { key: 'startLabel', label: 'Data inicial', type: 'text', default: '1 nov' },
      { key: 'endLabel', label: 'Data final', type: 'text', default: '7 nov' },
      { key: 'values', label: 'Valores da linha', type: 'text', default: '12, 18, 21, 34, 47, 58, 63', placeholder: 'separados por vírgula' },
      { key: 'blurBg', label: 'Desfocar o vídeo atrás', type: 'toggle', default: true },
    ],
    Overlay: GlassGraph,
    videoStyle: glassGraphVideoStyle,
  },
  {
    id: 'chart-grow',
    name: 'Barras crescendo',
    term: 'chart grow · bar grow',
    category: 'data',
    description: 'Barras na cor de destaque sobem em cascata no alto do vídeo, com os valores pulando em cima e um selo de crescimento.',
    source: 'yanny',
    defaultDuration: 3.2,
    sfx: 'pop',
    fields: [
      { key: 'values', label: 'Valores', type: 'text', default: '18, 26, 24, 41, 57, 82', placeholder: 'separados por vírgula' },
      { key: 'labels', label: 'Rótulos', type: 'text', default: 'jan, fev, mar, abr, mai, jun', placeholder: 'separados por vírgula' },
      { key: 'suffix', label: 'Depois do valor', type: 'text', default: 'k', placeholder: 'k, %, mil' },
      { key: 'tag', label: 'Selo', type: 'text', default: 'Cresceu' },
    ],
    Overlay: ChartGrow,
  },
  {
    id: 'slot-machine',
    name: 'Caça-níquel',
    term: 'slot machine',
    category: 'data',
    description: 'Dois cards brancos giram palavras como um caça-níquel e param, um depois do outro, na combinação final, que pisca e cresce.',
    source: 'yanny',
    defaultDuration: 3.2,
    sfx: 'click',
    fields: [
      { key: 'labelA', label: 'Rótulo 1', type: 'text', default: 'Look' },
      { key: 'wordsA', label: 'Palavras 1 (a última fica)', type: 'text', default: 'Retrô, Neon, Clean, Vintage, Papel' },
      { key: 'labelB', label: 'Rótulo 2', type: 'text', default: 'Som' },
      { key: 'wordsB', label: 'Palavras 2 (a última fica)', type: 'text', default: 'Pop, Clique, Whoosh, Swish, Brilho' },
      {
        key: 'position',
        label: 'Posição',
        type: 'select',
        default: 'bottom',
        options: POSITION_3,
      },
    ],
    Overlay: SlotMachine,
  },
  {
    id: 'match-cut',
    name: 'Match cut',
    term: 'match cut',
    category: 'data',
    description: 'Uma página de texto desfocado toma a tela e só a palavra-chave fica nítida num destaque. A palavra fica, o mundo muda em volta dela.',
    source: 'yanny',
    defaultDuration: 3,
    sfx: 'swish',
    fields: [
      { key: 'word', label: 'Palavra em destaque', type: 'text', default: '', placeholder: 'vazio = a palavra falada' },
      {
        key: 'text',
        label: 'Texto de fundo',
        type: 'textarea',
        default:
          'eu passava a noite inteira cortando pausas de um único take e perdendo cada momento bom no meio do caminho. hoje eu escolho o estilo, marco as palavras e o vídeo sai pronto, com legenda, títulos e sons do meu jeito.',
      },
      {
        key: 'text2',
        label: 'Texto depois da troca',
        type: 'textarea',
        default:
          'antes eram horas de edição para um reel de trinta segundos. agora são cinco minutos: uma palavra, um efeito, e o resto acontece enquanto eu gravo o próximo.',
      },
      {
        key: 'mode',
        label: 'Ritmo',
        type: 'select',
        default: 'swap',
        options: [
          { value: 'swap', label: 'Calmo · uma troca no meio' },
          { value: 'cuts', label: 'Rápido · vários cortes' },
        ],
      },
    ],
    Overlay: MatchCut,
  },
  {
    id: 'progress-slider',
    name: 'Barra de progresso',
    term: 'progress slider',
    category: 'data',
    description: 'Um controle deslizante de vidro: o botão corre pela trilha e o valor vai contando até o número final.',
    source: 'essence',
    defaultDuration: 3,
    sfx: 'swish',
    fields: [
      { key: 'label', label: 'Rótulo', type: 'text', default: '1 reel' },
      { key: 'from', label: 'De', type: 'number', default: 1.2, min: 0, max: 100000, step: 0.1 },
      { key: 'to', label: 'Até', type: 'number', default: 3.8, min: 0, max: 100000, step: 0.1 },
      { key: 'max', label: 'Fim da trilha', type: 'number', default: 5, min: 0, max: 100000, step: 0.1 },
      { key: 'unit', label: 'Unidade', type: 'text', default: 'h', placeholder: 'h, %, min' },
      { key: 'position', label: 'Posição', type: 'select', default: 'top', options: POSITION_3 },
    ],
    Overlay: ProgressSlider,
  },
  {
    id: 'stat-card',
    name: 'Card de resultado',
    term: 'stat card',
    category: 'data',
    description: 'Card de vidro pequeno com ícone, título, número contando e um selo de variação (+%) que salta no fim.',
    source: 'essence',
    defaultDuration: 3,
    sfx: 'pop',
    fields: [
      { key: 'title', label: 'Título', type: 'text', default: 'Visualizações' },
      { key: 'number', label: 'Número', type: 'number', default: 48210, min: 0, max: 100000000, step: 1 },
      { key: 'delta', label: 'Variação', type: 'text', default: '+38%' },
      {
        key: 'position',
        label: 'Posição',
        type: 'select',
        default: 'top-left',
        options: [
          { value: 'top-left', label: 'Em cima, à esquerda' },
          { value: 'top-right', label: 'Em cima, à direita' },
          { value: 'center', label: 'No centro' },
        ],
      },
    ],
    Overlay: StatCard,
  },
];
