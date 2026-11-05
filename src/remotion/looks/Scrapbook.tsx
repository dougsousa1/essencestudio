import React, { useMemo } from 'react';
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { fontFamily } from '../../core/fonts';
import type { LookProps } from '../../core/types';
import { Captions, Grain, Vignette } from '../parts';

/** Deterministic PRNG so the pattern is identical in preview and export. */
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Organic leopard-ish spots as an SVG data URI (rendered through <Img>, not CSS url()). */
const spotsPattern = (vw: number, vh: number, base: string, spot: string) => {
  const rnd = mulberry32(1337);
  const step = 70;
  const shapes: string[] = [];
  const f = (n: number) => n.toFixed(1);
  for (let y = -step / 2; y < vh + step; y += step * 0.86) {
    const row = Math.round(y / step);
    for (let x = -step / 2; x < vw + step; x += step) {
      const cx = x + (row % 2 ? step / 2 : 0) + (rnd() - 0.5) * step * 0.5;
      const cy = y + (rnd() - 0.5) * step * 0.5;
      const rot = rnd() * 180;
      const kind = rnd();
      if (kind < 0.62) {
        // Single elongated spot.
        const rx = 7 + rnd() * 7;
        const ry = rx * (0.45 + rnd() * 0.35);
        shapes.push(`<ellipse cx='${f(cx)}' cy='${f(cy)}' rx='${f(rx)}' ry='${f(ry)}' transform='rotate(${f(rot)} ${f(cx)} ${f(cy)})'/>`);
      } else if (kind < 0.9) {
        // Broken "rosette": a few small blobs around an empty center.
        const n = 3 + Math.floor(rnd() * 2);
        const r = 10 + rnd() * 5;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + rnd() * 0.6 + rot;
          const bx = cx + Math.cos(a) * r;
          const by = cy + Math.sin(a) * r;
          const rx = 5 + rnd() * 3;
          const ry = rx * 0.55;
          shapes.push(`<ellipse cx='${f(bx)}' cy='${f(by)}' rx='${f(rx)}' ry='${f(ry)}' transform='rotate(${f((a * 180) / Math.PI + 90)} ${f(bx)} ${f(by)})'/>`);
        }
      } else {
        // Tiny dot.
        shapes.push(`<circle cx='${f(cx)}' cy='${f(cy)}' r='${f(3 + rnd() * 2.5)}'/>`);
      }
    }
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${vw}' height='${Math.round(vh)}' viewBox='0 0 ${vw} ${Math.round(vh)}'><rect width='100%' height='100%' fill='${base}'/><g fill='${spot}'>${shapes.join('')}</g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/** A strip of semi-transparent tape. */
const Tape: React.FC<{ scale: number; left: string; top: number; rot: number; w?: number }> = ({ scale, left, top, rot, w = 120 }) => (
  <div
    style={{
      position: 'absolute',
      left,
      top: top * scale,
      width: w * scale,
      height: 34 * scale,
      marginLeft: (-w / 2) * scale,
      backgroundColor: 'rgba(255, 252, 240, 0.55)',
      border: `${1 * scale}px solid rgba(255,255,255,0.35)`,
      boxShadow: `0 ${1 * scale}px ${3 * scale}px rgba(0,0,0,0.12)`,
      transform: `rotate(${rot}deg)`,
    }}
  />
);

/** A paper scrap that pops in with a little overshoot. */
const Scrap: React.FC<{
  at: number;
  scale: number;
  x: number;
  y: number;
  rot: number;
  bg: string;
  children: React.ReactNode;
  tapeRot?: number;
}> = ({ at, scale, x, y, rot, bg, children, tapeRot = -4 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 11, stiffness: 160, mass: 0.8 } });
  if (frame < at) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${rot + (1 - p) * 12}deg) scale(${p})`,
        opacity: Math.min(1, p * 2),
      }}
    >
      <div
        style={{
          position: 'relative',
          backgroundColor: bg,
          padding: `${22 * scale}px ${30 * scale}px`,
          boxShadow: `0 ${8 * scale}px ${22 * scale}px rgba(0,0,0,0.28)`,
          borderRadius: 2 * scale,
        }}
      >
        {children}
        <Tape scale={scale} left="50%" top={-18} rot={tapeRot} />
      </div>
    </div>
  );
};

/** Scrapbook: the video shrinks into a taped paper card on a spotted background. */
export const ScrapbookLook: React.FC<LookProps> = ({ project, timeline, width, height, video }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = project.style;
  const scale = width / 1080;

  const vh = (1080 * height) / width;
  const pattern = useMemo(() => spotsPattern(1080, vh, s.colors.background, s.colors.secondary), [vh, s.colors.background, s.colors.secondary]);

  // Card geometry (final state).
  const cardW = Math.min(width * 0.78, height * 0.78 * 1.2);
  const cardH = Math.min(height * 0.62, cardW * 1.05);
  const cx = width / 2;
  const cy = height * (height > width ? 0.47 : 0.5);
  const border = 18 * scale;

  // Full-bleed for ~0.5 s, then spring into the card.
  const p = spring({ frame: frame - Math.round(0.5 * fps), fps, config: { damping: 16, stiffness: 110, mass: 0.9 } });
  const boxW = interpolate(p, [0, 1], [width, cardW]);
  const boxH = interpolate(p, [0, 1], [height, cardH]);
  const boxX = interpolate(p, [0, 1], [0, cx - cardW / 2]);
  const boxY = interpolate(p, [0, 1], [0, cy - cardH / 2]);
  const rot = interpolate(p, [0, 1], [0, -1.5]);
  const pad = border * Math.min(1, p);

  const cardTop = cy - cardH / 2;
  const cardBottom = cy + cardH / 2;
  const clampY = (y: number) => Math.min(height * 0.8, Math.max(height * 0.1, y));

  const t0 = Math.round(0.5 * fps) + 12;
  const kicker = project.title.kicker.trim();

  return (
    <AbsoluteFill style={{ backgroundColor: s.colors.background }}>
      <Img src={pattern} style={{ position: 'absolute', left: 0, top: 0, width, height, objectFit: 'cover' }} />

      {/* Decorative scrap (no text): accent paper with stripes, top-right. */}
      <Scrap at={t0 + 22} scale={scale} x={cx + cardW * 0.36} y={cardTop - 30 * scale} rot={7} bg={s.colors.accent} tapeRot={6}>
        <div style={{ width: 150 * scale, height: 110 * scale, display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ height: 4 * scale, width: `${90 - i * 14}%`, backgroundColor: s.colors.secondary, opacity: 0.55, borderRadius: 2 * scale }} />
          ))}
        </div>
      </Scrap>

      {/* The framed video card. */}
      <div
        style={{
          position: 'absolute',
          left: boxX,
          top: boxY,
          width: boxW,
          height: boxH,
          transform: `rotate(${rot}deg)`,
          backgroundColor: '#FFFDF8',
          padding: pad,
          boxSizing: 'border-box',
          boxShadow: p > 0.02 ? `0 ${14 * scale}px ${36 * scale}px rgba(0,0,0,${0.35 * Math.min(1, p)})` : undefined,
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>{video}</div>
      </div>

      {/* Title scrap, handwritten, overlapping the top-left corner of the card. */}
      {project.title.enabled && project.title.text.trim() ? (
        <Scrap at={t0} scale={scale} x={cx - cardW * 0.18} y={clampY(cardTop - 6 * scale)} rot={-5} bg="#FFFDF5">
          <div
            style={{
              fontFamily: fontFamily(s.titleFont),
              fontSize: 72 * scale,
              lineHeight: 1,
              color: s.colors.secondary,
              maxWidth: width * 0.55,
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
            }}
          >
            {project.title.text}
          </div>
        </Scrap>
      ) : null}

      {/* Kicker scrap, bottom-right. */}
      {kicker ? (
        <Scrap at={t0 + 12} scale={scale} x={cx + cardW * 0.26} y={clampY(cardBottom + 10 * scale)} rot={4} bg={s.colors.secondary} tapeRot={-8}>
          <div
            style={{
              fontFamily: fontFamily(s.captionFont),
              fontSize: 24 * scale,
              fontWeight: 600,
              letterSpacing: '0.22em',
              color: s.colors.background,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            {kicker}
          </div>
        </Scrap>
      ) : null}

      <Vignette amount={s.vignette} />
      <Grain amount={s.grain} />
      <Captions project={project} timeline={timeline} width={width} height={height} emphasis="italic" />
    </AbsoluteFill>
  );
};
