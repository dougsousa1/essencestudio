import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { ensureFont, fontFamily } from '../../core/fonts';
import type { EffectDef, EffectRenderProps } from '../types';
import { fadeOut, pop, px, rand, subtreeFilter } from '../util';

// ---------------------------------------------------------------------------
// Stickers & collage: polaroids of the footage, hand-drawn doodles that
// "boil", a paper-cut frame and a wiggling speech bubble.
// ---------------------------------------------------------------------------

// Handwriting font for captions / doodles. Kick off loading as soon as the
// library is imported so it is ready long before anyone exports.
void ensureFont('Caveat');
const HAND = fontFamily('Caveat');
const INK = '#2B2420';
const PAPER = '#FFFDF8';

type VideoCopyT = EffectRenderProps['VideoCopy'];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Size unit that also respects short (landscape) frames. */
const unit = (width: number, height: number) => Math.min(px(width), height / 864);

/** Relative luminance (0..1) of a #rgb / #rrggbb color. */
const luminance = (hex: string) => {
  const m = hex.trim().replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (!/^[0-9a-fA-F]{6}/.test(full)) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Readable ink on top of a colored surface. */
const inkOn = (bg: string) => (luminance(bg) > 0.55 ? '#16110F' : '#FFFFFF');
/** Mix a #rrggbb color towards black. */
const darken = (hex: string, amt: number) => {
  const m = hex.trim().replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (!/^[0-9a-fA-F]{6}/.test(full)) return hex;
  const c = [0, 2, 4].map((i) => Math.round(parseInt(full.slice(i, i + 2), 16) * (1 - amt)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

/**
 * A window onto the (cut) footage: the copy keeps the composition aspect,
 * is zoomed and positioned so `focusY` (0 = top, 1 = bottom) sits in the middle.
 */
const Footage: React.FC<{
  VideoCopy: VideoCopyT;
  w: number;
  h: number;
  compW: number;
  compH: number;
  focusX?: number;
  focusY?: number;
  zoom?: number;
  filter?: string;
}> = ({ VideoCopy, w, h, compW, compH, focusX = 0.5, focusY = 0.38, zoom = 1, filter }) => {
  const a = compW / compH;
  const iw = Math.max(w, h * a) * zoom;
  const ih = iw / a;
  const left = clamp(w / 2 - focusX * iw, w - iw, 0);
  const top = clamp(h / 2 - focusY * ih, h - ih, 0);
  return (
    <div style={{ position: 'relative', width: w, height: h, overflow: 'hidden', backgroundColor: '#D8CBB8' }}>
      <div style={{ position: 'absolute', left, top, width: iw, height: ih, filter: filter ? subtreeFilter(filter) : undefined }}>
        <VideoCopy />
      </div>
    </div>
  );
};

/** An instant photo: white frame, footage as the photo, handwritten caption. */
const Polaroid: React.FC<{
  u: number;
  photo: number;
  caption: string;
  VideoCopy: VideoCopyT;
  compW: number;
  compH: number;
  focusY?: number;
  zoom?: number;
  filter?: string;
  /** 0 = blank (still developing), 1 = fully developed. */
  develop?: number;
  tapeRot?: number | null;
  shadow?: string;
}> = ({ u, photo, caption, VideoCopy, compW, compH, focusY, zoom, filter, develop = 1, tapeRot = null, shadow }) => {
  const pad = photo * 0.065;
  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: PAPER,
        padding: `${pad}px ${pad}px 0`,
        width: photo + pad * 2,
        boxShadow: shadow ?? `0 ${18 * u}px ${40 * u}px rgba(8,5,3,0.32), 0 ${3 * u}px ${10 * u}px rgba(8,5,3,0.18)`,
        borderRadius: 3 * u,
      }}
    >
      <div style={{ position: 'relative' }}>
        <Footage VideoCopy={VideoCopy} w={photo} h={photo} compW={compW} compH={compH} focusY={focusY} zoom={zoom} filter={filter} />
        {develop < 1 ? (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: '#EDE6DA', opacity: (1 - develop) * 0.95 }} />
        ) : null}
      </div>
      <div
        style={{
          height: photo * 0.27,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: HAND,
          fontWeight: 600,
          fontSize: photo * 0.16,
          color: INK,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {caption}
      </div>
      {/* Tape last: the MP4 exporter paints in DOM order (it ignores zIndex). */}
      {tapeRot !== null ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: -photo * 0.06,
            width: photo * 0.36,
            height: photo * 0.12,
            marginLeft: -photo * 0.18,
            backgroundColor: 'rgba(222,205,160,0.78)',
            boxShadow: `0 ${2 * u}px ${6 * u}px rgba(67,47,29,0.18)`,
            transform: `rotate(${tapeRot}deg)`,
            zIndex: 2,
          }}
        />
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 1. Polaroid in orbit (ref 01 "orbit"): a polaroid circles the speaker on a
// tilted ellipse; fake depth — small, dim and soft behind, big and sharp in front.
// ---------------------------------------------------------------------------

type OrbitProps = { caption: string; speed: number };

const PolaroidOrbit: React.FC<EffectRenderProps<OrbitProps>> = ({ props, frame, fps, durationInFrames, width, height, VideoCopy, word }) => {
  const u = unit(width, height);
  const t = frame / fps;
  const theta = 0.55 + t * Math.PI * 2 * 0.42 * (props.speed || 1);
  const depth = Math.sin(theta); // +1 = in front of the speaker, -1 = behind
  const k = (depth + 1) / 2;
  const tilt = (-9 * Math.PI) / 180;
  const ex = Math.cos(theta) * width * 0.34;
  const ey = Math.sin(theta) * height * 0.065;
  const x = width * 0.5 + ex * Math.cos(tilt) - ey * Math.sin(tilt);
  const y = height * 0.47 + ex * Math.sin(tilt) + ey * Math.cos(tilt);
  const enter = pop(frame, fps);
  const exit = interpolate(frame, [durationInFrames - 0.3 * fps, durationInFrames], [1, 0], { ...CLAMP, easing: Easing.in(Easing.cubic) });
  const scale = (0.58 + 0.46 * k) * enter * (0.6 + 0.4 * exit);
  const rot = Math.cos(theta) * -10 + Math.sin(theta * 2) * 3;
  const skew = Math.cos(theta) * 5;
  const photo = 250 * u;
  const caption = props.caption || word || 'bastidores';
  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          transform: `translate(-50%, -50%) rotate(${rot}deg) skewY(${skew}deg) scale(${scale})`,
          // opacity() inside the filter = group opacity in the MP4 export too (CSS opacity is applied per child there).
          filter: subtreeFilter(`brightness(${0.62 + 0.38 * k}) blur(${(1 - k) * 2.6 * u}px) opacity(${0.72 + 0.28 * k})`),
        }}
      >
        <Polaroid
          u={u}
          photo={photo}
          caption={caption}
          VideoCopy={VideoCopy}
          compW={width}
          compH={height}
          focusY={0.34}
          filter="saturate(1.1) sepia(0.12) contrast(1.05)"
          shadow={`0 ${(10 + 26 * k) * u}px ${(24 + 40 * k) * u}px rgba(0,0,0,${0.18 + 0.3 * k})`}
        />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 2. Polaroid stack — adapted from Remotion Elements "Polaroid Pictures"
// (https://www.remotion.dev/elements/storytelling/polaroid-pictures) and the
// "couch wall" idea (ref 16): three photos of the footage drop in staggered,
// develop, drift, then fly away.
// ---------------------------------------------------------------------------

type StackProps = { captions: string };

const STACK_LOOKS = [
  { filter: 'grayscale(1) contrast(1.12) brightness(1.04)', focusY: 0.3, zoom: 1.35, rot: [-20, -8], from: [-1.1, 0.25] },
  { filter: 'sepia(0.55) saturate(0.85) contrast(1.05)', focusY: 0.42, zoom: 1, rot: [16, 6], from: [0.9, -0.7] },
  { filter: 'saturate(1.15) contrast(1.04)', focusY: 0.36, zoom: 1.7, rot: [14, -3], from: [0.2, 1] },
];

const PolaroidStack: React.FC<EffectRenderProps<StackProps>> = ({ props, frame, fps, durationInFrames, width, height, VideoCopy }) => {
  const u = unit(width, height);
  const portrait = height > width * 1.2;
  const lines = props.captions
    .split(/\n|,/)
    .map((l) => l.trim())
    .filter(Boolean);
  const caps = [0, 1, 2].map((i) => lines[i] ?? ['bastidores', 'primeiro take', 'do meu jeito'][i]);
  const photo = Math.min(width * 0.33, height * 0.25);
  const spots = portrait
    ? [
        [0.3, 0.28],
        [0.7, 0.4],
        [0.39, 0.63],
      ]
    : [
        [0.24, 0.5],
        [0.5, 0.46],
        [0.76, 0.52],
      ];
  const drift = interpolate(frame, [0.6 * fps, durationInFrames], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.quad) });
  return (
    <AbsoluteFill style={{ transform: `translateY(${-18 * u * drift}px) scale(${1 + 0.035 * drift})` }}>
      {STACK_LOOKS.map((look, i) => {
        const delay = i * 0.28 * fps;
        const inP = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 120, mass: 0.9 } });
        const outStart = durationInFrames - (0.5 - i * 0.06) * fps;
        const outP = interpolate(frame, [outStart, durationInFrames], [0, 1], { ...CLAMP, easing: Easing.in(Easing.cubic) });
        const develop = interpolate(frame - delay, [0.15 * fps, 0.9 * fps], [0, 1], CLAMP);
        const [fx, fy] = look.from;
        const tx = (1 - inP) * fx * width * 0.7 + outP * fx * width * 0.8;
        const ty = (1 - inP) * fy * height * 0.6 + outP * -0.3 * height;
        const rot = interpolate(inP, [0, 1], [look.rot[0], look.rot[1]]) + outP * look.rot[0] * 0.6;
        const opacity = interpolate(frame - delay, [0, 0.12 * fps], [0, 1], CLAMP) * (1 - outP);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: width * spots[i][0],
              top: height * spots[i][1],
              opacity,
              transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${1.06 - 0.06 * inP + outP * 0.08})`,
            }}
          >
            <Polaroid
              u={u}
              photo={photo}
              caption={caps[i]}
              VideoCopy={VideoCopy}
              compW={width}
              compH={height}
              focusY={look.focusY}
              zoom={look.zoom}
              filter={look.filter}
              develop={develop}
              tapeRot={i === 1 ? 4 : -5}
              shadow={`0 ${(24 + i * 4) * u}px ${(52 + i * 6) * u}px rgba(8,5,3,0.3), 0 ${4 * u}px ${12 * u}px rgba(8,5,3,0.16)`}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 3. Doodles (ref 05 "doodle boil"): white hand-drawn doodles draw on, then
// "boil" — points re-jittered every 3 frames like cel animation.
// ---------------------------------------------------------------------------

type DoodleProps = { color: string; word: string };

/** Re-jitter every coordinate of a path (all numbers in our paths are coordinates). */
const boilPath = (d: string, seed: number, amp: number) => {
  let i = 0;
  return d.replace(/-?\d+(\.\d+)?/g, (m) => (parseFloat(m) + (rand(seed * 31.7 + i++ * 7.13) - 0.5) * 2 * amp).toFixed(2));
};

const DOODLES: Array<{ paths: string[]; x: number; y: number; size: number; rot: number }> = [
  // heart
  { paths: ['M50 84 C 30 70 10 52 12 34 C 14 18 34 12 48 30 C 56 14 80 12 88 28 C 96 46 72 68 52 86'], x: 0.17, y: 0.2, size: 220, rot: -12 },
  // beamed music notes
  {
    paths: ['M32 76 L32 24 L76 14 L76 66', 'M32 36 L76 26', 'M32 76 C 30 84 16 86 14 79 C 12 72 26 68 32 75', 'M76 66 C 74 74 60 76 58 69 C 56 62 70 58 76 65'],
    x: 0.82,
    y: 0.18,
    size: 210,
    rot: 8,
  },
  // sparkles
  {
    paths: [
      'M40 10 C 42 34 48 42 70 45 C 48 48 42 56 40 82 C 38 56 32 48 10 45 C 32 42 38 34 40 10',
      'M82 6 C 83 14 85 16 92 18 C 85 20 83 22 82 30 C 81 22 79 20 72 18 C 79 16 81 14 82 6',
      'M80 66 L80 80 M73 73 L87 73',
    ],
    x: 0.84,
    y: 0.44,
    size: 180,
    rot: 0,
  },
  // looped arrow
  {
    paths: ['M6 70 C 30 70 48 60 52 44 C 56 28 40 20 34 32 C 28 44 46 60 70 58 C 82 57 90 52 96 46', 'M85 41 L96 46 L90 56'],
    x: 0.17,
    y: 0.6,
    size: 240,
    rot: -6,
  },
];

const SQUIGGLE = 'M4 20 C 14 8 22 30 32 18 C 42 6 50 30 60 18 C 70 6 78 30 88 18';

const Doodles: React.FC<EffectRenderProps<DoodleProps>> = ({ props, frame, fps, durationInFrames, width, height }) => {
  const u = unit(width, height);
  const out = fadeOut(frame, durationInFrames, fps);
  const color = props.color || '#FFFFFF';
  const tick = Math.floor(frame / 3); // boil every 3 frames
  const drawDur = 0.55 * fps;
  const shadow = `drop-shadow(0 ${2 * u}px ${5 * u}px rgba(0,0,0,0.35))`;
  const progressFor = (start: number, j: number, n: number) => {
    const seg = drawDur / n;
    return interpolate(frame, [start + j * seg, start + (j + 1) * seg], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.quad) });
  };
  const wordStart = 4 * 0.12 * fps;
  const wordP = interpolate(frame, [wordStart, wordStart + 0.45 * fps], [0, 1], { ...CLAMP, easing: Easing.out(Easing.quad) });
  const wj = (n: number) => (rand(tick * 13.1 + n) - 0.5) * 2;
  const label = props.word || 'uau!';
  return (
    <AbsoluteFill style={{ opacity: out, transform: `scale(${1 - (1 - out) * 0.06})` }}>
      {DOODLES.map((d, i) => {
        const start = i * 0.12 * fps;
        const size = d.size * u;
        const jx = (rand(tick * 7.7 + i * 3.1) - 0.5) * 4 * u;
        const jy = (rand(tick * 5.3 + i * 9.7) - 0.5) * 4 * u;
        const jr = (rand(tick * 3.9 + i * 1.7) - 0.5) * 3;
        const appear = interpolate(frame, [start, start + 0.15 * fps], [0.85, 1], CLAMP);
        return (
          <svg
            key={i}
            viewBox="0 0 100 100"
            width={size}
            height={size}
            style={{
              position: 'absolute',
              left: width * d.x - size / 2,
              top: height * d.y - size / 2,
              overflow: 'visible',
              transform: `translate(${jx}px, ${jy}px) rotate(${d.rot + jr}deg) scale(${appear})`,
              filter: shadow,
            }}
          >
            {d.paths.map((p, j) => {
              const pr = progressFor(start, j, d.paths.length);
              if (pr <= 0) return null;
              const path = boilPath(p, tick * 17 + i * 101 + j * 7, 1.1);
              const ev = evolvePath(pr, path);
              return (
                <path
                  key={j}
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={3.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={ev.strokeDasharray}
                  strokeDashoffset={ev.strokeDashoffset}
                />
              );
            })}
          </svg>
        );
      })}
      {/* handwritten word + squiggle underline */}
      <div
        style={{
          position: 'absolute',
          left: width * 0.6,
          // keep clear of the captions on square / landscape frames
          top: height * (height > width * 1.2 ? 0.6 : 0.47),
          transform: `translate(${wj(1) * 2 * u}px, ${wj(2) * 2 * u}px) rotate(${-8 + wj(3) * 1.5}deg)`,
          filter: shadow,
        }}
      >
        <div style={{ overflow: 'hidden', width: `${wordP * 100}%` }}>
          <div style={{ fontFamily: HAND, fontWeight: 700, fontSize: 130 * u, color, lineHeight: 1, whiteSpace: 'nowrap', width: 'max-content' }}>{label}</div>
        </div>
        <svg viewBox="0 0 100 34" width={240 * u} height={82 * u} style={{ display: 'block', overflow: 'visible', marginTop: -8 * u }}>
          {(() => {
            const pr = interpolate(frame, [wordStart + 0.3 * fps, wordStart + 0.7 * fps], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.quad) });
            if (pr <= 0) return null;
            const path = boilPath(SQUIGGLE, tick * 11 + 5, 0.9);
            const ev = evolvePath(pr, path);
            return (
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={3.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={ev.strokeDasharray}
                strokeDashoffset={ev.strokeDashoffset}
              />
            );
          })()}
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 4. Paper frame (ref 09 "paper cut", without person segmentation): the video
// shrinks onto a cream paper sheet with pinking-shear zigzags, a sticky label
// and little ink marks.
// ---------------------------------------------------------------------------

type PaperProps = { label: string };

const PAPER_SCALE = 0.84;

const paperAmount = (frame: number, fps: number, durationInFrames: number) => {
  const inP = spring({ frame, fps, config: { damping: 18, stiffness: 140 } });
  const outP = interpolate(frame, [durationInFrames - 0.4 * fps, durationInFrames], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.cubic) });
  return Math.min(1, inP) * (1 - outP);
};

const zigzag = (x0: number, x1: number, y: number, period: number, amp: number) => {
  const pts: string[] = [];
  let up = true;
  for (let x = x0; x <= x1 + 0.01; x += period / 2) {
    pts.push(`${x.toFixed(1)},${(up ? y - amp / 2 : y + amp / 2).toFixed(1)}`);
    up = !up;
  }
  return `M${pts.join(' L')}`;
};

const PaperBackdrop: React.FC<EffectRenderProps<PaperProps>> = ({ frame, fps, width, height, style }) => {
  const u = unit(width, height);
  const accent = luminance(style.colors.accent) > 0.6 ? darken(style.colors.accent, 0.3) : style.colors.accent;
  const margin = (1 - PAPER_SCALE) / 2;
  const topY = height * margin * 0.42;
  const botY = height * (1 - margin * 0.42);
  const top = zigzag(width * 0.04, width * 0.96, topY, 38 * u, 24 * u);
  const bottom = zigzag(width * 0.66, width * 0.92, botY, 38 * u, 24 * u);
  const drawTop = evolvePath(interpolate(frame, [0.1 * fps, 0.8 * fps], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.quad) }), top);
  const drawBot = evolvePath(interpolate(frame, [0.4 * fps, 0.9 * fps], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.quad) }), bottom);
  const specks = Array.from({ length: 70 }, (_, i) => ({ x: rand(i * 3.1 + 1) * width, y: rand(i * 7.9 + 2) * height, r: (0.8 + rand(i * 1.3) * 1.6) * u }));
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(170deg, #FCF8F0 0%, #F6EFE2 60%, #EFE5D3 100%)' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>
        {specks.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#6B5843" opacity={0.12} />
        ))}
        <path d={top} fill="none" stroke={accent} strokeWidth={6 * u} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={drawTop.strokeDasharray} strokeDashoffset={drawTop.strokeDashoffset} />
        <path d={bottom} fill="none" stroke={INK} strokeWidth={5 * u} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={drawBot.strokeDasharray} strokeDashoffset={drawBot.strokeDashoffset} />
      </svg>
    </AbsoluteFill>
  );
};

const PaperOverlay: React.FC<EffectRenderProps<PaperProps>> = ({ props, frame, fps, durationInFrames, width, height, style }) => {
  const u = unit(width, height);
  const k = paperAmount(frame, fps, durationInFrames);
  const labelIn = spring({ frame: frame - 0.3 * fps, fps, config: { damping: 11, stiffness: 160 } });
  const out = fadeOut(frame, durationInFrames, fps, 0.35);
  const markP = interpolate(frame, [0.45 * fps, 0.9 * fps], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.quad) });
  const margin = (1 - PAPER_SCALE) / 2;
  const accent = style.colors.accent;
  const cross = 'M10 10 L40 40 M40 10 L10 40';
  const star = 'M75 6 C 76 18 79 22 92 25 C 79 28 76 32 75 44 C 74 32 71 28 58 25 C 71 22 74 18 75 6';
  const evC = evolvePath(markP, cross);
  const evS = evolvePath(interpolate(markP, [0.3, 1], [0, 1], CLAMP), star);
  return (
    <AbsoluteFill style={{ opacity: out * Math.min(1, k * 1.5) }}>
      {/* sticky label straddling the photo corner */}
      <div
        style={{
          position: 'absolute',
          left: width * (margin - 0.025),
          top: height * margin - 50 * u,
          transform: `rotate(${-7 + (1 - labelIn) * -18}deg) scale(${labelIn})`,
          transformOrigin: '30% 80%',
          backgroundColor: accent,
          color: inkOn(accent),
          fontFamily: HAND,
          fontWeight: 700,
          fontSize: 66 * u,
          lineHeight: 1,
          padding: `${16 * u}px ${34 * u}px ${22 * u}px`,
          boxShadow: `0 ${8 * u}px ${18 * u}px rgba(40,25,10,0.28)`,
          whiteSpace: 'nowrap',
        }}
      >
        {props.label || '5 min'}
        {/* Tape after the text: the browser paints positioned children on top, the exporter paints in DOM order. */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: -14 * u,
            width: 90 * u,
            height: 28 * u,
            marginLeft: -45 * u,
            backgroundColor: 'rgba(255,253,245,0.65)',
            transform: 'rotate(4deg)',
          }}
        />
      </div>
      {/* ink marks on the paper margin */}
      <svg
        viewBox="0 0 100 50"
        width={150 * u}
        height={75 * u}
        style={{ position: 'absolute', right: width * 0.1, top: height * margin * 0.5 - 37 * u, overflow: 'visible' }}
      >
        <path d={cross} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" strokeDasharray={evC.strokeDasharray} strokeDashoffset={evC.strokeDashoffset} />
        <path d={star} fill="none" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" strokeDasharray={evS.strokeDasharray} strokeDashoffset={evS.strokeDashoffset} />
      </svg>
    </AbsoluteFill>
  );
};

const paperVideoStyle = ({ frame, fps, durationInFrames, width }: EffectRenderProps<PaperProps>): React.CSSProperties => {
  const k = paperAmount(frame, fps, durationInFrames);
  const s = px(width);
  return {
    transform: `scale(${1 - (1 - PAPER_SCALE) * k}) rotate(${-1.2 * k}deg)`,
    boxShadow: `0 ${16 * s * k}px ${44 * s * k}px rgba(60,40,20,${0.35 * k})`,
    border: k > 0.01 ? `${10 * s * k}px solid ${PAPER}` : undefined,
  };
};

// ---------------------------------------------------------------------------
// 5. Speech bubble — after Remotion Elements "Wiggling Callout"
// (https://www.remotion.dev/elements/commerce/product-discount-callout):
// a callout pops from its tail and wiggles (0 → 10° → -7° → 3° → 0°).
// ---------------------------------------------------------------------------

type BubbleProps = { text: string; side: string };

const SpeechBubble: React.FC<EffectRenderProps<BubbleProps>> = ({ props, frame, fps, durationInFrames, width, height, style }) => {
  const u = unit(width, height);
  const accent = style.colors.accent;
  const ink = inkOn(accent);
  const left = props.side === 'left';
  const f30 = (frame * 30) / fps;
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 190 } });
  const wiggle = interpolate(f30, [2, 9, 16, 22, 28], [0, 10, -7, 3, 0], { ...CLAMP, easing: Easing.inOut(Easing.quad) });
  const bob = Math.sin((frame / fps) * Math.PI * 1.6) * 5 * u;
  const exit = interpolate(frame, [durationInFrames - 0.25 * fps, durationInFrames], [1, 0], { ...CLAMP, easing: Easing.in(Easing.cubic) });
  const tailW = 74 * u;
  const tailH = 64 * u;
  const anchor: React.CSSProperties = left ? { right: width * 0.42 } : { left: width * 0.42 };
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          top: height * 0.14,
          ...anchor,
          maxWidth: width * 0.52,
          transform: `translateY(${bob}px) rotate(${(left ? -wiggle + 3 : wiggle - 3) * 1}deg) scale(${enter * exit})`,
          transformOrigin: left ? '86% 125%' : '14% 125%',
          filter: `drop-shadow(0 ${10 * u}px ${18 * u}px rgba(0,0,0,0.3))`,
          opacity: Math.min(1, enter * 3) * exit,
        }}
      >
        <div
          style={{
            position: 'relative',
            backgroundColor: accent,
            color: ink,
            borderRadius: 56 * u,
            padding: `${26 * u}px ${42 * u}px ${30 * u}px`,
            fontFamily: fontFamily(style.captionFont),
            fontWeight: 800,
            fontSize: 62 * u,
            lineHeight: 1.1,
            textAlign: 'center',
            letterSpacing: '-0.01em',
          }}
        >
          {props.text || 'Simples assim!'}
        </div>
        <svg
          viewBox="0 0 74 64"
          width={tailW}
          height={tailH}
          style={{
            position: 'absolute',
            top: '100%',
            marginTop: -6 * u,
            ...(left ? { right: '14%', transform: 'scaleX(-1)' } : { left: '14%' }),
            overflow: 'visible',
          }}
        >
          <path d="M14 0 L58 0 C 44 24 24 48 2 62 C 14 42 18 22 14 0 Z" fill={accent} />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------

export const STICKER_EFFECTS: EffectDef<any>[] = [
  {
    id: 'polaroid-orbit',
    name: 'Polaroid em órbita',
    term: 'orbit',
    category: 'stickers',
    description: 'Uma polaroid com o seu próprio vídeo gira ao seu redor numa elipse: fica menor e apagada quando passa por trás e cresce com sombra quando passa na frente.',
    source: 'yanny',
    defaultDuration: 3.5,
    sfx: 'whoosh',
    fields: [
      { key: 'caption', label: 'Legenda da foto', type: 'text', default: '', placeholder: 'Vazio = palavra falada' },
      { key: 'speed', label: 'Velocidade da volta', type: 'number', default: 1, min: 0.3, max: 3, step: 0.1 },
    ],
    Overlay: PolaroidOrbit,
  },
  {
    id: 'polaroid-stack',
    name: 'Polaroids',
    term: 'polaroid pictures',
    category: 'stickers',
    description: 'Três polaroids do seu vídeo caem em cascata, giradas, com fita adesiva, sombra de papel e legendas à mão — revelando a foto como se estivesse revelando.',
    source: 'elements',
    defaultDuration: 3,
    sfx: 'paper',
    fields: [{ key: 'captions', label: 'Legendas (uma por linha)', type: 'textarea', default: 'bastidores\nprimeiro take\ndo meu jeito' }],
    Overlay: PolaroidStack,
  },
  {
    id: 'doodles',
    name: 'Rabiscos',
    term: 'doodle boil',
    category: 'stickers',
    description: 'Rabiscos feitos à mão (coração, notas musicais, brilhos, seta e uma palavra) se desenham ao seu redor e ficam “fervendo” como animação quadro a quadro.',
    source: 'yanny',
    defaultDuration: 3,
    sfx: 'shimmer',
    fields: [
      { key: 'color', label: 'Cor dos rabiscos', type: 'color', default: '#FFFFFF' },
      { key: 'word', label: 'Palavra escrita', type: 'text', default: 'uau!' },
    ],
    Overlay: Doodles,
  },
  {
    id: 'paper-frame',
    name: 'Papel picotado',
    term: 'paper cut',
    category: 'stickers',
    description: 'O vídeo encolhe e vira um recorte colado numa folha creme, com zigue-zague de tesoura, etiqueta adesiva e marquinhas à mão.',
    source: 'yanny',
    defaultDuration: 3,
    sfx: 'paper',
    fields: [{ key: 'label', label: 'Etiqueta', type: 'text', default: '5 min' }],
    Backdrop: PaperBackdrop,
    Overlay: PaperOverlay,
    videoStyle: paperVideoStyle,
  },
  {
    id: 'speech-bubble',
    name: 'Balão',
    term: 'wiggling callout',
    category: 'stickers',
    description: 'Um balão de fala na cor de destaque aparece perto do seu rosto e balança para chamar atenção.',
    source: 'elements',
    defaultDuration: 2.5,
    sfx: 'pop',
    fields: [
      { key: 'text', label: 'Texto do balão', type: 'text', default: 'Simples assim!' },
      {
        key: 'side',
        label: 'Lado',
        type: 'select',
        default: 'right',
        options: [
          { value: 'right', label: 'Direita' },
          { value: 'left', label: 'Esquerda' },
        ],
      },
    ],
    Overlay: SpeechBubble,
  },
];
