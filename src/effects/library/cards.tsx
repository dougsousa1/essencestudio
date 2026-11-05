import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring } from 'remotion';
import { ensureFont, fontFamily } from '../../core/fonts';
import type { EffectDef, EffectRenderProps } from '../types';
import { fadeOut } from '../util';

// ---------------------------------------------------------------------------
// Cards & interface effects: phone mock-up, checklist, UI world, chat
// messages, frame break, A vs B highlight and the headline (post-it) wall.
// Ideas from the "17 effects" reference reels; designs are our own.
// Chat bubbles adapted from Remotion Elements "On-Screen Messages"
// (https://www.remotion.dev/elements/storytelling/on-screen-messages).
// Only export-safe CSS is used (no clip-path, radial gradients or backdrop-filter):
// "frosted glass" is a blurred VideoCopy behind a translucent card.
// ---------------------------------------------------------------------------

// The handwritten post-its use Caveat even when it is not one of the style fonts:
// start loading it as soon as the library is imported so preview and export have it.
if (typeof window !== 'undefined') void ensureFont('Caveat');

// ---------- small local helpers ----------

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 0 → 1 between two moments (seconds), eased. */
const ramp = (frame: number, fps: number, startSec: number, durSec: number, easing: (t: number) => number = Easing.out(Easing.cubic)) =>
  interpolate(frame, [startSec * fps, (startSec + durSec) * fps], [0, 1], { ...CLAMP, easing });

const springAt = (frame: number, fps: number, delaySec: number, damping = 14, stiffness = 170, mass = 1) =>
  spring({ frame: frame - delaySec * fps, fps, config: { damping, stiffness, mass } });

/** 0 → 1 during the last `sec` seconds (exit progress). */
const exitP = (frame: number, dur: number, fps: number, sec = 0.35) =>
  interpolate(frame, [dur - sec * fps, dur], [0, 1], { ...CLAMP, easing: Easing.in(Easing.cubic) });

/** Size unit: 1 at 1080×1920, shrinks for square / landscape so things never overflow vertically. */
const unit = (w: number, h: number) => Math.min(w / 1080, h / 1350);

