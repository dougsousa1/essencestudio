// Small helpers shared by effect components.
import type React from 'react';
import { Easing, interpolate, spring } from 'remotion';

/** Scale factor: design every effect at 1080 px wide. */
export const px = (width: number) => width / 1080;

/** 1 → 0 over the last `sec` seconds of the effect. */
export const fadeOut = (frame: number, durationInFrames: number, fps: number, sec = 0.3) =>
  interpolate(frame, [durationInFrames - sec * fps, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

/** 0 → 1 over the first `sec` seconds, eased. */
export const easeIn = (frame: number, fps: number, sec = 0.4, delaySec = 0) =>
  interpolate(frame, [delaySec * fps, (delaySec + sec) * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

/** Snappy UI spring (0 → 1 with a small overshoot). */
export const pop = (frame: number, fps: number, delaySec = 0) => spring({ frame: frame - delaySec * fps, fps, config: { damping: 13, stiffness: 180 } });

/** Deterministic pseudo-random number in [0, 1) for a seed. */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Glass card look that works in the MP4 export (no backdrop-filter). */
export const glass = (s: number, dark = true): React.CSSProperties => ({
  backgroundColor: dark ? 'rgba(20,16,18,0.62)' : 'rgba(255,255,255,0.72)',
  border: `${1.5 * s}px solid ${dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.9)'}`,
  borderRadius: 36 * s,
  boxShadow: `0 ${20 * s}px ${60 * s}px rgba(0,0,0,0.35)`,
});
