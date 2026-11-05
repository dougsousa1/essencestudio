// Building blocks shared by every look.
// Only CSS that the client-side renderer supports is used here
// (no radial gradients, no inset shadows) so the export matches the preview.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Video } from '@remotion/media';
import { Sequence, staticFile } from 'remotion';
import { FPS, paginate } from '../core/timeline';
import { fontFamily } from '../core/fonts';
import type { Project, Style, Timeline, TimedWord } from '../core/types';

export const gradeFilter = (g: Style['grade']) => {
  const sepia = Math.max(0, g.warmth) * 0.35;
  const hue = g.warmth < 0 ? g.warmth * 20 : 0;
  return `brightness(${g.brightness}) contrast(${g.contrast}) saturate(${g.saturate}) sepia(${sepia}) hue-rotate(${hue}deg)`;
};

/** The source video with cuts applied: one Sequence per kept segment. */
export const CutVideo: React.FC<{ project: Project; timeline: Timeline; style?: React.CSSProperties; muted?: boolean }> = ({ project, timeline, style, muted }) => {
  const video = project.video;
  if (!video) return null;
  // The MP4 exporter only applies a filter to an element's own paint, not to its
  // children, so a filter passed in `style` (VideoCopy grades / blurs) goes on the
  // <Video> canvas itself, after the grade — same result as filtering the wrapper.
  const { filter: extraFilter, ...wrapperStyle } = style ?? {};
  const filter = [gradeFilter(project.style.grade), extraFilter && extraFilter !== 'none' ? String(extraFilter) : ''].filter(Boolean).join(' ');
  return (
    <AbsoluteFill style={wrapperStyle}>
      {timeline.segments.map((seg, i) => {
        const from = Math.round(seg.outStart * FPS);
        const dur = Math.max(1, Math.round((seg.srcEnd - seg.srcStart) * FPS));
        return (
          <Sequence key={i} from={from} durationInFrames={dur} premountFor={15}>
            <Video
              src={project.assetBase === 'static' ? staticFile(video.url) : video.url}
              trimBefore={Math.round(seg.srcStart * FPS)}
              objectFit="cover"
              muted={muted}
              style={{ width: '100%', height: '100%', filter }}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/** Slow push-in ("soft") or a zoom punch on every emphasis word ("punch"). */
export const Motion: React.FC<{ project: Project; timeline: Timeline; children: React.ReactNode }> = ({ project, timeline, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / FPS;
  let scale = 1;
  if (project.style.motion === 'soft') {
    scale = interpolate(frame, [0, durationInFrames], [1, 1.08], { extrapolateRight: 'clamp' });
  } else if (project.style.motion === 'punch') {
    // Alternate zoom level at each cut / emphasis word for a jump-cut feel.
    const marks = timeline.words.filter((w) => w.emphasis).map((w) => w.outStart);
    const segMarks = timeline.segments.map((s) => s.outStart);
    const all = [...marks, ...segMarks].sort((a, b) => a - b);
    let idx = 0;
    for (const m of all) if (m <= t) idx++;
    const last = all.filter((m) => m <= t).pop() ?? 0;
    const target = idx % 2 === 0 ? 1 : 1.14;
    const prevTarget = idx % 2 === 0 ? 1.14 : 1;
    const p = Math.min(1, (t - last) / 0.18);
    scale = idx === 0 ? 1 : prevTarget + (target - prevTarget) * Easing.out(Easing.cubic)(p);
  }
  return <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: '50% 40%' }}>{children}</AbsoluteFill>;
};

/** Edge darkening built from linear gradients (radial is not supported in export). */
export const Vignette: React.FC<{ amount: number }> = ({ amount }) => {
  if (amount <= 0) return null;
  const a = Math.min(0.85, amount);
  const g = (dir: string) => `linear-gradient(${dir}, rgba(0,0,0,${a}) 0%, rgba(0,0,0,0) 28%)`;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ backgroundImage: g('to bottom') }} />
      <AbsoluteFill style={{ backgroundImage: g('to top') }} />
      <AbsoluteFill style={{ backgroundImage: g('to right'), opacity: 0.7 }} />
      <AbsoluteFill style={{ backgroundImage: g('to left'), opacity: 0.7 }} />
    </AbsoluteFill>
  );
};

const NOISE = (seed: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='640'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${seed}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 1.2 -0.35'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
  )}`;

/** Film grain: a few noise frames cycled. */
export const Grain: React.FC<{ amount: number }> = ({ amount }) => {
  const frame = useCurrentFrame();
  if (amount <= 0) return null;
  const seed = Math.floor(frame / 2) % 4;
  return (
    <AbsoluteFill style={{ opacity: Math.min(0.6, amount * 1.6), mixBlendMode: 'overlay', pointerEvents: 'none' }}>
      <img src={NOISE(seed)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </AbsoluteFill>
  );
};

export type EmphasisStyle = 'italic' | 'chip' | 'color';

/** Word-by-word captions in four modes, styled from the project style. */
export const Captions: React.FC<{
  project: Project;
  timeline: Timeline;
  width: number;
  height: number;
  emphasis?: EmphasisStyle;
  /** Optional shadow/outline so text stays readable on any video. */
  shadow?: boolean;
  align?: 'center' | 'left';
  /** Override the vertical position (0..1). */
  y?: number;
}> = ({ project, timeline, width, height, emphasis = 'italic', shadow = true, align = 'center', y }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = project.style;
  if (s.captionMode === 'off' || timeline.words.length === 0) return null;
  const t = frame / fps;
  const scale = width / 1080;
  const size = s.captionSize * scale;
  const pages = paginate(timeline.words, s.captionMode === 'word' ? 1 : s.wordsPerPage);
  const page = pages.find((p) => t >= p[0].outStart - 0.05 && t < p[p.length - 1].outEnd + 0.25);
  if (!page) return null;
  // Keep text out of the Instagram UI area (bottom ~20%, top ~10%).
  const safeY = Math.min(0.8, Math.max(0.1, y ?? s.captionY));

  const wordStyle = (w: TimedWord, i: number): React.CSSProperties => {
    const local = (t - w.outStart) * fps;
    const appear = spring({ frame: local, fps, config: { damping: 14, stiffness: 180 }, durationInFrames: 10 });
    const started = t >= w.outStart - 0.02;
    const active = t >= w.outStart && t < w.outEnd + 0.05;
    let opacity = 1;
    let transform = '';
    if (s.captionMode === 'karaoke') {
      opacity = started ? 1 : 0.38;
    } else if (s.captionMode === 'phrase') {
      if (!started) opacity = 0;
      else if (s.captionAnimation === 'pop') transform = `scale(${0.6 + 0.4 * appear})`;
      else if (s.captionAnimation === 'slide') transform = `translateY(${(1 - appear) * 30 * scale}px)`;
      opacity = started ? Math.min(1, local / 4 + 0.2) : 0;
    } else if (s.captionMode === 'word') {
      if (s.captionAnimation === 'pop') transform = `scale(${0.5 + 0.5 * appear})`;
      if (s.captionAnimation === 'slide') transform = `translateY(${(1 - appear) * 40 * scale}px)`;
      opacity = Math.min(1, local / 3 + 0.3);
    }
    const isEm = w.emphasis;
    const base: React.CSSProperties = {
      display: 'inline-block',
      margin: `0 ${size * 0.13}px`,
      opacity,
      transform,
      fontFamily: fontFamily(s.captionFont),
      fontWeight: 700,
      color: s.colors.text,
      textTransform: s.uppercase ? 'uppercase' : 'none',
      textShadow: shadow ? `0 ${2 * scale}px ${12 * scale}px rgba(0,0,0,0.55)` : undefined,
    };
    if (s.captionMode === 'karaoke' && active) base.color = s.colors.accent;
    if (isEm) {
      if (emphasis === 'italic') {
        Object.assign(base, { fontFamily: fontFamily(s.accentFont), fontStyle: 'italic', fontWeight: 500, color: s.colors.accent, fontSize: size * 1.12, textTransform: 'none' });
      } else if (emphasis === 'chip') {
        Object.assign(base, { backgroundColor: s.colors.accent, color: s.colors.background, padding: `0 ${size * 0.18}px`, borderRadius: size * 0.16, textShadow: 'none' });
      } else {
        base.color = s.colors.accent;
      }
    }
    if (s.captionAnimation === 'typewriter' && s.captionMode !== 'karaoke') {
      const chars = Math.floor(Math.max(0, local) / 1.2);
      return { ...base, opacity: started ? 1 : 0, transform: '', ['--chars' as string]: chars };
    }
    void i;
    return base;
  };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: width * 0.1,
          right: width * 0.1,
          top: height * safeY,
          transform: 'translateY(-50%)',
          textAlign: align,
          fontSize: size,
          lineHeight: 1.15,
        }}
      >
        {page.map((w, i) => {
          const st = wordStyle(w, i);
          let text = w.text.trim();
          if (s.captionAnimation === 'typewriter' && s.captionMode !== 'karaoke') {
            const n = (st as Record<string, unknown>)['--chars'] as number;
            text = text.slice(0, Math.max(0, n));
          }
          return (
            <span key={w.id} style={st}>
              {text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** 0..1 progress of an intro animation, and 1..0 on the way out. */
export const useInOut = (inFrames: number, totalFrames: number, outFrames = 10) => {
  const frame = useCurrentFrame();
  const inP = interpolate(frame, [0, inFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const outP = interpolate(frame, [totalFrames - outFrames, totalFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return Math.min(inP, outP);
};