const lines = (t: unknown) =>
  String(t ?? '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

const hexRgb = (c: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: string, b: string, t: number) => {
  const A = hexRgb(a);
  const B = hexRgb(b);
  if (!A || !B) return a;
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
};
/** `base` (hex or rgb()) with `rgb` composited on top at opacity `a`, as an opaque color. */
const over = (base: string, rgb: [number, number, number], a: number) => {
  const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(base.trim());
  const B = hexRgb(base) ?? (m ? ([Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number]) : null);
  return B ? `rgb(${B.map((v, i) => Math.round(v + (rgb[i] - v) * a)).join(',')})` : base;
};
const alpha = (c: string, a: number) => {
  const A = hexRgb(c);
  return A ? `rgba(${A.join(',')},${a})` : c;
};
const lum = (c: string) => {
  const A = hexRgb(c);
  if (!A) return 0.5;
  const [r, g, b] = A.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** The accent, darkened enough to read on a light surface. */
const inkAccent = (accent: string) => {
  const L = lum(accent);
  if (L > 0.8) return '#2A2226';
  if (L > 0.15) return mix(accent, '#2A1A22', Math.min(0.6, (L - 0.1) * 1.2));
  return accent;
};
/** The accent, guaranteed visible as a fill on white. */
const solidAccent = (accent: string) => (lum(accent) > 0.82 ? '#1E1A1C' : accent);
/** Text color that reads on top of a fill. */
const onColor = (fill: string) => (lum(fill) > 0.42 ? '#1E1A1C' : '#FFFFFF');

const fmtThousands = (n: number) => String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Style for a VideoCopy so that a cw×ch container shows the composition `zoom`× around
 * (fx, fy) (fractions of the frame), always covering the container.
 */
const focusBox = (cw: number, ch: number, W: number, H: number, zoom = 1, fx = 0.5, fy = 0.4): React.CSSProperties => {
  const k = Math.max(cw / W, ch / H) * zoom;
  const bw = W * k;
  const bh = H * k;
  const left = Math.min(0, Math.max(cw - bw, cw / 2 - fx * bw));
  const top = Math.min(0, Math.max(ch - bh, ch / 2 - fy * bh));
  return { left, top, width: bw, height: bh, right: 'auto', bottom: 'auto' };
};

// 24×24 icon paths.
const ICON = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  heart: 'M12 20.5s-7.6-4.6-9.5-9.3C1.1 7.6 3.3 4 7 4c2.1 0 3.5 1.1 5 3 1.5-1.9 2.9-3 5-3 3.7 0 5.9 3.6 4.5 7.2-1.9 4.7-9.5 9.3-9.5 9.3z',
  comment: 'M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-4.6A8.5 8.5 0 1 1 20.5 11.5z',
  send: 'M21.5 3 10.5 14M21.5 3l-6.8 18.5-4.2-7.5L3 9.8z',
  bookmark: 'M6.5 3.5h11v17l-5.5-4.2-5.5 4.2z',
  sparkle: 'M12 1.5c.7 5.6 2.6 8.7 10.5 10.5-7.9 1.8-9.8 4.9-10.5 10.5-.7-5.6-2.6-8.7-10.5-10.5C9.4 10.2 11.3 7.1 12 1.5z',
  up: 'M12 19V5.5M5.5 11.5 12 5l6.5 6.5',
  play: 'M8 5.5v13l10.5-6.5z',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  home: 'M3.5 10.5 12 3.5l8.5 7V20.5h-5.5v-6h-6v6H3.5z',
  search: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20.5 20.5l-5-5',
  plus: 'M4 4h16v16H4zM12 8v8M8 12h8',
  reels: 'M4 4h16v16H4zM4 9h16M9.5 4l2.5 5M15 4l2.5 5M10.5 12.5v5l4-2.5z',
  grid: 'M3.5 3.5h17v17h-17zM3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17',
  tag: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1.4-3.7 4.2-5.6 7.5-5.6s6.1 1.9 7.5 5.6',
  clip: 'M4 6.5h11.5v11H4zM15.5 10.5l4.5-2.5v8l-4.5-2.5',
};

const Icon: React.FC<{ d: string; size: number; color: string; fill?: boolean; sw?: number; style?: React.CSSProperties }> = ({ d, size, color, fill, sw = 2, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', overflow: 'visible', flexShrink: 0, ...style }}>
    <path d={d} fill={fill ? color : 'none'} stroke={fill ? 'none' : color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Round check badge: circle that pops with a check that draws itself. */
const CheckBadge: React.FC<{ size: number; p: number; color: string; ring?: string }> = ({ size, p, color, ring }) => {
  const draw = clamp01((p - 0.35) / 0.6);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}>
      {ring ? <circle cx={24} cy={24} r={21} fill="none" stroke={ring} strokeWidth={3} opacity={1 - clamp01(p)} /> : null}
      <circle cx={24} cy={24} r={Math.max(0, 22.5 * p)} fill={color} />
      <path
        d="M14 24.5l6.5 6.5L34 17.5"
        fill="none"
        stroke={onColor(color)}
        strokeWidth={4.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
      />
    </svg>
  );
};

// ===========================================================================
// 1. Phone mock-up (ref1 #03)
// ===========================================================================

type PhoneProps = { handle: string; stats: string; side: string };

const STAT_LABELS = ['posts', 'seguidores', 'seguindo'];

const PhoneMockup: React.FC<EffectRenderProps<PhoneProps>> = ({ props, frame, fps, durationInFrames, width, height, style, VideoCopy }) => {
  const phoneW = Math.min(width * 0.37, (height * 0.64) / 2.05);
  const phoneH = phoneW * 2.05;
  const u = phoneW / 390;
  const right = props.side !== 'left';
  const dir = right ? 1 : -1;
  const margin = width * 0.06;
  const x = right ? width - margin - phoneW : margin;
  const y = height * 0.48 - phoneH / 2;
  const t = frame / fps;

  const enter = springAt(frame, fps, 0, 15, 110, 0.9);
  const ex = exitP(frame, durationInFrames, fps, 0.4);
  const tx = dir * ((1 - enter) * (phoneW + margin * 2.5) + ex * (phoneW + margin * 2));
  const rot = dir * (-4 + (1 - enter) * 16 + ex * 8) + Math.sin(t * 2.1) * 0.6;
  const bob = Math.sin(t * 2.4) * 5 * u;

  const ui = fontFamily(style.captionFont);
  const accent = style.colors.accent;
  const btnFill = solidAccent(accent) === accent ? accent : '#FFFFFF';
  const screenBg = '#0F0E11';
  const sw = 368 * u; // screen width
  const sh = phoneH - 22 * u;

  // Stats count up; following adds one follower.
  const followAt = Math.min(1.2, (durationInFrames / fps) * 0.45);
  const followed = frame >= followAt * fps;
  const press = interpolate(frame, [(followAt - 0.1) * fps, followAt * fps, (followAt + 0.14) * fps], [0, 1, 0], CLAMP);
  const tap = ramp(frame, fps, followAt - 0.05, 0.4);
  const parts = String(props.stats ?? '')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
  while (parts.length < 3) parts.push('0');
  const count = ramp(frame, fps, 0.15, 0.9);
  const statText = (raw: string, i: number) => {
    if (!/^(\d{1,3}(\.\d{3})+|\d+)$/.test(raw)) return raw;
    const n = Number(raw.replace(/\./g, ''));
    return fmtThousands(n * count + (i === 1 && followed ? 1 : 0));
  };

  const tileW = (sw - 6 * u) / 3;
  const tileH = tileW * 1.36;
  const gridTop = 318 * u;
  const tileIn = (i: number) => springAt(frame, fps, 0.3 + i * 0.07, 14, 160);

  const videoTile = (zoom: number, fx: number, fy: number, filter: string): React.ReactNode => (
    <>
      <VideoCopy style={{ ...focusBox(tileW, tileH, width, height, zoom, fx, fy), filter }} />
      <div style={{ position: 'absolute', right: 8 * u, top: 8 * u }}>
        <Icon d={ICON.play} size={18 * u} color="#fff" fill style={{ filter: `drop-shadow(0 ${1 * u}px ${3 * u}px rgba(0,0,0,0.5))` }} />
      </div>
    </>
  );
  const tiles: React.ReactNode[] = [
    videoTile(1, 0.5, 0.42, 'none'),
    <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(150deg, ${accent}, ${mix(accent, '#1A1418', 0.55)})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: fontFamily(style.titleFont), color: onColor(accent), fontSize: 30 * u, fontWeight: 700, lineHeight: 1, textAlign: 'center' }}>
        3<br />
        <span style={{ fontSize: 17 * u }}>dicas</span>
      </div>
    </div>,
    videoTile(1.7, 0.5, 0.36, 'grayscale(1) contrast(1.1)'),
    <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(200deg, ${mix(style.colors.secondary, '#ffffff', 0.2)}, ${mix(style.colors.secondary, accent, 0.5)})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon d={ICON.play} size={34 * u} color={alpha('#ffffff', 0.9)} fill />
    </div>,
    videoTile(1.25, 0.5, 0.62, 'sepia(0.35) saturate(1.3)'),
    <div style={{ position: 'absolute', inset: 0, backgroundColor: '#1D1A20', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 * u }}>
      <div style={{ fontFamily: fontFamily(style.accentFont), fontStyle: 'italic', color: accent, fontSize: 19 * u, lineHeight: 1.1, textAlign: 'center' }}>“uma ideia por vídeo”</div>
    </div>,
  ];

  const handle = String(props.handle || '@seuperfil');

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: phoneW,
          height: phoneH,
          transform: `translate(${tx}px, ${bob}px) rotate(${rot}deg)`,
          opacity: 1 - ex * 0.6,
        }}
      >
        {/* Side buttons */}
        <div style={{ position: 'absolute', left: -3 * u, top: 150 * u, width: 4 * u, height: 54 * u, borderRadius: 2 * u, backgroundColor: '#2a2a2e' }} />
        <div style={{ position: 'absolute', left: -3 * u, top: 216 * u, width: 4 * u, height: 54 * u, borderRadius: 2 * u, backgroundColor: '#2a2a2e' }} />
        <div style={{ position: 'absolute', right: -3 * u, top: 190 * u, width: 4 * u, height: 84 * u, borderRadius: 2 * u, backgroundColor: '#2a2a2e' }} />
        {/* Body */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 60 * u,
            backgroundImage: 'linear-gradient(145deg, #3a3a40 0%, #141417 40%, #0a0a0c 100%)',
            border: `${2 * u}px solid rgba(255,255,255,0.22)`,
            boxShadow: `0 ${30 * u}px ${70 * u}px rgba(0,0,0,0.5), 0 ${6 * u}px ${18 * u}px rgba(0,0,0,0.35)`,
          }}
        />
        {/* Screen */}
        <div
          style={{
            position: 'absolute',
            left: 11 * u,
            top: 11 * u,
            width: sw,
            height: sh,
            borderRadius: 50 * u,
            overflow: 'hidden',
            backgroundColor: screenBg,
            fontFamily: ui,
            color: '#fff',
          }}
        >
          {/* Status bar + island */}
          <div style={{ position: 'absolute', left: 30 * u, top: 17 * u, fontSize: 15 * u, fontWeight: 700 }}>9:41</div>
          <div style={{ position: 'absolute', left: sw / 2 - 52 * u, top: 11 * u, width: 104 * u, height: 30 * u, borderRadius: 15 * u, backgroundColor: '#000' }} />
          <div style={{ position: 'absolute', right: 26 * u, top: 20 * u, display: 'flex', alignItems: 'flex-end', gap: 2 * u }}>
            {[5, 7, 9, 11].map((hh, i) => (
              <div key={i} style={{ width: 3 * u, height: hh * u, borderRadius: 1 * u, backgroundColor: '#fff' }} />
            ))}
            <div style={{ marginLeft: 5 * u, width: 22 * u, height: 11 * u, borderRadius: 3 * u, border: `${1.2 * u}px solid rgba(255,255,255,0.7)`, padding: 1.5 * u, boxSizing: 'border-box' }}>
              <div style={{ width: '75%', height: '100%', borderRadius: 1.5 * u, backgroundColor: '#fff' }} />
            </div>
          </div>
          {/* Top bar: handle */}
          <div style={{ position: 'absolute', left: 18 * u, right: 18 * u, top: 52 * u, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 19 * u, fontWeight: 700, letterSpacing: -0.2 * u }}>{handle.replace(/^@/, '')}</div>
            <Icon d={ICON.dots} size={22 * u} color="#fff" sw={3} />
          </div>
          {/* Avatar + stats */}
          <div style={{ position: 'absolute', left: 16 * u, top: 90 * u, width: 86 * u, height: 86 * u, borderRadius: '50%', padding: 3 * u, boxSizing: 'border-box', backgroundImage: `linear-gradient(135deg, ${accent}, ${mix(accent, '#ffffff', 0.5)})` }}>
            <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: `${3 * u}px solid ${screenBg}`, boxSizing: 'border-box', backgroundColor: '#222' }}>
              <VideoCopy style={focusBox(74 * u, 74 * u, width, height, 2.1, 0.5, 0.33)} />
            </div>
          </div>
          <div style={{ position: 'absolute', left: 112 * u, right: 10 * u, top: 104 * u, display: 'flex', justifyContent: 'space-around' }}>
            {parts.map((p, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 22 * u, fontWeight: 700, lineHeight: 1.1, transform: i === 1 && followed ? `scale(${1 + 0.15 * press})` : undefined }}>{statText(p, i)}</div>
                <div style={{ fontSize: 12.5 * u, opacity: 0.65, marginTop: 3 * u }}>{STAT_LABELS[i]}</div>
              </div>
            ))}
          </div>
          {/* Name + bio */}
          <div style={{ position: 'absolute', left: 18 * u, right: 18 * u, top: 186 * u }}>
            <div style={{ fontSize: 15 * u, fontWeight: 700 }}>{handle}</div>
            <div style={{ fontSize: 13 * u, opacity: 0.7, marginTop: 3 * u }}>vídeos curtos · ideias · bastidores</div>
          </div>
          {/* Buttons */}
          <div style={{ position: 'absolute', left: 16 * u, right: 16 * u, top: 236 * u, height: 34 * u, display: 'flex', gap: 7 * u }}>
            <div
              style={{
                position: 'relative',
                flex: 1,
                borderRadius: 9 * u,
                backgroundColor: followed ? '#2A2830' : btnFill,
                color: followed ? '#fff' : onColor(btnFill),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5 * u,
                fontSize: 14 * u,
                fontWeight: 700,
                transform: `scale(${1 - 0.07 * press})`,
                overflow: 'hidden',
              }}
            >
              {followed ? <Icon d={ICON.check} size={14 * u} color="#fff" sw={3} /> : null}
              {followed ? 'Seguindo' : 'Seguir'}
            </div>
            <div style={{ flex: 1, borderRadius: 9 * u, backgroundColor: '#2A2830', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 * u, fontWeight: 700 }}>Mensagem</div>
          </div>
          {/* Tap ripple on "Seguir" */}
          {tap > 0 && tap < 1 ? (
            <div
              style={{
                position: 'absolute',
                left: 16 * u + (sw - 39 * u) / 4 - 24 * u,
                top: 253 * u - 24 * u,
                width: 48 * u,
                height: 48 * u,
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.55)',
                transform: `scale(${0.3 + tap * 1.4})`,
                opacity: 0.8 * (1 - tap),
              }}
            />
          ) : null}
          {/* Tabs */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: gridTop - 33 * u, display: 'flex' }}>
            {[ICON.grid, ICON.reels, ICON.tag].map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: i === 0 ? 1 : 0.45 }}>
                <Icon d={d} size={19 * u} color="#fff" sw={1.8} />
                <div style={{ marginTop: 6 * u, width: '60%', height: 2 * u, backgroundColor: i === 0 ? '#fff' : 'transparent' }} />
              </div>
            ))}
          </div>
          {/* 3×2 grid */}
          {tiles.map((node, i) => {
            const p = tileIn(i);
            const col = i % 3;
            const row = Math.floor(i / 3);
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: col * (tileW + 3 * u),
                  top: gridTop + row * (tileH + 3 * u),
                  width: tileW,
                  height: tileH,
                  overflow: 'hidden',
                  backgroundColor: '#1a191d',
                  opacity: clamp01(p * 1.4),
                  transform: `scale(${0.82 + 0.18 * p})`,
                }}
              >
                {node}
              </div>
            );
          })}
          {/* Bottom nav */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 78 * u,
              backgroundColor: screenBg,
              borderTop: `${1 * u}px solid rgba(255,255,255,0.08)`,
              display: 'flex',
              justifyContent: 'space-around',
              paddingTop: 14 * u,
              boxSizing: 'border-box',
            }}
          >
            {[ICON.home, ICON.search, ICON.plus, ICON.reels].map((d, i) => (
              <Icon key={i} d={d} size={23 * u} color="#fff" sw={1.9} />
            ))}
            <div style={{ width: 24 * u, height: 24 * u, borderRadius: '50%', border: `${2 * u}px solid #fff`, boxSizing: 'border-box', backgroundImage: `linear-gradient(135deg, ${accent}, ${mix(accent, '#000000', 0.3)})` }} />
          </div>
          <div style={{ position: 'absolute', left: sw / 2 - 60 * u, bottom: 8 * u, width: 120 * u, height: 5 * u, borderRadius: 3 * u, backgroundColor: 'rgba(255,255,255,0.85)' }} />
          {/* Screen glare */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(125deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 32%)' }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===========================================================================
// 2. Checklist (ref1 #04)
// ===========================================================================

type ChecklistProps = { title: string; items: string; strike: boolean };

const Checklist: React.FC<EffectRenderProps<ChecklistProps>> = ({ props, frame, fps, durationInFrames, width, height, style, VideoCopy }) => {
  const cardW = Math.min(width * 0.84, height * 0.62);
  const u = cardW / 900;
  let items = lines(props.items).slice(0, 6);
  if (!items.length) items = ['Primeiro passo'];
  const n = items.length;
  const pad = 42 * u;
  const header = 66 * u;
  const rowH = 90 * u;
  const cardH = pad * 2 + header + rowH * n - 12 * u;
  const cardX = (width - cardW) / 2;
  const cardY = height * 0.11;
  const accent = style.colors.accent;
  const ui = fontFamily(style.captionFont);

  const enter = springAt(frame, fps, 0, 16, 140);
  const ex = exitP(frame, durationInFrames, fps, 0.35);
  const ty = (1 - enter) * -70 * u - ex * 60 * u;

  const durSec = durationInFrames / fps;
  const start = 0.6;
  const end = Math.max(start, durSec - 0.95);
  const step = n > 1 ? Math.min(0.75, (end - start) / (n - 1)) : 0;
  const checkAt = (i: number) => start + i * step;
  const done = items.filter((_, i) => frame >= checkAt(i) * fps).length;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: cardX,
          top: cardY,
          width: cardW,
          height: cardH,
          borderRadius: 42 * u,
          overflow: 'hidden',
          border: `${2 * u}px solid rgba(255,255,255,0.32)`,
          boxShadow: `0 ${24 * u}px ${60 * u}px rgba(0,0,0,0.35)`,
          transform: `translateY(${ty}px) scale(${0.94 + 0.06 * enter})`,
          opacity: clamp01(enter * 1.6) * (1 - ex),
          fontFamily: ui,
        }}
      >
        {/* Frosted glass: blurred copy of the footage behind a translucent tint. */}
        <VideoCopy style={{ left: -cardX, top: -cardY - ty, width, height, right: 'auto', bottom: 'auto', filter: `blur(${26 * u}px) brightness(0.72) saturate(1.25)` }} />
        <AbsoluteFill style={{ backgroundColor: 'rgba(26,22,25,0.38)' }} />
        <AbsoluteFill style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0) 100%)' }} />
        <div style={{ position: 'absolute', left: pad, right: pad, top: pad }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: header - 18 * u, color: 'rgba(255,255,255,0.72)', fontSize: 24 * u, fontWeight: 700, letterSpacing: 4 * u, textTransform: 'uppercase' }}>
            <span>{props.title}</span>
            <span style={{ letterSpacing: 1 * u, color: done ? accent : 'rgba(255,255,255,0.6)' }}>
              {done} de {n}
            </span>
          </div>
          {items.map((it, i) => {
            const rowIn = springAt(frame, fps, 0.12 + i * 0.07, 16, 160);
            const c = springAt(frame, fps, checkAt(i), 11, 190);
            const strikeP = ramp(frame, fps, checkAt(i) + 0.1, 0.3);
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 26 * u,
                  height: rowH,
                  opacity: clamp01(rowIn * 1.5),
                  transform: `translateY(${(1 - rowIn) * 18 * u}px)`,
                }}
              >
                <CheckBadge size={48 * u} p={c} color={accent} ring="rgba(255,255,255,0.6)" />
                <div style={{ position: 'relative', fontSize: 40 * u, fontWeight: 600, color: '#fff', opacity: 0.62 + 0.38 * clamp01(c), whiteSpace: 'nowrap', overflow: 'visible' }}>
                  {it}
                  {props.strike ? (
                    <div style={{ position: 'absolute', left: -4 * u, top: '54%', height: 3.5 * u, width: `calc(${strikeP * 100}% + ${8 * u * strikeP}px)`, backgroundColor: accent, borderRadius: 2 * u }} />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===========================================================================
// 3. UI world (ref1 #06)
// ===========================================================================

type UiProps = { text: string; label: string };

const UiWorld: React.FC<EffectRenderProps<UiProps>> = ({ props, frame, fps, durationInFrames, width, height, style, word, VideoCopy }) => {
  const cardW = Math.min(width * 0.86, height * 0.6);
  const u = cardW / 900;
  const x = (width - cardW) / 2;
  const top = height * 0.09;
  const pad = 26 * u;
  const thumbGap = 14 * u;
  const thumbW = (cardW - pad * 2 - thumbGap * 3) / 4;
  const thumbH = 128 * u;
  const cardAH = pad + 52 * u + 20 * u + thumbH + pad;
  const cardBH = 100 * u;
  const gap = 16 * u;
  const ink = '#1D1A1C';
  const accent = style.colors.accent;
  const fill = solidAccent(accent);
  const ui = fontFamily(style.captionFont);
  const t = frame / fps;

  const dropA = springAt(frame, fps, 0, 15, 120);
  const dropB = springAt(frame, fps, 0.16, 15, 120);
  const exA = exitP(frame, durationInFrames, fps, 0.4);
  const exB = interpolate(frame, [durationInFrames - 0.5 * fps, durationInFrames - 0.1 * fps], [0, 1], { ...CLAMP, easing: Easing.in(Easing.cubic) });
  const offA = (1 - dropA) * -(top + cardAH + 60 * u) - exA * (top + cardAH + 60 * u);
  const offB = (1 - dropB) * -(top + cardAH + cardBH + 80 * u) - exB * (top + cardAH + cardBH + 80 * u);

  const typed = String(props.text || word || 'editar');
  const typeStart = 0.7;
  const cps = Math.max(14, typed.length / 1.1);
  const shown = Math.max(0, Math.min(typed.length, Math.floor((t - typeStart) * cps)));
  const doneAt = typeStart + typed.length / cps;
  const typing = t >= typeStart && t < doneAt;
  const caretOn = typing || Math.floor(t * 2.4) % 2 === 0;
  const after = t - doneAt;
  const pulse = after > 0 ? (after % 0.75) / 0.75 : 0;
  const sendPress = interpolate(t, [doneAt + 0.55, doneAt + 0.62, doneAt + 0.78], [0, 1, 0], CLAMP);
  const sendReady = ramp(frame, fps, doneAt - 0.1, 0.2);
  const badge = springAt(frame, fps, 0.28, 11, 190);
  const durations = ['0:04', '0:12', '0:07', '0:09'];
  const looks: Array<[number, number, number, string]> = [
    [1, 0.5, 0.42, 'none'],
    [1.6, 0.5, 0.35, 'saturate(1.2)'],
    [1.2, 0.35, 0.55, 'grayscale(0.9)'],
    [1.4, 0.62, 0.45, 'sepia(0.3) saturate(1.2)'],
  ];

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', fontFamily: ui }}>
      {/* Card A: upload status + clips */}
      <div
        style={{
          position: 'absolute',
          left: x,
          top,
          width: cardW,
          height: cardAH,
          borderRadius: 30 * u,
          backgroundColor: '#FFFFFF',
          boxShadow: `0 ${22 * u}px ${50 * u}px rgba(0,0,0,0.28)`,
          transform: `translateY(${offA}px)`,
          color: ink,
        }}
      >
        <div style={{ position: 'absolute', left: pad, right: pad, top: pad, height: 52 * u, borderRadius: 16 * u, backgroundColor: '#F4F2F3', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 * u }}>
          <CheckBadge size={30 * u} p={badge} color={fill} />
          <span style={{ fontSize: 26 * u, fontWeight: 600 }}>{props.label}</span>
        </div>
        <div style={{ position: 'absolute', left: pad, top: pad + 52 * u + 20 * u, display: 'flex', gap: thumbGap }}>
          {looks.map(([z, fx, fy, filter], i) => {
            const p = springAt(frame, fps, 0.3 + i * 0.1, 13, 180);
            const load = ramp(frame, fps, 0.3 + i * 0.1, 0.45);
            return (
              <div
                key={i}
                style={{
                  position: 'relative',
                  width: thumbW,
                  height: thumbH,
                  borderRadius: 16 * u,
                  overflow: 'hidden',
                  backgroundColor: '#E8E5E7',
                  transform: `scale(${0.7 + 0.3 * p})`,
                  opacity: clamp01(p * 1.5),
                }}
              >
                <VideoCopy style={{ ...focusBox(thumbW, thumbH, width, height, z, fx, fy), filter }} />
                <div style={{ position: 'absolute', left: 8 * u, bottom: 8 * u, padding: `${2 * u}px ${8 * u}px`, borderRadius: 8 * u, backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 15 * u, fontWeight: 600 }}>{durations[i]}</div>
                {load < 1 ? <div style={{ position: 'absolute', left: 0, bottom: 0, height: 5 * u, width: `${load * 100}%`, backgroundColor: fill }} /> : null}
              </div>
            );
          })}
        </div>
      </div>
      {/* Card B: prompt bar */}
      <div
        style={{
          position: 'absolute',
          left: x,
          top: top + cardAH + gap,
          width: cardW,
          height: cardBH,
          borderRadius: 30 * u,
          backgroundColor: '#FFFFFF',
          boxShadow: `0 ${22 * u}px ${50 * u}px rgba(0,0,0,0.28)`,
          transform: `translateY(${offB}px)`,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 32 * u,
          paddingRight: 18 * u,
          boxSizing: 'border-box',
          color: ink,
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: 34 * u, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {shown === 0 && t < typeStart ? <span style={{ color: '#A8A2A6', marginRight: 2 * u }}>Escreva um comando…</span> : <span>{typed.slice(0, shown)}</span>}
          <div style={{ width: 3 * u, height: 40 * u, marginLeft: 3 * u, backgroundColor: fill, opacity: caretOn ? 1 : 0, order: shown === 0 && t < typeStart ? -1 : 0 }} />
        </div>
        <div style={{ position: 'relative', width: 64 * u, height: 64 * u }}>
          {after > 0 ? (
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `${3 * u}px solid ${fill}`, transform: `scale(${1 + pulse * 0.75})`, opacity: 0.6 * (1 - pulse) }} />
          ) : null}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              backgroundColor: sendReady > 0.5 ? fill : '#E6E2E4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${(1 + (after > 0 ? 0.05 * Math.sin(after * 8) : 0)) * (1 - 0.14 * sendPress)})`,
            }}
          >
            <Icon d={ICON.up} size={30 * u} color={sendReady > 0.5 ? onColor(fill) : '#9C969A'} sw={2.8} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===========================================================================
// 4. Chat messages (Remotion Elements · On-Screen Messages)
// ===========================================================================

type ChatProps = { messages: string; position: string };

const TAIL_THEM = 'M32 0H12v16c0 8-4 13-12 16 18 0 32-7 32-16Z';
const TAIL_ME = 'M0 0h20v16c0 8 4 13 12 16C14 32 0 25 0 16Z';

const ChatMessages: React.FC<EffectRenderProps<ChatProps>> = ({ props, frame, fps, durationInFrames, width, height, style }) => {
  const u = unit(width, height);
  const t = frame / fps;
  const accent = style.colors.accent;
  const meText = onColor(accent);
  const themBg = '#E9E8EC';
  const ui = fontFamily(style.captionFont);
  const raw = lines(props.messages).slice(0, 5);
  const msgs = (raw.length ? raw : ['Oi!']).map((l) => ({ me: l.startsWith('>'), text: l.replace(/^>\s*/, '') }));
  const ex = exitP(frame, durationInFrames, fps, 0.35);
  const durSec = durationInFrames / fps;

  // Schedule: "them" messages get a short typing indicator first.
  const typingSec = 0.42;
  const typingCount = msgs.filter((m) => !m.me).length;
  const gap = Math.max(0.22, Math.min(0.6, (durSec - 1.1 - typingCount * typingSec) / Math.max(1, msgs.length)));
  let clock = 0.05;
  const sched = msgs.map((m) => {
    const typingFrom = clock;
    if (!m.me) clock += typingSec;
    const at = clock;
    clock += gap;
    return { ...m, typingFrom, at };
  });

  const side = width * 0.08;
  const maxW = Math.min(width * 0.68, 740 * u);
  const font = 42 * u;
  const bubbleShadow = `drop-shadow(0 ${6 * u}px ${14 * u}px rgba(0,0,0,0.25))`;
  const lastMe = sched.reduce((acc, m, i) => (m.me && t >= m.at ? i : acc), -1);
  const posTop = props.position === 'bottom' ? undefined : height * (props.position === 'middle' ? 0.36 : 0.12);
  const posBottom = props.position === 'bottom' ? height * 0.3 : undefined;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: 1 - ex }}>
      <div
        style={{
          position: 'absolute',
          left: side,
          right: side,
          top: posTop,
          bottom: posBottom,
          display: 'flex',
          flexDirection: 'column',
          gap: 18 * u,
          fontFamily: ui,
          transform: `translateY(${-ex * 30 * u}px)`,
        }}
      >
        {sched.map((m, i) => {
          const typingOn = !m.me && t >= m.typingFrom && t < m.at;
          if (t < m.typingFrom || (m.me && t < m.at)) return null;
          const p = interpolate(frame, [m.at * fps, (m.at + 0.3) * fps], [0, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) });
          const pop = springAt(frame, fps, m.at, 12, 200);
          const bg = m.me ? accent : themBg;
          const color = m.me ? meText : '#141316';
          // Older messages step back a little (focus shift).
          const newer = sched.filter((o, j) => j > i && t >= o.at).length;
          const dim = 1 - Math.min(0.2, newer * 0.08);
          if (typingOn) {
            const tp = springAt(frame, fps, m.typingFrom, 14, 200);
            return (
              <div key={i} style={{ alignSelf: 'flex-start', position: 'relative', marginLeft: 12 * u, transform: `scale(${0.6 + 0.4 * tp})`, transformOrigin: '0% 100%', opacity: clamp01(tp * 1.5), filter: bubbleShadow }}>
                {/* Tail first: the MP4 exporter ignores zIndex and paints in DOM order. */}
                <svg width={32 * u} height={32 * u} viewBox="0 0 32 32" style={{ position: 'absolute', left: -12 * u, bottom: 0 }}>
                  <path d={TAIL_THEM} fill={themBg} />
                </svg>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 9 * u, padding: `${24 * u}px ${30 * u}px`, borderRadius: 40 * u, backgroundColor: themBg }}>
                  {[0, 1, 2].map((k) => {
                    const w = Math.sin((t - m.typingFrom) * 9 - k * 0.9);
                    return <div key={k} style={{ width: 14 * u, height: 14 * u, borderRadius: '50%', backgroundColor: '#8E8C93', opacity: 0.45 + 0.4 * Math.max(0, w), transform: `translateY(${-Math.max(0, w) * 5 * u}px)` }} />;
                  })}
                </div>
              </div>
            );
          }
          return (
            <div
              key={i}
              style={{
                alignSelf: m.me ? 'flex-end' : 'flex-start',
                position: 'relative',
                maxWidth: maxW,
                marginLeft: m.me ? 0 : 12 * u,
                marginRight: m.me ? 12 * u : 0,
                opacity: p,
                filter: `${bubbleShadow} brightness(${dim})`,
                transform: `translateY(${(1 - p) * 32 * u}px) scale(${0.85 + 0.15 * pop})`,
                transformOrigin: m.me ? '100% 100%' : '0% 100%',
              }}
            >
              {/* Tail first: the MP4 exporter ignores zIndex and paints in DOM order. */}
              <svg width={32 * u} height={32 * u} viewBox="0 0 32 32" style={{ position: 'absolute', bottom: 0, left: m.me ? undefined : -12 * u, right: m.me ? -12 * u : undefined }}>
                <path d={m.me ? TAIL_ME : TAIL_THEM} fill={bg} />
              </svg>
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  backgroundColor: bg,
                  color,
                  fontSize: font,
                  lineHeight: 1.25,
                  padding: `${17 * u}px ${30 * u}px`,
                  borderRadius: 38 * u,
                }}
              >
                {m.text}
              </div>
              {m.me && i === lastMe ? (
                <div style={{ position: 'absolute', right: 6 * u, top: '100%', marginTop: 6 * u, fontSize: 20 * u, fontWeight: 600, color: 'rgba(255,255,255,0.85)', textShadow: `0 ${1 * u}px ${6 * u}px rgba(0,0,0,0.5)`, opacity: ramp(frame, fps, m.at + 0.35, 0.25) }}>Lida</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ===========================================================================
// 5. Frame break (ref2 #08)
// ===========================================================================

type FrameProps = { handle: string; likes: string; comments: string; breakTop: boolean };

const frameRect = (width: number, height: number) => {
  const fw = Math.min(width * 0.82, height * 0.78 * 0.8);
  const fh = fw * 1.25;
  const left = (width - fw) / 2;
  const top = height * 0.5 - fh / 2 + height * 0.01;
  return { fw, fh, left, top, right: left + fw, bottom: top + fh };
};

const FrameBreak: React.FC<EffectRenderProps<FrameProps>> = ({ props, frame, fps, durationInFrames, width, height, style, VideoCopy }) => {
  const u = unit(width, height);
  const { fw, left, top, right, bottom } = frameRect(width, height);
  const r = 46 * u;
  const accent = style.colors.accent;
  const ui = fontFamily(style.captionFont);
  const draw = ramp(frame, fps, 0, 0.6, Easing.inOut(Easing.cubic));
  const ex = exitP(frame, durationInFrames, fps, 0.35);
  const vis = 1 - ex;
  const chrome = ramp(frame, fps, 0.3, 0.35);
  const likeAt = Math.min(1.1, (durationInFrames / fps) * 0.4);
  const liked = frame >= likeAt * fps;
  const likePop = springAt(frame, fps, likeAt, 9, 220);
  const burst = ramp(frame, fps, likeAt, 0.5);

  // Border with a gap at the top where the head breaks out of the frame.
  const gapL = props.breakTop ? width * 0.35 : left + fw / 2;
  const gapR = props.breakTop ? width * 0.65 : left + fw / 2;
  const d = [
    `M ${gapR} ${top}`,
    `H ${right - r}`,
    `A ${r} ${r} 0 0 1 ${right} ${top + r}`,
    `V ${bottom - r}`,
    `A ${r} ${r} 0 0 1 ${right - r} ${bottom}`,
    `H ${left + r}`,
    `A ${r} ${r} 0 0 1 ${left} ${bottom - r}`,
    `V ${top + r}`,
    `A ${r} ${r} 0 0 1 ${left + r} ${top}`,
    `H ${gapL}`,
  ].join(' ');

  const likesRaw = String(props.likes ?? '');
  const likesNum = /^(\d{1,3}(\.\d{3})+|\d+)$/.test(likesRaw) ? Number(likesRaw.replace(/\./g, '')) : null;
  const likesText = likesNum === null ? likesRaw : fmtThousands(likesNum + (liked ? 1 : 0));
  const dim = 0.3 * draw * vis;
  const sideDim = `linear-gradient(180deg, rgba(0,0,0,0) 0px, rgba(0,0,0,${dim}) ${r * 3}px, rgba(0,0,0,${dim}) 100%)`;
  const shadow = `drop-shadow(0 ${2 * u}px ${6 * u}px rgba(0,0,0,0.45))`;
  const handle = String(props.handle || '@seuperfil');

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* Soft dim outside the frame (left, right, bottom; fades out towards the head at the top). */}
      <div style={{ position: 'absolute', left: 0, top, width: left, bottom: 0, backgroundImage: sideDim }} />
      <div style={{ position: 'absolute', left: right, top, right: 0, bottom: 0, backgroundImage: sideDim }} />
      <div style={{ position: 'absolute', left, top: bottom, width: fw, bottom: 0, backgroundColor: `rgba(0,0,0,${dim})` }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width, height: top, backgroundImage: `linear-gradient(180deg, rgba(0,0,0,${dim * 0.8}) 0%, rgba(0,0,0,0) 100%)` }} />
      {/* Legibility bands inside the frame */}
      <div style={{ position: 'absolute', left, top: bottom - 170 * u, width: fw, height: 170 * u, borderRadius: `0 0 ${r}px ${r}px`, backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 100%)', opacity: chrome * vis }} />
      {/* The frame */}
      <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: vis, filter: shadow }}>
        <path d={d} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={3.6 * u} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
      </svg>
      {/* Header: avatar + handle */}
      <div
        style={{
          position: 'absolute',
          left: left + 26 * u,
          top: top + 24 * u,
          display: 'flex',
          alignItems: 'center',
          gap: 14 * u,
          opacity: chrome * vis,
          transform: `translateY(${(1 - chrome) * 14 * u}px)`,
          fontFamily: ui,
        }}
      >
        <div style={{ width: 62 * u, height: 62 * u, borderRadius: '50%', padding: 3 * u, boxSizing: 'border-box', backgroundImage: `linear-gradient(135deg, ${accent}, ${mix(accent, '#ffffff', 0.5)})` }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: `${2.5 * u}px solid #fff`, boxSizing: 'border-box', backgroundColor: '#333' }}>
            <VideoCopy style={focusBox(51 * u, 51 * u, width, height, 2.1, 0.5, 0.33)} />
          </div>
        </div>
        <div style={{ color: '#fff', fontSize: 30 * u, fontWeight: 700, textShadow: `0 ${2 * u}px ${10 * u}px rgba(0,0,0,0.55)` }}>{handle}</div>
      </div>
      {/* Footer: like / comment / share / save */}
      <div
        style={{
          position: 'absolute',
          left: left + 30 * u,
          right: width - right + 30 * u,
          top: bottom - 82 * u,
          display: 'flex',
          alignItems: 'center',
          gap: 30 * u,
          color: '#fff',
          fontFamily: ui,
          fontSize: 28 * u,
          fontWeight: 600,
          opacity: chrome * vis,
          transform: `translateY(${(1 - chrome) * 14 * u}px)`,
          textShadow: `0 ${2 * u}px ${8 * u}px rgba(0,0,0,0.5)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 * u }}>
          <div style={{ position: 'relative' }}>
            {burst > 0 && burst < 1 ? (
              <div style={{ position: 'absolute', left: -18 * u, top: -18 * u, width: 80 * u, height: 80 * u, borderRadius: '50%', border: `${3 * u}px solid ${accent}`, transform: `scale(${0.3 + burst})`, opacity: 1 - burst }} />
            ) : null}
            <Icon d={ICON.heart} size={44 * u} color={liked ? accent : '#fff'} fill={liked} sw={2} style={{ transform: `scale(${liked ? 0.7 + 0.3 * likePop : 1})`, filter: shadow }} />
          </div>
          <span>{likesText}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 * u }}>
          <Icon d={ICON.comment} size={42 * u} color="#fff" sw={2} style={{ filter: shadow }} />
          <span>{props.comments}</span>
        </div>
        <Icon d={ICON.send} size={40 * u} color="#fff" sw={2} style={{ filter: shadow }} />
        <div style={{ flex: 1 }} />
        <Icon d={ICON.bookmark} size={40 * u} color="#fff" sw={2} style={{ filter: shadow }} />
      </div>
    </AbsoluteFill>
  );
};

// ===========================================================================
// 6. A vs B highlight (ref8)
// ===========================================================================

type AvbProps = { labelA: string; valueA: string; labelB: string; valueB: string; winner: string; footer: string; theme: string };

const AVB_SHIFT = 0.3;
/** Panel / video push progress: in over 0.5 s, out over the last 0.4 s. */
const avbProgress = (frame: number, fps: number, dur: number) =>
  ramp(frame, fps, 0, 0.5, Easing.out(Easing.cubic)) * (1 - interpolate(frame, [dur - 0.4 * fps, dur], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.cubic) }));

const AvsB: React.FC<EffectRenderProps<AvbProps>> = ({ props, frame, fps, durationInFrames, width, height, style, VideoCopy }) => {
  const u = unit(width, height);
  const p = avbProgress(frame, fps, durationInFrames);
  const light = props.theme !== 'dark';
  const bg = light ? '#FBF7F2' : style.colors.background;
  const ink = light ? '#231C1F' : style.colors.text;
  const sub = light ? '#8C8186' : alpha(style.colors.text, 0.6);
  const accent = style.colors.accent;
  const ringColor = light ? solidAccent(accent) : accent;
  const footColor = light ? inkAccent(accent) : accent;
  const ui = fontFamily(style.captionFont);

  const panelH = height * 0.54;
  const m = width * 0.08;
  const gap = 36 * u;
  const cardsTop = height * 0.1;
  const labelsH = 120 * u;
  const footerH = 110 * u;
  const maxCardH = panelH - cardsTop - labelsH - footerH - 30 * u;
  const cardW = Math.min((width - 2 * m - gap) / 2, maxCardH / 1.22);
  const cardH = cardW * 1.22;
  const left0 = (width - (cardW * 2 + gap)) / 2;
  const xs = [left0, left0 + cardW + gap];
  const win = props.winner === 'A' ? 0 : 1;
  const lose = 1 - win;

  const ringIn = springAt(frame, fps, 0.35, 14, 180);
  const jumpAt = 1.05;
  const jump = springAt(frame, fps, jumpAt, 13, 150);
  const jl = clamp01(jump);
  const ringX = xs[lose] + (xs[win] - xs[lose]) * jump;
  const arc = -Math.sin(Math.PI * jl) * 46 * u;
  const ringScale = (0.85 + 0.15 * ringIn) * (1 + 0.1 * Math.sin(Math.PI * jl));
  const badge = springAt(frame, fps, jumpAt + 0.22, 10, 200);
  const foot = springAt(frame, fps, jumpAt + 0.3, 16, 150);
  const ringPad = 9 * u;

  const labels = [
    { label: props.labelA, value: props.valueA },
    { label: props.labelB, value: props.valueB },
  ];
  const footY = cardsTop + cardH + labelsH + (panelH - (cardsTop + cardH + labelsH)) / 2 - 42 * u;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height: panelH,
          transform: `translateY(${-(1 - p) * (panelH + 60 * u)}px)`,
          backgroundColor: bg,
          borderRadius: `0 0 ${56 * u}px ${56 * u}px`,
          boxShadow: `0 ${18 * u}px ${50 * u}px rgba(0,0,0,0.35)`,
          fontFamily: ui,
        }}
      >
        {[0, 1].map((i) => {
          const isWin = i === win;
          const k = jl;
          const sc = isWin ? 1 + 0.035 * k : 1 - 0.02 * k;
          const zoom = i === 1 ? 1.45 : 1;
          return (
            <div key={i} style={{ position: 'absolute', left: xs[i], top: cardsTop, width: cardW }}>
              <div
                style={{
                  position: 'relative',
                  width: cardW,
                  height: cardH,
                  borderRadius: 30 * u,
                  overflow: 'hidden',
                  backgroundColor: '#2a2527',
                  boxShadow: `0 ${10 * u}px ${30 * u}px rgba(0,0,0,0.18)`,
                  transform: `scale(${sc})`,
                  opacity: isWin ? 1 : 1 - 0.28 * k,
                }}
              >
                <VideoCopy style={{ ...focusBox(cardW, cardH, width, height, zoom, 0.5, 0.36), filter: isWin ? 'none' : `grayscale(${0.15 + 0.75 * k})` }} />
              </div>
              <div style={{ textAlign: 'center', marginTop: 26 * u, color: sub, fontSize: 21 * u, fontWeight: 700, letterSpacing: 4 * u, textTransform: 'uppercase' }}>{labels[i].label}</div>
              <div style={{ textAlign: 'center', marginTop: 6 * u, color: ink, fontSize: 40 * u, fontWeight: 700, opacity: isWin ? 1 : 1 - 0.35 * k }}>{labels[i].value}</div>
            </div>
          );
        })}
        {/* Highlight ring: starts on the loser, jumps to the winner. */}
        <div
          style={{
            position: 'absolute',
            left: ringX - ringPad,
            top: cardsTop - ringPad,
            width: cardW + ringPad * 2,
            height: cardH + ringPad * 2,
            borderRadius: 38 * u,
            border: `${6 * u}px solid ${ringColor}`,
            boxSizing: 'border-box',
            boxShadow: `0 0 ${26 * u}px ${alpha(accent, 0.55)}`,
            opacity: clamp01(ringIn * 1.4),
            transform: `translateY(${arc}px) scale(${ringScale})`,
          }}
        />
        {/* Winner badge */}
        <div style={{ position: 'absolute', left: xs[win] + cardW - 34 * u, top: cardsTop - 26 * u, transform: `scale(${badge})`, filter: `drop-shadow(0 ${4 * u}px ${8 * u}px rgba(0,0,0,0.25))` }}>
          <CheckBadge size={60 * u} p={badge} color={ringColor} />
        </div>
        {/* Footer line */}
        <div
          style={{
            position: 'absolute',
            left: m,
            right: m,
            top: footY,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14 * u,
            color: footColor,
            fontFamily: fontFamily(style.accentFont),
            fontStyle: 'italic',
            fontSize: 58 * u,
            lineHeight: 1.1,
            opacity: clamp01(foot * 1.4),
            transform: `translateY(${(1 - foot) * 24 * u}px)`,
          }}
        >
          <span>{props.footer}</span>
          <Icon d={ICON.sparkle} size={40 * u} color={footColor} fill style={{ transform: `rotate(${(1 - foot) * 90}deg) scale(${foot})` }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===========================================================================
// 7. Headline wall / post-its (ref2 #12)
// ===========================================================================

type WallProps = { labels: string; font: string };

const NOTE_SPOTS: Array<{ x: number; y: number; rot: number; right?: boolean }> = [
  { x: 0.08, y: 0.13, rot: -5 },
  { x: 0.08, y: 0.12, rot: 4, right: true },
  { x: 0.07, y: 0.29, rot: 3 },
  { x: 0.1, y: 0.31, rot: -4, right: true },
  { x: 0.09, y: 0.45, rot: -3 },
  { x: 0.08, y: 0.46, rot: 3, right: true },
];

const HeadlineWall: React.FC<EffectRenderProps<WallProps>> = ({ props, frame, fps, durationInFrames, width, height, style }) => {
  const u = unit(width, height);
  const labels = lines(props.labels).slice(0, NOTE_SPOTS.length);
  const accent = style.colors.accent;
  const papers = [mix(accent, '#FFFFFF', 0.45), '#FFFFFF', '#FFF3D6', mix(accent, '#FFFFFF', 0.6), '#FFF9F2', mix(accent, '#FFF3D6', 0.5)];
  const fam = props.font === 'accent' ? fontFamily(style.accentFont) : props.font === 'title' ? fontFamily(style.titleFont) : fontFamily('Caveat');
  const hand = props.font !== 'accent' && props.font !== 'title';
  const out = fadeOut(frame, durationInFrames, fps, 0.3);
  const outScale = 0.85 + 0.15 * out;
  const durSec = durationInFrames / fps;
  const stagger = Math.min(0.3, Math.max(0.12, (durSec - 1.2) / Math.max(1, labels.length)));

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {labels.map((text, i) => {
        const spot = NOTE_SPOTS[i];
        const p = springAt(frame, fps, 0.05 + i * stagger, 10, 170);
        const wobble = Math.sin(frame / fps * 2 + i * 1.7) * 0.8;
        const rot = spot.rot + (1 - p) * (i % 2 ? -16 : 16) + wobble;
        const paper = papers[i % papers.length];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: height * spot.y,
              left: spot.right ? undefined : width * spot.x,
              right: spot.right ? width * spot.x : undefined,
              opacity: clamp01(p * 2) * out,
              transform: `scale(${Math.max(0, p) * outScale}) rotate(${rot}deg)`,
              transformOrigin: spot.right ? '80% 20%' : '20% 20%',
            }}
          >
            <div
              style={{
                position: 'relative',
                padding: `${18 * u}px ${34 * u}px ${20 * u}px`,
                backgroundColor: paper,
                // Sheen baked into opaque stops: the MP4 exporter paints a background-image *instead of* the color.
                backgroundImage: `linear-gradient(180deg, ${over(paper, [255, 255, 255], 0.35)} 0%, ${paper} 40%, ${over(paper, [0, 0, 0], 0.05)} 100%)`,
                borderRadius: 4 * u,
                boxShadow: `0 ${8 * u}px ${18 * u}px rgba(0,0,0,0.28), 0 ${1 * u}px ${2 * u}px rgba(0,0,0,0.2)`,
                color: '#2B2226',
                fontFamily: fam,
                fontSize: (hand ? 58 : 46) * u,
                fontWeight: hand ? 700 : 600,
                fontStyle: props.font === 'accent' ? 'italic' : 'normal',
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              {text}
              {/* Tape */}
              <div style={{ position: 'absolute', left: '50%', top: -14 * u, width: 84 * u, height: 26 * u, marginLeft: -42 * u, backgroundColor: 'rgba(255,255,255,0.55)', border: `${1 * u}px solid rgba(255,255,255,0.6)`, transform: `rotate(${i % 2 ? 4 : -3}deg)`, boxShadow: `0 ${1 * u}px ${3 * u}px rgba(0,0,0,0.12)` }} />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ===========================================================================
// Definitions
// ===========================================================================

export const CARD_EFFECTS: EffectDef<any>[] = [
  {
    id: 'phone-mockup',
    name: 'Celular',
    term: 'phone mock-up',
    category: 'cards',
    description: 'Um celular entra ao seu lado mostrando um perfil: foto com o seu vídeo, números subindo, botão "Seguir" sendo tocado e uma grade de posts.',
    source: 'yanny',
    defaultDuration: 3,
    sfx: 'swish',
    fields: [
      { key: 'handle', label: 'Perfil (@)', type: 'text', default: '@seuperfil' },
      { key: 'stats', label: 'Números (posts / seguidores / seguindo)', type: 'text', default: '231 / 1.138 / 928', placeholder: '231 / 1.138 / 928' },
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
    Overlay: PhoneMockup,
  },
  {
    id: 'checklist',
    name: 'Checklist',
    term: 'checklist',
    category: 'cards',
    description: 'Um cartão de vidro fosco com itens que vão sendo marcados um a um, no ritmo da fala.',
    source: 'yanny',
    defaultDuration: 3.2,
    sfx: 'click',
    fields: [
      { key: 'title', label: 'Título', type: 'text', default: 'Meu processo' },
      { key: 'items', label: 'Itens (um por linha)', type: 'textarea', default: 'Gravar de uma vez só\nDeixar o estúdio editar\nSó aprovar e postar' },
      { key: 'strike', label: 'Riscar itens feitos', type: 'toggle', default: false },
    ],
    Overlay: Checklist,
  },
  {
    id: 'ui-world',
    name: 'Mundo de app',
    term: 'UI world',
    category: 'cards',
    description: 'Telas de aplicativo caem do topo: "vídeo adicionado" com os clipes e uma barra de comando digitando a palavra, com o botão de enviar pulsando.',
    source: 'yanny',
    defaultDuration: 3.2,
    sfx: 'whoosh',
    fields: [
      { key: 'text', label: 'Texto digitado (vazio = a palavra do efeito)', type: 'text', default: '', placeholder: 'a palavra falada' },
      { key: 'label', label: 'Aviso no topo', type: 'text', default: 'vídeo adicionado' },
    ],
    Overlay: UiWorld,
  },
  {
    id: 'chat-messages',
    name: 'Mensagens',
    term: 'on-screen messages',
    category: 'cards',
    description: 'Balões de conversa aparecem um a um, com "digitando…" antes de cada resposta. Linhas que começam com ">" são suas (à direita, na cor de destaque).',
    source: 'elements',
    defaultDuration: 3.6,
    sfx: 'pop',
    fields: [
      { key: 'messages', label: 'Mensagens (uma por linha, ">" = sua)', type: 'textarea', default: 'Quanto tempo leva pra editar?\n> 5 minutos\nSério??\n> Uma palavra, um efeito' },
      {
        key: 'position',
        label: 'Posição',
        type: 'select',
        default: 'top',
        options: [
          { value: 'top', label: 'Em cima' },
          { value: 'middle', label: 'No meio' },
          { value: 'bottom', label: 'Embaixo' },
        ],
      },
    ],
    Overlay: ChatMessages,
  },
  {
    id: 'frame-break',
    name: 'Moldura de post',
    term: 'frame break',
    category: 'cards',
    description: 'Uma moldura de post (perfil, curtidas e comentários) se desenha ao seu redor e o vídeo cresce, como se você saísse pela borda de cima.',
    source: 'yanny',
    defaultDuration: 3,
    sfx: 'shimmer',
    fields: [
      { key: 'handle', label: 'Perfil (@)', type: 'text', default: '@seuperfil' },
      { key: 'likes', label: 'Curtidas', type: 'text', default: '1.138' },
      { key: 'comments', label: 'Comentários', type: 'text', default: '86' },
      { key: 'breakTop', label: 'Cabeça sai pela borda de cima', type: 'toggle', default: true },
    ],
    Overlay: FrameBreak,
    videoStyle: ({ frame, fps, durationInFrames }) => {
      const k = spring({ frame, fps, config: { damping: 18, stiffness: 90 } }) * (1 - interpolate(frame, [durationInFrames - 0.4 * fps, durationInFrames], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.cubic) }));
      return { transform: `scale(${1 + 0.07 * k})`, transformOrigin: '50% 82%' };
    },
  },
  {
    id: 'a-vs-b',
    name: 'A vs B',
    term: 'A vs B highlight',
    category: 'cards',
    description: 'Um painel desce com duas opções lado a lado (com o seu vídeo); o destaque pula para a vencedora. Você continua falando logo embaixo.',
    source: 'yanny',
    defaultDuration: 3.5,
    sfx: 'whoosh',
    fields: [
      { key: 'labelA', label: 'Rótulo A', type: 'text', default: 'Na mão' },
      { key: 'valueA', label: 'Valor A', type: 'text', default: '3 horas' },
      { key: 'labelB', label: 'Rótulo B', type: 'text', default: 'Com o estúdio' },
      { key: 'valueB', label: 'Valor B', type: 'text', default: '5 minutos' },
      {
        key: 'winner',
        label: 'Vencedor',
        type: 'select',
        default: 'B',
        options: [
          { value: 'A', label: 'A' },
          { value: 'B', label: 'B' },
        ],
      },
      { key: 'footer', label: 'Frase de rodapé', type: 'text', default: 'mas com o estúdio' },
      {
        key: 'theme',
        label: 'Painel',
        type: 'select',
        default: 'light',
        options: [
          { value: 'light', label: 'Claro (creme)' },
          { value: 'dark', label: 'Cor de fundo do estilo' },
        ],
      },
    ],
    Overlay: AvsB,
    videoStyle: ({ frame, fps, durationInFrames, height }) => ({ transform: `translateY(${height * AVB_SHIFT * avbProgress(frame, fps, durationInFrames)}px)` }),
  },
  {
    id: 'headline-wall',
    name: 'Post-its',
    term: 'headline wall',
    category: 'stickers',
    description: 'Etiquetas de papel escritas à mão aparecem ao seu redor, uma de cada vez, levemente tortas.',
    source: 'yanny',
    defaultDuration: 3,
    sfx: 'paper',
    fields: [
      { key: 'labels', label: 'Etiquetas (uma por linha)', type: 'textarea', default: 'uma tomada\nsem timeline\n5 min\nmeu estilo' },
      {
        key: 'font',
        label: 'Letra',
        type: 'select',
        default: 'hand',
        options: [
          { value: 'hand', label: 'Escrita à mão (Caveat)' },
          { value: 'accent', label: 'Fonte de destaque' },
          { value: 'title', label: 'Fonte dos títulos' },
        ],
      },
    ],
    Overlay: HeadlineWall,
  },
];
