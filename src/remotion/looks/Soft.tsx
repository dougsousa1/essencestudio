import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { FPS } from '../../core/timeline';
import { fontFamily } from '../../core/fonts';
import type { LookProps } from '../../core/types';
import { Captions, Grain, Motion, Vignette, useInOut } from '../parts';

/** Soft: full-bleed video, thin spaced serif title at the top, quiet captions. */
const SoftTitle: React.FC<LookProps> = ({ project, width, height }) => {
  const frame = useCurrentFrame();
  const total = Math.round(project.title.durationInSeconds * FPS);
  const p = useInOut(18, total, 12);
  const s = project.style;
  const scale = width / 1080;
  const spacing = interpolate(frame, [0, total], [0.32, 0.22]);
  return (
    <AbsoluteFill style={{ alignItems: 'center', top: height * 0.1, opacity: p }}>
      {project.title.kicker ? (
        <div style={{ fontFamily: fontFamily(s.captionFont), fontSize: 20 * scale, letterSpacing: `${0.3}em`, color: s.colors.text, opacity: 0.85, marginBottom: 14 * scale, fontWeight: 500 }}>
          {project.title.kicker}
        </div>
      ) : null}
      <div
        style={{
          fontFamily: fontFamily(s.titleFont),
          fontSize: 96 * scale,
          fontWeight: 500,
          letterSpacing: `${spacing}em`,
          color: s.colors.text,
          textTransform: 'uppercase',
          textAlign: 'center',
          lineHeight: 1,
          maxWidth: width * 0.9,
          textShadow: `0 ${2 * scale}px ${20 * scale}px rgba(0,0,0,0.35)`,
          transform: `translateY(${(1 - p) * 20 * scale}px)`,
        }}
      >
        {project.title.text}
      </div>
    </AbsoluteFill>
  );
};

export const SoftLook: React.FC<LookProps> = (props) => {
  const { project, timeline, width, height, video } = props;
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Motion project={project} timeline={timeline}>
        {video}
      </Motion>
      <Vignette amount={project.style.vignette} />
      <Grain amount={project.style.grain} />
      {project.title.enabled ? (
        <Sequence durationInFrames={Math.round(project.title.durationInSeconds * FPS)}>
          <SoftTitle {...props} />
        </Sequence>
      ) : null}
      <Captions project={project} timeline={timeline} width={width} height={height} emphasis="italic" />
    </AbsoluteFill>
  );
};
