import React from 'react';
import { AbsoluteFill, Easing, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FPS } from '../../core/timeline';
import { fontFamily } from '../../core/fonts';
import type { LookProps } from '../../core/types';
import { Captions, Grain, Motion, Vignette } from '../parts';

/** Intro card: typed headline with block cursor, accent last word and a progress slider. */
const HeadlineIntro: React.FC<LookProps> = ({ project, width, height }) => {
  const frame = useCurrentFrame();
  const s = project.style;
  const scale = width / 1080;
  const total = Math.round(project.title.durationInSeconds * FPS);

  const words = project.title.text.trim().split(/\s+/).filter(Boolean);
  const last = words.length > 1 ? words[words.length - 1] : '';
  const head = (words.length > 1 ? words.slice(0, -1) : words).join(' ');
  const allChars = head.length + last.length;

  // Typing: finish within ~55% of the card duration.
  const typeStart = 4;
  const speed = Math.max(0.6, allChars / Math.max(1, total * 0.55 - typeStart));
  const typed = Math.max(0, Math.floor((frame - typeStart) * speed));
  const headShown = head.slice(0, Math.min(head.length, typed));
  const lastShown = last.slice(0, Math.max(0, typed - head.length));
  const doneTyping = typed >= allChars;
  const cursorOn = !doneTyping || Math.floor(frame / 8) % 2 === 0;

  // Exit: slide up and fade.
  const exit = interpolate(frame, [total - 8, total], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });

  // Slider progress over the card.
  const sliderIn = interpolate(frame, [6, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const prog = interpolate(frame, [10, total - 6], [0.04, 0.92], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const valueLabel = `${(prog * project.title.durationInSeconds * 1.25).toFixed(1)}S`;

  const titleSize = 92 * scale;
  const cursor = (color: string) => (
    <span
      style={{
        display: 'inline-block',
        width: titleSize * 0.42,
        height: titleSize * 0.82,
        marginLeft: titleSize * 0.06,
        verticalAlign: 'baseline',
        transform: `translateY(${titleSize * 0.1}px)`,
        backgroundColor: color,
        opacity: cursorOn ? 1 : 0,
      }}
    />
  );
  const cursorInLast = typed > head.length && last.length > 0;

  return (
    <AbsoluteFill style={{ backgroundColor: s.colors.background, overflow: 'hidden', opacity: 1 - exit }}>
      {/* Soft glow (linear gradients + blurred blobs; radial is not supported in export). */}
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(160deg, ${s.colors.accent}33 0%, rgba(0,0,0,0) 45%, ${s.colors.secondary}14 100%)` }} />
      <div
        style={{
          position: 'absolute',
          left: width * 0.05,
          top: height * 0.08,
          width: width * 0.7,
          height: width * 0.7,
          borderRadius: '50%',
          backgroundColor: s.colors.accent,
          opacity: 0.16,
          // drop-shadow makes the exporter blur the whole layer (otherwise border-radius clips the blur).
          filter: `blur(${140 * scale}px) drop-shadow(0 0 0 rgba(0,0,0,0))`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: width * 0.1,
          right: width * 0.1,
          top: height * 0.16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          transform: `translateY(${-exit * 40 * scale}px)`,
        }}
      >
        <div
          style={{
            fontFamily: fontFamily(s.titleFont),
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            color: s.colors.secondary,
            minHeight: titleSize,
          }}
        >
          {headShown}
          {!cursorInLast ? cursor(s.colors.secondary) : null}
        </div>
        {last ? (
          <div
            style={{
              fontFamily: fontFamily(s.accentFont),
              fontStyle: 'italic',
              fontWeight: 600,
              fontSize: titleSize * 1.12,
              lineHeight: 1.05,
              color: s.colors.accent,
              minHeight: titleSize * 1.12,
            }}
          >
            {lastShown}
            {cursorInLast ? cursor(s.colors.accent) : null}
          </div>
        ) : null}

        {/* Progress slider UI. */}
        <div
          style={{
            marginTop: 54 * scale,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 22 * scale,
            padding: `${18 * scale}px ${26 * scale}px`,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: `${1.5 * scale}px solid rgba(255,255,255,0.12)`,
            boxSizing: 'border-box',
            opacity: sliderIn,
            transform: `translateY(${(1 - sliderIn) * 20 * scale}px)`,
          }}
        >
          <div style={{ width: 12 * scale, height: 12 * scale, borderRadius: '50%', backgroundColor: s.colors.accent }} />
          {project.title.kicker ? (
            <div
              style={{
                fontFamily: fontFamily(s.captionFont),
                fontSize: 20 * scale,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: s.colors.text,
                opacity: 0.85,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              {project.title.kicker}
            </div>
          ) : null}
          <div style={{ position: 'relative', flex: 1, height: 6 * scale, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${prog * 100}%`, borderRadius: 999, backgroundColor: s.colors.secondary }} />
            <div
              style={{
                position: 'absolute',
                left: `${prog * 100}%`,
                top: '50%',
                width: 22 * scale,
                height: 22 * scale,
                marginLeft: -11 * scale,
                marginTop: -11 * scale,
                borderRadius: '50%',
                backgroundColor: s.colors.accent,
                boxShadow: `0 ${2 * scale}px ${10 * scale}px rgba(0,0,0,0.45)`,
              }}
            />
          </div>
          <div
            style={{
              fontFamily: fontFamily(s.captionFont),
              fontSize: 20 * scale,
              fontWeight: 700,
              color: s.colors.text,
              opacity: 0.85,
              fontVariantNumeric: 'tabular-nums',
              minWidth: 52 * scale,
              textAlign: 'right',
            }}
          >
            {valueLabel}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Rounded label chip with the kicker that pops in at a corner. */
const HeadlineChip: React.FC<LookProps> = ({ project, width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = project.style;
  const scale = width / 1080;
  const p = spring({ frame, fps, config: { damping: 12, stiffness: 170 } });
  return (
    <div
      style={{
        position: 'absolute',
        left: width * 0.08,
        top: height * 0.11,
        display: 'flex',
        alignItems: 'center',
        gap: 12 * scale,
        padding: `${12 * scale}px ${24 * scale}px`,
        borderRadius: 999,
        backgroundColor: s.colors.secondary,
        boxShadow: `0 ${6 * scale}px ${18 * scale}px rgba(0,0,0,0.3)`,
        transform: `scale(${p}) rotate(${(1 - p) * -8}deg)`,
        transformOrigin: '0% 50%',
        opacity: Math.min(1, p * 2),
      }}
    >
      <div style={{ width: 14 * scale, height: 14 * scale, borderRadius: '50%', backgroundColor: s.colors.accent }} />
      <div
        style={{
          fontFamily: fontFamily(s.captionFont),
          fontSize: 26 * scale,
          fontWeight: 700,
          color: s.colors.background,
          whiteSpace: 'nowrap',
        }}
      >
        {project.title.kicker}
      </div>
    </div>
  );
};

/** Headline: bold typed intro card, then punchy full-bleed video with chip captions. */
export const HeadlineLook: React.FC<LookProps> = (props) => {
  const { project, timeline, width, height, video } = props;
  const introFrames = project.title.enabled ? Math.round(project.title.durationInSeconds * FPS) : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Motion project={project} timeline={timeline}>
        {video}
      </Motion>
      <Vignette amount={project.style.vignette} />
      <Grain amount={project.style.grain} />
      {project.title.kicker.trim() ? (
        <Sequence from={introFrames + 6}>
          <HeadlineChip {...props} />
        </Sequence>
      ) : null}
      {introFrames > 0 ? (
        <Sequence durationInFrames={introFrames}>
          <HeadlineIntro {...props} />
        </Sequence>
      ) : null}
      {/* Captions stay on top so they also read over the intro card. */}
      <Captions project={project} timeline={timeline} width={width} height={height} emphasis="chip" />
    </AbsoluteFill>
  );
};
