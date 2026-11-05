import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring } from 'remotion';
import { fontFamily } from '../../core/fonts';
import type { Style } from '../../core/types';
import type { EffectDef, EffectRenderProps } from '../types';
import { fadeOut, px, rand } from '../util';

// ---------------------------------------------------------------------------
// Camera & transitions: effects that move / regrade the footage itself.
// They mostly drive `videoStyle` (transform/filter on the main video) and a
// `Backdrop` built from `VideoCopy` (grids, ghosts, carousels behind the video).
// Timings follow the motion library (punch zoom 0.15 s, wipe power4.inOut…).
// ---------------------------------------------------------------------------

type FX<P> = EffectRenderProps<P>;
const def = <P,>(d: EffectDef<P>): EffectDef<any> => d as EffectDef<any>;

const EO = Easing.out(Easing.cubic);
const EI = Easing.in(Easing.cubic);
const EIO = Easing.inOut(Easing.cubic);
const P4 = Easing.inOut(Easing.poly(4)); // power4.inOut

/** 0 → 1 between frames a and b (clamped, optional easing). Safe when b <= a. */
const ramp = (f: number, a: number, b: number, easing?: (t: number) => number) => {
  if (b <= a) return f >= a ? 1 : 0;
  return interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });
};
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Text scale that also respects short frames (1:1, 16:9): same as px() on 9:16. */
const textScale = (width: number, height: number) => Math.min(px(width), height / 1300);

/** Measures text with a canvas so big display words can be fitted to the frame. */
let measureCtx: CanvasRenderingContext2D | null | undefined;
const measureWidth = (text: string, family: string, weight: number, letterSpacingEm = 0) => {
  if (measureCtx === undefined) measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  const base = 100;
  if (!measureCtx) return text.length * base * 0.66;
  measureCtx.font = `${weight} ${base}px ${family}`;
  return measureCtx.measureText(text).width + letterSpacingEm * base * Math.max(0, Array.from(text).length - 1);
};
/** Font size that makes `text` exactly `maxWidth` wide (capped). */
const fitSize = (text: string, family: string, weight: number, maxWidth: number, cap: number, letterSpacingEm = 0) =>
  Math.min(cap, (maxWidth / Math.max(1, measureWidth(text, family, weight, letterSpacingEm))) * 100);

const luminance = (hex: string) => {
  const m = hex.trim().replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return 0.5;
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};
/** Readable ink (near-black or white) on top of a color. */
const inkOn = (hex: string) => (luminance(hex) > 0.6 ? '#17110E' : '#FFFFFF');

const colorFromMode = (mode: string, style: Style) =>
  mode === 'secondary'
    ? style.colors.secondary
    : mode === 'background'
      ? style.colors.background
      : mode === 'text'
        ? style.colors.text
        : mode === 'white'
          ? '#FFFFFF'
          : mode === 'black'
            ? '#121010'
            : style.colors.accent;

const FONT_OPTIONS = [
  { value: 'title', label: 'Fonte dos títulos' },
  { value: 'caption', label: 'Fonte das legendas' },
  { value: 'accent', label: 'Fonte de destaque' },
];
const fontKey = (mode: string, style: Style) => (mode === 'caption' ? style.captionFont : mode === 'accent' ? style.accentFont : style.titleFont);

// Film grain frames (feTurbulence in an SVG data URI works in the MP4 export).
const NOISES = [3, 11, 23, 37].map(
  (seed) =>
    `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='534'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.05' numOctaves='2' seed='${seed}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 1.5 -0.42'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
    )}`,
);

// ===========================================================================
// 1. Punch zoom — "Zoom de impacto"
// 100% → 115% in 0.15 s with a tiny overshoot that settles by ~0.3 s.
// ===========================================================================

type PunchProps = { intensity: number; focus: string };
const FOCUS: Record<string, string> = { face: '50% 36%', center: '50% 50%', low: '50% 64%' };
const punchCurve = (frame: number, fps: number) => (frame <= 0 ? 0 : spring({ frame, fps, config: { damping: 12, stiffness: 320, mass: 0.55 } }));

const punchVideo = ({ props, frame, fps, durationInFrames, width }: FX<PunchProps>): React.CSSProperties => {
  const amt = props.intensity / 100;
  const p = punchCurve(frame, fps);
  const back = 1 - ramp(frame, durationInFrames - 0.3 * fps, durationInFrames - 1, EIO);
  const velocity = Math.max(0, p - punchCurve(frame - 1, fps));
  const blur = velocity * amt * 42 * px(width);
  return {
    transform: `scale(${1 + amt * p * back})`,
    transformOrigin: FOCUS[props.focus] ?? FOCUS.face,
    filter: `${blur > 0.05 ? `blur(${blur.toFixed(2)}px) ` : ''}contrast(${1 + 0.05 * p * back})`,
  };
};

// ===========================================================================
// 2. Digital zoom — "Zoom digital P&B" (ref3 #13)
// Snaps to contrasty black & white, a quick digital step-in, then a slow creep
// toward the face. Optional film grain + exposure flicker.
// ===========================================================================

type DigitalProps = { zoom: number; bw: boolean; grain: boolean };
const digitalOn = (frame: number, fps: number, dur: number) => ramp(frame, 0, 0.1 * fps) * (1 - ramp(frame, dur - 0.3 * fps, dur - 1, EIO));

