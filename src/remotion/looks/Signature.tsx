import React from 'react';
import { AbsoluteFill, Easing, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { FPS } from '../../core/timeline';
import { fontFamily } from '../../core/fonts';
import type { LookProps } from '../../core/types';
import { Captions, Grain, Motion, Vignette, useInOut } from '../parts';

const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0');

/** HH:MM:SS:FF timecode for an absolute frame. */
const timecode = (frame: number) => {
  const f = frame % FPS;
  const secs = Math.floor(frame / FPS);
  return `${pad2(secs / 3600)}:${pad2((secs / 60) % 60)}:${pad2(secs % 60)}:${pad2(f)}`;
};

/** Timecode counter + big serif title revealed word by word with a blur-in. */
const SignatureTitle: React.FC<LookProps> = ({ project, width, height }) => {
  const frame = useCurrentFrame();
  const total = Math.round(project.title.durationInSeconds * FPS);
  const out = useInOut(1, total, 14);
  const s = project.style;
  const scale = width / 1080;
  const words = project.title.text.trim().split(/\s+/).filter(Boolean);
  const perWord = Math.max(3, Math.min(8, Math.floor((total * 0.45) / Math.max(1, words.length))));
  const tcIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ alignItems: 'center', top: height * 0.12, opacity: out }}>
      <div
        style={{
          fontFamily: fontFamily(s.captionFont),
          fontSize: 22 * scale,
          letterSpacing: '0.34em',
          color: s.colors.text,
          opacity: 0.8 * tcIn,
          marginBottom: 18 * scale,
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
          textShadow: `0 ${1 * scale}px ${8 * scale}px rgba(0,0,0,0.4)`,
        }}
      >
        {timecode(frame)}
      </div>
      <div
        style={{
          fontFamily: fontFamily(s.titleFont),
          fontSize: 124 * scale,
          fontWeight: 400,
          lineHeight: 0.98,
          letterSpacing: '0.01em',
          color: s.colors.text,
          textTransform: 'uppercase',
          textAlign: 'center',
          maxWidth: width * 0.88,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {words.map((w, i) => {
          const local = frame - 6 - i * perWord;
          const p = interpolate(local, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                margin: `0 ${0.12 * 124 * scale}px`,
                opacity: p,
                filter: p < 1 ? `blur(${(1 - p) * 14 * scale}px)` : undefined,
                transform: `translateY(${(1 - p) * 16 * scale}px)`,
                textShadow: `0 ${2 * scale}px ${24 * scale}px rgba(0,0,0,0.35)`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Small persistent kicker at the top once the title is gone. */
const SignatureKicker: React.FC<LookProps> = ({ project, width, height }) => {
  const frame = useCurrentFrame();
  const s = project.style;
  const scale = width / 1080;
  const p = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ alignItems: 'center', top: height * 0.1, opacity: p * 0.85 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 * scale }}>
        <div style={{ width: 36 * scale * p, height: 1 * scale, backgroundColor: s.colors.accent }} />
        <div
          style={{
            fontFamily: fontFamily(s.captionFont),
            fontSize: 20 * scale,
            letterSpacing: '0.38em',
            color: s.colors.text,
            textTransform: 'uppercase',
            fontWeight: 500,
            textShadow: `0 ${1 * scale}px ${8 * scale}px rgba(0,0,0,0.45)`,
          }}
        >
          {project.title.kicker}
        </div>
        <div style={{ width: 36 * scale * p, height: 1 * scale, backgroundColor: s.colors.accent }} />
      </div>
    </AbsoluteFill>
  );
};

/** Signature: elegant editorial look with a timecode, blur-in serif title and soft push-in. */
export const SignatureLook: React.FC<LookProps> = (props) => {
  const { project, timeline, width, height, video } = props;
  const titleFrames = project.title.enabled ? Math.round(project.title.durationInSeconds * FPS) : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Motion project={project} timeline={timeline}>
        {video}
      </Motion>
      <Vignette amount={project.style.vignette} />
      <Grain amount={project.style.grain} />
      {project.title.enabled && titleFrames > 0 ? (
        <Sequence durationInFrames={titleFrames}>
          <SignatureTitle {...props} />
        </Sequence>
      ) : null}
      {project.title.kicker.trim() ? (
        <Sequence from={titleFrames}>
          <SignatureKicker {...props} />
        </Sequence>
      ) : null}
      <Captions project={project} timeline={timeline} width={width} height={height} emphasis="italic" />
    </AbsoluteFill>
  );
};
