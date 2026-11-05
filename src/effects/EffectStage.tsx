// Standalone preview of one effect over a neutral "person" silhouette.
// Used by the library cards, so effects can be browsed without uploading a video.
import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { PALETTES, initialProject, styleForLook } from '../core/presets';
import type { LookId, Project } from '../core/types';
import { defaultProps, getEffect } from './registry';
import type { EffectRenderProps } from './types';

/** Fake footage: soft studio backdrop with a speaker silhouette. */
export const Silhouette: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = width / 1080;
  // Gentle "breathing" so the subject feels alive.
  const sway = Math.sin(frame / 18) * 6 * s;
  const head = Math.min(width, height) * 0.13;
  return (
    <AbsoluteFill style={{ backgroundImage: 'linear-gradient(180deg, #dfe5ee 0%, #c7d0dd 60%, #b7c2d1 100%)', overflow: 'hidden', ...style }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.32, backgroundImage: 'linear-gradient(180deg, rgba(148,163,184,0) 0%, rgba(148,163,184,0.45) 100%)' }} />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: height * 0.36,
          width: head,
          height: head,
          marginLeft: -head / 2 + sway,
          borderRadius: '50%',
          backgroundColor: '#94a3b8',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: height * 0.36 + head * 1.12,
          width: head * 2.9,
          height: height,
          marginLeft: (-head * 2.9) / 2 + sway * 0.6,
          borderTopLeftRadius: head * 1.4,
          borderTopRightRadius: head * 1.4,
          backgroundColor: '#94a3b8',
        }}
      />
    </AbsoluteFill>
  );
};

export type EffectStageProps = { effectId: string; look?: LookId; props?: Record<string, unknown> };

const LEAD_IN = 8;

// Library previews use the brand blue so the catalog reads as one system.
const BLUE = PALETTES.find((p) => p.id === 'azul')!;
const demoProject = (look: LookId): Project => ({ ...initialProject(), look, style: { ...styleForLook(look), palette: BLUE.id, colors: BLUE.colors } });

/** Composition: the effect on the silhouette, starting a few frames in. */
export const EffectStage: React.FC<EffectStageProps> = ({ effectId, look = 'headline', props }) => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const def = getEffect(effectId);
  const project = useMemo(() => demoProject(look), [look]);
  if (!def) return <Silhouette />;

  const local = frame - LEAD_IN;
  const durationInFrames = Math.round(def.defaultDuration * fps);
  const active = local >= 0 && local < durationInFrames;
  const VideoCopy: React.FC<{ style?: React.CSSProperties }> = ({ style }) => <Silhouette style={style} />;
  const rp: EffectRenderProps<any> = {
    props: { ...defaultProps(def), ...(props ?? {}) },
    frame: Math.max(0, local),
    durationInFrames,
    fps,
    width,
    height,
    style: project.style,
    project,
    word: 'efeito',
    startFrame: LEAD_IN,
    VideoCopy,
  };
  const videoStyle = active && def.videoStyle ? def.videoStyle(rp) : {};
  const { Overlay, Backdrop } = def;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0f172a' }}>
      {Backdrop ? (
        <Sequence from={LEAD_IN} durationInFrames={durationInFrames} layout="none">
          <Backdrop {...rp} />
        </Sequence>
      ) : null}
      <AbsoluteFill style={videoStyle}>
        <Silhouette />
      </AbsoluteFill>
      {Overlay ? (
        <Sequence from={LEAD_IN} durationInFrames={durationInFrames} layout="none">
          <AbsoluteFill>
            <Overlay {...rp} />
          </AbsoluteFill>
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

export const stageDuration = (effectId: string, fps: number) => {
  const def = getEffect(effectId);
  return LEAD_IN + Math.round((def?.defaultDuration ?? 2) * fps) + 12;
};

// Fast camera moves peak early; the middle of the effect would look empty.
const THUMB_AT: Record<string, number> = { 'zoom-through': 0.25, flash: 0.15, 'punch-zoom': 0.12 };

/** A good still frame for the thumbnail (middle of the effect by default). */
export const stageThumbFrame = (effectId: string, fps: number) => {
  const def = getEffect(effectId);
  return LEAD_IN + Math.round((def?.defaultDuration ?? 2) * fps * (THUMB_AT[effectId] ?? 0.55));
};

/** Text people can paste into Claude / ChatGPT to ask for this effect. */
export const effectPrompt = (effectId: string) => {
  const def = getEffect(effectId);
  if (!def) return '';
  const fields = def.fields
    .filter((f) => f.type === 'text' || f.type === 'textarea')
    .map((f) => `${f.label}: [${String(f.default).split('\n').join(' / ')}]`)
    .join('; ');
  return `Efeito "${def.name}" (${def.term}). ${def.description} Coloque na palavra [PALAVRA], com duração de ${def.defaultDuration.toFixed(1)} s${fields ? `. ${fields}` : ''}.`;
};