const digitalVideo = ({ props, frame, fps, durationInFrames }: FX<DigitalProps>): React.CSSProperties => {
  const on = digitalOn(frame, fps, durationInFrames);
  const step = ramp(frame, 0, 0.2 * fps, EO);
  const creep = ramp(frame, 0.1 * fps, durationInFrames, Easing.inOut(Easing.sin));
  const back = 1 - ramp(frame, durationInFrames - 0.3 * fps, durationInFrames - 1, EIO);
  const z = (props.zoom / 100) * (0.4 * step + 0.6 * creep) * back;
  const flick = props.grain ? (rand(Math.floor(frame / 2) + 7) - 0.5) * 0.08 * on : 0;
  const filter = props.bw
    ? `grayscale(${on}) contrast(${1 + 0.34 * on}) brightness(${1 + 0.03 * on + flick})`
    : `contrast(${1 + 0.16 * on}) saturate(${1 + 0.12 * on}) brightness(${1 + flick})`;
  return { transform: `scale(${1 + z})`, transformOrigin: '50% 34%', filter };
};

const DigitalOverlay: React.FC<FX<DigitalProps>> = ({ props, frame, fps, durationInFrames }) => {
  if (!props.grain) return null;
  const on = digitalOn(frame, fps, durationInFrames);
  const seed = Math.floor(frame / 2) % NOISES.length;
  return (
    <AbsoluteFill style={{ opacity: on, pointerEvents: 'none' }}>
      <AbsoluteFill style={{ opacity: 0.5, mixBlendMode: 'overlay' }}>
        <Img src={NOISES[seed]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{ backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 80%, rgba(0,0,0,0.3) 100%)' }}
      />
    </AbsoluteFill>
  );
};

// ===========================================================================
// 3. Vertigo (ref2 #10)
// Dolly-zoom echo: larger ghost copies of the footage grow behind while the
// main video turns semi-transparent and counter-zooms — the person appears twice.
// ===========================================================================

type VertigoProps = { intensity: number; echoes: number };
const vertigoEnv = (frame: number, fps: number, dur: number) => ramp(frame, 0, 0.3 * fps, EO) * (1 - ramp(frame, dur - 0.35 * fps, dur - 1, EIO));
const vertigoGrow = (frame: number, dur: number) => ramp(frame, 0, dur, Easing.out(Easing.quad));

const VertigoBackdrop: React.FC<FX<VertigoProps>> = ({ props, frame, durationInFrames, width, VideoCopy }) => {
  const s = px(width);
  const I = clamp(props.intensity, 0.2, 2);
  const n = clamp(Math.round(props.echoes), 1, 3);
  const grow = vertigoGrow(frame, durationInFrames);
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {Array.from({ length: n }, (_, j) => {
        const k = (n - j) / n; // biggest copy at the bottom of the stack
        const target = 0.4 * I * k;
        const sc = 1 + target * (0.3 + 0.7 * grow);
        return (
          <VideoCopy
            key={j}
            style={{
              transform: `translate(${-2.2 * I * k}%, ${-1.5 * I * k}%) scale(${sc})`,
              transformOrigin: '50% 82%',
              opacity: j === 0 ? 1 : 0.55,
              filter: `brightness(1.06) saturate(0.82) blur(${(1.4 * s * k).toFixed(2)}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const vertigoVideo = ({ props, frame, fps, durationInFrames }: FX<VertigoProps>): React.CSSProperties => {
  const I = clamp(props.intensity, 0.2, 2);
  const env = vertigoEnv(frame, fps, durationInFrames);
  const grow = vertigoGrow(frame, durationInFrames);
  return {
    opacity: 1 - clamp(0.4 * I, 0.12, 0.6) * env,
    transform: `scale(${1 - 0.07 * I * grow * env})`,
    transformOrigin: '50% 45%',
  };
};

// ===========================================================================
// 4. Pull-back reveal — "Grade de clipes" (ref2 #11)
// The camera pulls back: the video becomes the center cell of a 3x3 grid of
// clips on a light background, then pushes back in.
// ===========================================================================

type GridProps = { background: string; variety: boolean };
const GRID_K = 0.3; // cell size relative to the frame
const GRID_GAP = (1 - 3 * GRID_K) / 4;
const GRID_CELLS: Array<[number, number]> = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];
// Same footage, but cropped / mirrored / graded differently so it reads as a wall of clips.
const GRID_VARIANTS: React.CSSProperties[] = [
  { filter: 'grayscale(1) contrast(1.12)', transform: 'scale(1.35)', transformOrigin: '50% 30%' },
  { filter: 'saturate(1.15) brightness(1.04)', transform: 'scaleX(-1)' },
  { filter: 'sepia(0.45) saturate(1.1)', transform: 'scale(1.7)', transformOrigin: '50% 28%' },
  { filter: 'brightness(1.05)', transform: 'scaleX(-1) scale(1.25)', transformOrigin: '50% 62%' },
  { filter: 'grayscale(1) brightness(1.08)', transform: 'scaleX(-1) scale(1.5)', transformOrigin: '50% 32%' },
  { filter: 'hue-rotate(-10deg) saturate(1.25)', transform: 'scale(1.15)', transformOrigin: '50% 70%' },
  { filter: 'contrast(1.1) saturate(0.85)', transform: 'scale(1.9)', transformOrigin: '45% 30%' },
  { filter: 'sepia(0.22) brightness(1.06)', transform: 'scaleX(-1)' },
];

/** 0 = full frame, 1 = pulled back to the grid. */
const gridZ = (frame: number, fps: number, dur: number) => {
  const inP = ramp(frame, 0, Math.min(0.85 * fps, dur * 0.4), EIO);
  const outP = ramp(frame, dur - Math.min(0.75 * fps, dur * 0.35), dur - 1, EIO);
  return Math.max(0, inP - outP);
};

const PullBackBackdrop: React.FC<FX<GridProps>> = ({ props, frame, fps, durationInFrames, width, VideoCopy }) => {
  const s = px(width);
  const z = gridZ(frame, fps, durationInFrames);
  const S = Math.pow(GRID_K, z - 1); // grid scale: 1/K (center cell fills the frame) → 1
  const step = GRID_K + GRID_GAP;
  return (
    <AbsoluteFill style={{ backgroundColor: props.background }}>
      <AbsoluteFill style={{ transform: `scale(${S})` }}>
        {GRID_CELLS.map(([cx, cy], i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${(0.5 + cx * step - GRID_K / 2) * 100}%`,
              top: `${(0.5 + cy * step - GRID_K / 2) * 100}%`,
              width: `${GRID_K * 100}%`,
              height: `${GRID_K * 100}%`,
              borderRadius: 22 * s * z,
              overflow: 'hidden',
              backgroundColor: '#d9d3cb',
              boxShadow: `0 ${10 * s}px ${30 * s}px rgba(40,30,20,0.16)`,
            }}
          >
            <VideoCopy style={props.variety ? GRID_VARIANTS[i] : undefined} />
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const pullBackVideo = ({ frame, fps, durationInFrames, width }: FX<GridProps>): React.CSSProperties => {
  const s = px(width);
  const z = gridZ(frame, fps, durationInFrames);
  const sc = Math.pow(GRID_K, z);
  return {
    transform: `scale(${sc})`,
    borderRadius: (22 * s * z) / GRID_K,
    overflow: 'hidden',
    boxShadow: z > 0.01 ? `0 ${(12 * s * z) / GRID_K}px ${(34 * s * z) / GRID_K}px rgba(40,30,20,${0.22 * z})` : undefined,
  };
};

// ===========================================================================
// 5. Zoom-through cut — "Zoom através" (ref3 #17)
// Accelerating zoom into the face with motion blur, a flash at the peak,
// then the shot lands from zoomed-in back to normal.
// ===========================================================================

type ZoomThroughProps = { intensity: number; flash: boolean; color: string };
const ZT_CUT = 0.28; // seconds after the word

const zoomThroughVideo = ({ props, frame, fps, durationInFrames, width }: FX<ZoomThroughProps>): React.CSSProperties => {
  const s = px(width);
  const I = clamp(props.intensity, 0.3, 2.5);
  const cut = Math.min(ZT_CUT * fps, durationInFrames * 0.4);
  if (frame < cut) {
    const a = ramp(frame, 0, cut, EI);
    return {
      transform: `scale(${1 + 2.2 * I * a}) rotate(${3 * I * a}deg)`,
      transformOrigin: '50% 40%',
      filter: `blur(${(18 * s * I * a).toFixed(2)}px) brightness(${1 + 0.5 * a})`,
    };
  }
  const r = 1 - ramp(frame, cut, Math.min(durationInFrames - 1, cut + 0.5 * fps), EO);
  return {
    transform: `scale(${1 + 0.9 * I * r}) rotate(${-2.5 * I * r}deg)`,
    transformOrigin: '50% 40%',
    filter: `blur(${(14 * s * I * r).toFixed(2)}px) brightness(${1 + 0.45 * r})`,
  };
};

const ZoomThroughOverlay: React.FC<FX<ZoomThroughProps>> = ({ props, frame, fps, durationInFrames }) => {
  if (!props.flash) return null;
  const cut = Math.min(ZT_CUT * fps, durationInFrames * 0.4);
  const up = ramp(frame, cut - 0.1 * fps, cut, EI);
  const down = 1 - ramp(frame, cut, cut + 0.3 * fps, EO);
  return <AbsoluteFill style={{ backgroundColor: props.color, opacity: Math.min(up, down) * 0.85, pointerEvents: 'none' }} />;
};

// ===========================================================================
// 6. Wipe — "Cortina"
// Two-tone block sweeping across the frame (power4.inOut). A thin lead band
// enters first and trails on the way out; an optional label rides the block.
// ===========================================================================

type WipeProps = { label: string; direction: string; colorMode: string; size: number };
const WIPE_SKEW = 10; // degrees

const Wipe: React.FC<FX<WipeProps>> = ({ props, frame, fps, durationInFrames, width, height, style }) => {
  const ts = textScale(width, height);
  const vertical = props.direction === 'up';
  const sign = props.direction === 'left' ? -1 : 1;
  const main = colorFromMode(props.colorMode, style);
  const lead = props.colorMode === 'accent' ? style.colors.text : style.colors.accent;
  const half = Math.min(0.42 * fps, durationInFrames * 0.42);
  const lag = Math.min(0.07 * fps, durationInFrames * 0.08);
  // -1 = off before, 0 = covering, +1 = off after.
  const pos = (enterDelay: number, exitEnd: number) =>
    -1 + ramp(frame, enterDelay, enterDelay + half, P4) + ramp(frame, exitEnd - half, exitEnd, P4);
  const tan = Math.tan((WIPE_SKEW * Math.PI) / 180);
  // Block size along the travel axis, with room for the slanted edges.
  const along = vertical ? height + width * tan + 0.04 * height : width + height * tan + 0.04 * width;
  const travel = along + 0.02 * (vertical ? height : width);
  const blockStyle = (p: number, color: string, z: number): React.CSSProperties => ({
    position: 'absolute',
    left: vertical ? '-5%' : (width - along) / 2,
    top: vertical ? (height - along) / 2 : '-5%',
    width: vertical ? '110%' : along,
    height: vertical ? along : '110%',
    backgroundColor: color,
    zIndex: z,
    transform: vertical ? `translateY(${-p * travel}px) skewY(${-WIPE_SKEW}deg)` : `translateX(${sign * p * travel}px) skewX(${-sign * WIPE_SKEW}deg)`,
  });
  const pLead = pos(0, durationInFrames - 1);
  const pMain = pos(lag, durationInFrames - 1 - lag);
  const label = props.label.trim();
  const fam = fontFamily(style.titleFont);
  const size = label ? fitSize(label, fam, 700, width * 0.84, props.size * ts) : 0;
  const ink = inkOn(main);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={blockStyle(pLead, lead, 1)} />
      <div style={{ ...blockStyle(pMain, main, 2), boxShadow: `0 0 ${40 * ts}px rgba(0,0,0,0.25)` }} />
      {label ? (
        <AbsoluteFill
          style={{
            zIndex: 3,
            alignItems: 'center',
            justifyContent: 'center',
            transform: vertical ? `translateY(${-pMain * travel}px)` : `translateX(${sign * pMain * travel * 0.92}px)`,
          }}
        >
          <div style={{ fontFamily: fam, fontWeight: 700, fontSize: size, lineHeight: 1, color: ink, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{label}</div>
          <div style={{ marginTop: 18 * ts, width: 90 * ts, height: 5 * ts, borderRadius: 3 * ts, backgroundColor: ink, opacity: 0.55 }} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

// ===========================================================================
// 7. Flash
// A camera-flash burst: white frame that decays fast + a short exposure bump.
// ===========================================================================

type FlashProps = { color: string; intensity: number };
const flashDecay = (frame: number, fps: number, tau: number) => ramp(frame, 0, 2) * Math.exp(-Math.max(0, frame - 2) / (tau * fps));

const FlashOverlay: React.FC<FX<FlashProps>> = ({ props, frame, fps, durationInFrames }) => {
  const o = clamp(props.intensity, 0, 1) * flashDecay(frame, fps, 0.11) * fadeOut(frame, durationInFrames, fps, 0.15);
  return <AbsoluteFill style={{ backgroundColor: props.color, opacity: o, pointerEvents: 'none' }} />;
};

const flashVideo = ({ props, frame, fps, durationInFrames }: FX<FlashProps>): React.CSSProperties => {
  const I = clamp(props.intensity, 0, 1);
  const e = I * flashDecay(frame, fps, 0.2) * (1 - ramp(frame, durationInFrames - 0.15 * fps, durationInFrames - 1));
  return {
    transform: `scale(${1 + 0.025 * e})`,
    filter: `brightness(${1 + 0.5 * e}) contrast(${1 - 0.1 * e}) saturate(${1 - 0.25 * e})`,
  };
};

// ===========================================================================
// 8. Reels 3D carousel — "Carrossel 3D" (ref4)
// The video shrinks into a card, 4 more cards fan out and the ring spins on its
// own (fake 3D: translate + scaleX + skewY + depth scale + zIndex). While it
// spins, the main video hides and the ring (all VideoCopy) carries the shot;
// it lands on a card that matches the video exactly and zooms back in.
// ===========================================================================

type CarouselProps = { speed: number; labels: string; showLabels: boolean };
const CAR_K = 0.5; // front card size relative to the frame
const CAR_SLOTS = [-2, -1, 0, 1, 2];

const carouselTiming = (fps: number, dur: number) => {
  const intro = Math.min(0.7 * fps, dur * 0.2);
  const outro = Math.min(0.7 * fps, dur * 0.2);
  const spin0 = intro + Math.min(0.2 * fps, dur * 0.05);
  const spin1 = Math.max(spin0 + 1, dur - outro - Math.min(0.3 * fps, dur * 0.08));
  return { intro, outro, spin0, spin1, hide0: intro + 1, hide1: spin1 + 1 };
};
/** Main card scale: 1 → K (intro), K (spin), K → 1 (outro). */
const carouselMain = (frame: number, fps: number, dur: number) => {
  const t = carouselTiming(fps, dur);
  const inP = ramp(frame, 0, t.intro, EIO);
  const outP = ramp(frame, dur - t.outro, dur - 1, EIO);
  return 1 + (CAR_K - 1) * Math.max(0, inP - outP);
};
const wrapDeg = (d: number) => {
  const x = (((d + 180) % 360) + 360) % 360;
  return x - 180;
};

const CarouselBackdrop: React.FC<FX<CarouselProps>> = ({ props, frame, fps, durationInFrames, width, style, VideoCopy }) => {
  const s = px(width);
  const t = carouselTiming(fps, durationInFrames);
  const m = carouselMain(frame, fps, durationInFrames);
  const g = m / CAR_K; // ring scale (front card == main video)
  const cardness = (1 - m) / (1 - CAR_K);
  const spread = Math.min(ramp(frame, 0.1 * fps, t.intro + 0.3 * fps, EO), 1 - ramp(frame, durationInFrames - t.outro, durationInFrames - 1, EIO));
  const steps = Math.max(1, Math.round((clamp(props.speed, 0.1, 5) * (t.spin1 - t.spin0)) / fps));
  const phi = -steps * 72 * ramp(frame, t.spin0, t.spin1, Easing.inOut(Easing.quad));
  const labelsOn = props.showLabels ? ramp(frame, t.hide0, t.hide0 + 0.3 * fps, EO) * (1 - ramp(frame, t.spin1 - 0.3 * fps, t.spin1)) : 0;
  const lines = props.labels.split('\n').map((l) => l.trim());
  const radiusVis = 30 * s * cardness;
  const borderVis = 7 * s * cardness;
  const fam = fontFamily(style.titleFont);
  return (
    <AbsoluteFill style={{ backgroundImage: 'linear-gradient(175deg, #FBF6EF 0%, #F3E8DF 55%, #EADBD1 100%)' }}>
      <div
        style={{
          position: 'absolute',
          left: '10%',
          top: '22%',
          width: '80%',
          height: '45%',
          borderRadius: '50%',
          backgroundColor: style.colors.accent,
          opacity: 0.22,
          filter: `blur(${90 * s}px)`,
        }}
      />
      <AbsoluteFill style={{ transform: `scale(${g})` }}>
        {/* Floor shadow under the ring. */}
        <div
          style={{
            position: 'absolute',
            left: '18%',
            width: '64%',
            top: `${50 + CAR_K * 50 + 1}%`,
            height: '5%',
            borderRadius: '50%',
            backgroundColor: 'rgba(70,45,35,0.32)',
            filter: `blur(${22 * s}px)`,
            opacity: spread,
          }}
        />
        {CAR_SLOTS.map((slot) => {
          const theta = wrapDeg(slot * 72 + phi) * spread;
          const rad = (theta * Math.PI) / 180;
          const cz = Math.cos(rad);
          const yaw = rad / 2;
          const scaleX = Math.max(0.001, Math.cos(yaw));
          const depth = 0.6 + 0.4 * ((1 + cz) / 2);
          const shade = 0.55 * (1 - (1 + cz) / 2);
          const label = lines[((slot % 5) + 5) % 5] ?? '';
          // Scale-independent visual radius / border.
          const r = radiusVis / g;
          const b = borderVis / g;
          return (
            <div
              key={slot}
              style={{
                position: 'absolute',
                left: `${50 + 40 * Math.sin(rad)}%`,
                top: `${50 - 4 * (1 - cz)}%`,
                width: `${CAR_K * 100}%`,
                height: `${CAR_K * 100}%`,
                zIndex: Math.round((cz + 1) * 100),
                transform: `translate(-50%, -50%) scale(${depth}) skewY(${-Math.sin(yaw) * 9}deg) scaleX(${scaleX})`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: -b,
                  top: -b,
                  right: -b,
                  bottom: -b,
                  borderRadius: r + b,
                  backgroundColor: '#FFFFFF',
                  boxShadow: `0 ${18 * s}px ${44 * s}px rgba(60,35,30,${0.28 * cardness})`,
                }}
              />
              <div style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: r, overflow: 'hidden', backgroundColor: '#cfc6bd' }}>
                <VideoCopy />
                <AbsoluteFill
                  style={{
                    backgroundImage: `linear-gradient(${Math.sin(rad) >= 0 ? 90 : 270}deg, rgba(20,12,10,${shade * 0.4}) 0%, rgba(20,12,10,${shade}) 100%)`,
                  }}
                />
                {label && labelsOn > 0.001 ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: '8%',
                      right: '8%',
                      top: '12%',
                      textAlign: 'center',
                      opacity: labelsOn,
                      transform: `translateY(${(1 - labelsOn) * 16 * s}px)`,
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-block',
                        padding: `${5 * s}px ${14 * s}px`,
                        borderRadius: 40 * s,
                        backgroundColor: style.colors.accent,
                        color: inkOn(style.colors.accent),
                        fontFamily: fontFamily(style.captionFont),
                        fontSize: 17 * s,
                        fontWeight: 700,
                        letterSpacing: '0.16em',
                      }}
                    >
                      REEL 0{((slot % 5) + 5) % 5 + 1}
                    </div>
                    <div
                      style={{
                        marginTop: 12 * s,
                        fontFamily: fam,
                        fontSize: 54 * s,
                        fontWeight: 700,
                        lineHeight: 1.02,
                        color: '#FFFFFF',
                        textShadow: `0 ${3 * s}px ${18 * s}px rgba(0,0,0,0.55)`,
                      }}
                    >
                      {label}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const carouselVideo = ({ frame, fps, durationInFrames, width }: FX<CarouselProps>): React.CSSProperties => {
  const t = carouselTiming(fps, durationInFrames);
  const m = carouselMain(frame, fps, durationInFrames);
  const cardness = (1 - m) / (1 - CAR_K);
  const hidden = frame >= t.hide0 && frame < t.hide1;
  return {
    transform: `scale(${m})`,
    borderRadius: (30 * px(width) * cardness) / m,
    overflow: 'hidden',
    opacity: hidden ? 0 : 1,
  };
};

// ===========================================================================
// 9. Glass type — "Letreiro de vidro" (ref1 #02)
// A giant word in frosted glass (translucent fill, light stroke, glow, a top
// reflection and a sheen sweep) blurs in over the upper third.
// ===========================================================================

type GlassProps = { text: string; size: number; font: string; position: string };

const GlassType: React.FC<FX<GlassProps>> = ({ props, frame, fps, durationInFrames, width, height, style, word }) => {
  const s = px(width);
  const text = (props.text.trim() || word || 'ESSÊNCIA').toUpperCase();
  const fam = fontFamily(fontKey(props.font, style));
  const weight = 800;
  const tracking = 0.02;
  const size = fitSize(text, fam, weight, width * 0.86, Math.min(props.size * s, height * 0.24), tracking);
  const enter = ramp(frame, 0, 0.8 * fps, EO);
  const out = fadeOut(frame, durationInFrames, fps, 0.35);
  const drift = ramp(frame, 0, durationInFrames, Easing.inOut(Easing.sin));
  const scale = 1.1 - 0.1 * enter + 0.04 * drift + 0.04 * (1 - out);
  const blur = (1 - enter) * 16 * s + (1 - out) * 10 * s;
  const sheen = ramp(frame, 0.55 * fps, 1.5 * fps, Easing.inOut(Easing.quad));
  const centerY = props.position === 'middle' ? 0.42 : props.position === 'bottom' ? 0.6 : 0.22;
  const textStyle: React.CSSProperties = {
    fontFamily: fam,
    fontWeight: weight,
    fontSize: size,
    lineHeight: 1,
    letterSpacing: `${tracking}em`,
    whiteSpace: 'nowrap',
  };
  const stroke = `${Math.max(1.5, 2.4 * s)}px rgba(255,255,255,0.9)`;
  const tw = (measureWidth(text, fam, weight, tracking) / 100) * size;
  const bandW = Math.max(tw * 0.18, 60 * s);
  const bandLeft = -bandW + sheen * (tw + bandW);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: enter * out }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: height * centerY - size / 2,
          display: 'flex',
          justifyContent: 'center',
          transform: `scale(${scale})`,
          filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
        }}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {/* Body: translucent fill, bright rim, soft glow. */}
          <div
            style={{
              ...textStyle,
              color: 'rgba(255,255,255,0.3)',
              WebkitTextStroke: stroke,
              textShadow: `0 0 ${28 * s}px rgba(255,255,255,0.45), 0 ${8 * s}px ${36 * s}px rgba(0,0,0,0.14)`,
            }}
          >
            {text}
          </div>
          {/* Top reflection: the upper half of the letters is a bit brighter. */}
          <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: '47%', overflow: 'hidden' }}>
            <div style={{ ...textStyle, color: 'rgba(255,255,255,0.2)' }}>{text}</div>
          </div>
          {/* Sheen sweep. */}
          {sheen > 0 && sheen < 1 ? (
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: bandLeft, width: bandW, overflow: 'hidden' }}>
              <div style={{ ...textStyle, position: 'absolute', left: -bandLeft, top: 0, color: 'rgba(255,255,255,0.55)', textShadow: `0 0 ${20 * s}px rgba(255,255,255,0.8)` }}>
                {text}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===========================================================================
// 10. Cover story — "Capa de revista" (ref3 #14)
// Magazine cover overlay: huge serif masthead revealed letter by letter, an
// issue line with rules, and two cover lines on the lower left.
// ===========================================================================

type CoverProps = { masthead: string; issue: string; line1: string; line2: string; colorMode: string };

const CoverLine: React.FC<{ text: string; index: number; p: number; ts: number; style: Style; color: string }> = ({ text, index, p, ts, style, color }) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const [first, ...rest] = words;
  return (
    <div style={{ opacity: clamp(p * 1.3, 0, 1), transform: `translateX(${(1 - p) * -50 * ts}px)`, marginTop: index === 0 ? 0 : 30 * ts }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 * ts, marginBottom: 8 * ts }}>
        <div style={{ width: 44 * ts * p, height: 4 * ts, backgroundColor: style.colors.accent, borderRadius: 2 * ts }} />
        <div style={{ fontFamily: fontFamily(style.captionFont), fontSize: 20 * ts, fontWeight: 700, letterSpacing: '0.3em', color: style.colors.accent }}>0{index + 1}</div>
      </div>
      <div
        style={{
          fontFamily: fontFamily(style.titleFont),
          fontSize: 50 * ts,
          fontWeight: 600,
          lineHeight: 1.04,
          color,
          textShadow: `0 ${2 * ts}px ${16 * ts}px rgba(0,0,0,0.5)`,
        }}
      >
        <span style={{ fontFamily: fontFamily(style.accentFont), fontStyle: 'italic', color: style.colors.accent }}>{first}</span>
        {rest.length ? ` ${rest.join(' ')}` : ''}
      </div>
    </div>
  );
};

const CoverStory: React.FC<FX<CoverProps>> = ({ props, frame, fps, durationInFrames, width, height, style }) => {
  const ts = textScale(width, height);
  const out = fadeOut(frame, durationInFrames, fps, 0.35);
  const color = colorFromMode(props.colorMode, style);
  const fam = fontFamily(style.titleFont);
  const mast = (props.masthead.trim() || 'ÍCONE').toUpperCase();
  const letters = Array.from(mast);
  const size = fitSize(mast, fam, 700, width * 0.86, height * 0.17, -0.01);
  const top = height * 0.1;
  const letterDelay = 0.08;
  const issueDelay = 0.15 + letters.length * letterDelay;
  const issueP = ramp(frame, issueDelay * fps, (issueDelay + 0.5) * fps, EO);
  const settle = 1.05 - 0.05 * ramp(frame, 0, durationInFrames, Easing.out(Easing.quad));
  const shade = ramp(frame, 0, 0.4 * fps, EO) * out;
  const line = (side: 1 | -1) => (
    <div style={{ width: 70 * ts * issueP, height: Math.max(1, 1.6 * ts), backgroundColor: color, opacity: 0.8, transformOrigin: side === 1 ? 'left' : 'right' }} />
  );
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ opacity: shade, backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.12) 22%, rgba(0,0,0,0) 34%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top, opacity: out, transform: `translateY(${(1 - out) * -24 * ts}px)` }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            fontFamily: fam,
            fontWeight: 700,
            fontSize: size,
            lineHeight: 0.92,
            letterSpacing: '-0.01em',
            color,
            transform: `scale(${settle})`,
            textShadow: `0 ${4 * ts}px ${30 * ts}px rgba(0,0,0,0.25)`,
          }}
        >
          {letters.map((ch, i) => {
            const p = spring({ frame: frame - (0.1 + i * letterDelay) * fps, fps, config: { damping: 18, stiffness: 120 } });
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  whiteSpace: 'pre',
                  opacity: clamp(p * 1.25, 0, 1),
                  transform: `translateY(${(1 - p) * 0.18 * size}px)`,
                  filter: p < 0.98 ? `blur(${((1 - clamp(p, 0, 1)) * 10 * ts).toFixed(2)}px)` : undefined,
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
        {props.issue.trim() ? (
          <div
            style={{
              marginTop: 14 * ts,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16 * ts,
              opacity: issueP,
              transform: `translateY(${(1 - issueP) * 10 * ts}px)`,
            }}
          >
            {line(-1)}
            <div
              style={{
                fontFamily: fontFamily(style.captionFont),
                fontSize: 22 * ts,
                fontWeight: 600,
                letterSpacing: '0.38em',
                color,
                whiteSpace: 'nowrap',
                textShadow: `0 ${1 * ts}px ${10 * ts}px rgba(0,0,0,0.45)`,
              }}
            >
              {props.issue.trim().toUpperCase()}
            </div>
            {line(1)}
          </div>
        ) : null}
      </div>
      <div style={{ position: 'absolute', left: width * 0.08, width: width * 0.5, top: height * 0.5, opacity: out }}>
        {[props.line1, props.line2].map((t, i) => (
          <CoverLine key={i} text={t} index={i} ts={ts} style={style} color={color} p={ramp(frame, (issueDelay + 0.2 + i * 0.18) * fps, (issueDelay + 0.75 + i * 0.18) * fps, EO)} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ===========================================================================
// Registry entries
// ===========================================================================

export const CAMERA_EFFECTS: EffectDef<any>[] = [
  def<PunchProps>({
    id: 'punch-zoom',
    name: 'Zoom de impacto',
    term: 'punch zoom',
    category: 'camera',
    description: 'Um tranco de zoom na palavra forte: 100% → 115% em 0,15 s, assenta e volta suave no final.',
    source: 'biblioteca',
    defaultDuration: 1.2,
    sfx: 'whoosh',
    fields: [
      { key: 'intensity', label: 'Intensidade do zoom (%)', type: 'number', default: 15, min: 5, max: 40, step: 1 },
      {
        key: 'focus',
        label: 'Ponto de foco',
        type: 'select',
        default: 'face',
        options: [
          { value: 'face', label: 'Rosto (terço de cima)' },
          { value: 'center', label: 'Centro' },
          { value: 'low', label: 'Mãos / produto (embaixo)' },
        ],
      },
    ],
    videoStyle: punchVideo,
  }),
  def<DigitalProps>({
    id: 'digital-zoom',
    name: 'Zoom digital P&B',
    term: 'digital zoom',
    category: 'camera',
    description: 'O vídeo vira preto e branco contrastado e dá um zoom lento no rosto, com granulado de filme opcional.',
    source: 'yanny',
    defaultDuration: 2.5,
    sfx: 'click',
    fields: [
      { key: 'zoom', label: 'Quanto aproxima (%)', type: 'number', default: 25, min: 5, max: 60, step: 1 },
      { key: 'bw', label: 'Preto e branco', type: 'toggle', default: true },
      { key: 'grain', label: 'Granulado de filme', type: 'toggle', default: true },
    ],
    Overlay: DigitalOverlay,
    videoStyle: digitalVideo,
  }),
  def<VertigoProps>({
    id: 'vertigo',
    name: 'Vertigo',
    term: 'dolly zoom echo',
    category: 'camera',
    description: 'Efeito vertigem: uma cópia maior e fantasma do vídeo cresce por trás enquanto você se afasta — você aparece duas vezes.',
    source: 'yanny',
    defaultDuration: 2.2,
    sfx: 'whoosh',
    fields: [
      { key: 'intensity', label: 'Intensidade', type: 'number', default: 1, min: 0.3, max: 1.5, step: 0.1 },
      { key: 'echoes', label: 'Cópias fantasma', type: 'number', default: 2, min: 1, max: 3, step: 1 },
    ],
    Backdrop: VertigoBackdrop,
    videoStyle: vertigoVideo,
  }),
  def<GridProps>({
    id: 'pull-back-reveal',
    name: 'Grade de clipes',
    term: 'pull-back reveal',
    category: 'camera',
    description: 'A câmera se afasta e seu vídeo vira o centro de uma grade 3x3 de clipes; no final, volta a ocupar a tela.',
    source: 'yanny',
    defaultDuration: 3,
    sfx: 'swish',
    fields: [
      { key: 'background', label: 'Cor do fundo', type: 'color', default: '#F5F0E8' },
      { key: 'variety', label: 'Variar cortes e cores dos clipes', type: 'toggle', default: true },
    ],
    Backdrop: PullBackBackdrop,
    videoStyle: pullBackVideo,
  }),
  def<ZoomThroughProps>({
    id: 'zoom-through',
    name: 'Zoom através',
    term: 'zoom-through cut',
    category: 'transitions',
    description: 'Mergulho rápido no centro com desfoque de movimento e um clarão no pico — a cena volta encaixando. Ótimo para trocar de assunto.',
    source: 'yanny',
    defaultDuration: 0.9,
    sfx: 'whoosh',
    fields: [
      { key: 'intensity', label: 'Intensidade', type: 'number', default: 1, min: 0.4, max: 2, step: 0.1 },
      { key: 'flash', label: 'Clarão no pico', type: 'toggle', default: true },
      { key: 'color', label: 'Cor do clarão', type: 'color', default: '#FFFFFF' },
    ],
    Overlay: ZoomThroughOverlay,
    videoStyle: zoomThroughVideo,
  }),
  def<WipeProps>({
    id: 'wipe',
    name: 'Cortina',
    term: 'wipe',
    category: 'transitions',
    description: 'Um bloco de cor atravessa a tela e limpa a cena (power4.inOut). Pode levar um texto, como "Capítulo 2".',
    source: 'biblioteca',
    defaultDuration: 1,
    sfx: 'swish',
    fields: [
      { key: 'label', label: 'Texto na cortina (opcional)', type: 'text', default: '', placeholder: 'ex.: Capítulo 2' },
      {
        key: 'direction',
        label: 'Direção',
        type: 'select',
        default: 'right',
        options: [
          { value: 'right', label: 'Da esquerda para a direita' },
          { value: 'left', label: 'Da direita para a esquerda' },
          { value: 'up', label: 'De baixo para cima' },
        ],
      },
      {
        key: 'colorMode',
        label: 'Cor',
        type: 'select',
        default: 'accent',
        options: [
          { value: 'accent', label: 'Cor de destaque' },
          { value: 'secondary', label: 'Cor secundária' },
          { value: 'background', label: 'Cor de fundo' },
          { value: 'text', label: 'Cor do texto' },
        ],
      },
      { key: 'size', label: 'Tamanho do texto', type: 'number', default: 120, min: 50, max: 220, step: 2 },
    ],
    Overlay: Wipe,
  }),
  def<FlashProps>({
    id: 'flash',
    name: 'Flash',
    term: 'flash',
    category: 'transitions',
    description: 'Um clarão rápido de flash de câmera com um leve estouro de exposição. Marca a palavra ou esconde um corte.',
    source: 'essence',
    defaultDuration: 0.6,
    sfx: 'click',
    fields: [
      { key: 'color', label: 'Cor do clarão', type: 'color', default: '#FFFFFF' },
      { key: 'intensity', label: 'Intensidade', type: 'number', default: 0.9, min: 0.2, max: 1, step: 0.05 },
    ],
    Overlay: FlashOverlay,
    videoStyle: flashVideo,
  }),
  def<CarouselProps>({
    id: 'reels-carousel',
    name: 'Carrossel 3D',
    term: 'reels 3D carousel',
    category: 'camera',
    description: 'Seu vídeo vira um card num carrossel 3D de reels que gira sozinho sobre um fundo creme, e depois volta para a tela cheia.',
    source: 'yanny',
    defaultDuration: 4.5,
    sfx: 'swish',
    fields: [
      { key: 'speed', label: 'Velocidade (cards por segundo)', type: 'number', default: 1, min: 0.3, max: 2.5, step: 0.1 },
      { key: 'showLabels', label: 'Mostrar títulos nos cards', type: 'toggle', default: true },
      { key: 'labels', label: 'Títulos dos cards (um por linha)', type: 'textarea', default: 'Gancho forte\nBastidores\nTutorial\nAntes e depois\nDica rápida' },
    ],
    Backdrop: CarouselBackdrop,
    videoStyle: carouselVideo,
  }),
  def<GlassProps>({
    id: 'glass-type',
    name: 'Letreiro de vidro',
    term: 'glass type',
    category: 'camera',
    description: 'Uma palavra gigante de vidro fosco (preenchimento translúcido, borda clara e brilho) surge no terço de cima do vídeo.',
    source: 'yanny',
    defaultDuration: 2.5,
    sfx: 'shimmer',
    fields: [
      { key: 'text', label: 'Texto', type: 'text', default: '', placeholder: 'Vazio = a palavra falada' },
      { key: 'size', label: 'Tamanho máximo', type: 'number', default: 300, min: 100, max: 420, step: 5 },
      { key: 'font', label: 'Fonte', type: 'select', default: 'title', options: FONT_OPTIONS },
      {
        key: 'position',
        label: 'Posição',
        type: 'select',
        default: 'top',
        options: [
          { value: 'top', label: 'Terço de cima' },
          { value: 'middle', label: 'No meio' },
          { value: 'bottom', label: 'Embaixo' },
        ],
      },
    ],
    Overlay: GlassType,
  }),
  def<CoverProps>({
    id: 'cover-story',
    name: 'Capa de revista',
    term: 'cover story',
    category: 'camera',
    description: 'Seu vídeo vira capa de revista: nome gigante em serifa surgindo letra por letra, linha da edição e duas chamadas.',
    source: 'yanny',
    defaultDuration: 3.5,
    sfx: 'click',
    fields: [
      { key: 'masthead', label: 'Nome da revista', type: 'text', default: 'ÍCONE' },
      { key: 'issue', label: 'Linha da edição', type: 'text', default: 'Edição 01 · 2026' },
      { key: 'line1', label: 'Chamada 1', type: 'text', default: 'Exclusivo: como eu crio em 5 minutos' },
      { key: 'line2', label: 'Chamada 2', type: 'text', default: 'Os 3 segredos de um bom vídeo' },
      {
        key: 'colorMode',
        label: 'Cor do título',
        type: 'select',
        default: 'text',
        options: [
          { value: 'text', label: 'Cor do texto' },
          { value: 'accent', label: 'Cor de destaque' },
          { value: 'white', label: 'Branco' },
          { value: 'black', label: 'Preto' },
        ],
      },
    ],
    Overlay: CoverStory,
  }),
];
