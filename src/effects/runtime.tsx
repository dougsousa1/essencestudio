// Places effect instances on the timeline and renders them in three layers:
// backdrops (behind the video), video styles (transform/filter on the video)
// and overlays (on top of everything).
import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { FPS } from '../core/timeline';
import type { EffectInstance, Project, Timeline } from '../core/types';
import { CutVideo } from '../remotion/parts';
import { defaultProps, getEffect } from './registry';
import type { EffectDef, EffectRenderProps } from './types';

export type PlacedEffect = {
  instance: EffectInstance;
  def: EffectDef<any>;
  startFrame: number;
  durationInFrames: number;
  word: string;
};

export const placeEffects = (project: Project, timeline: Timeline): PlacedEffect[] => {
  const out: PlacedEffect[] = [];
  for (const inst of project.effects ?? []) {
    const def = getEffect(inst.effectId);
    if (!def) continue;
    const w = inst.wordId ? timeline.words.find((x) => x.id === inst.wordId) : undefined;
    const start = w ? w.outStart : inst.at;
    if (start >= timeline.durationInSeconds) continue;
    out.push({
      instance: inst,
      def,
      startFrame: Math.max(0, Math.round(start * FPS)),
      durationInFrames: Math.max(1, Math.round(inst.durationInSeconds * FPS)),
      word: w?.text.replace(/[.,!?;:…]+$/, '') ?? '',
    });
  }
  return out.sort((a, b) => a.startFrame - b.startFrame);
};

const useRenderProps = (p: PlacedEffect, project: Project, timeline: Timeline, frame: number): EffectRenderProps<any> => {
  const { width, height, fps } = useVideoConfig();
  const VideoCopy = React.useMemo(() => {
    const C: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
      // Re-align the copy to absolute time: we are inside a Sequence that starts at startFrame.
      <Sequence from={-p.startFrame} layout="none">
        <CutVideo project={project} timeline={timeline} muted style={style} />
      </Sequence>
    );
    return C;
  }, [p.startFrame, project, timeline]);
  return {
    props: { ...defaultProps(p.def), ...p.instance.props },
    frame,
    durationInFrames: p.durationInFrames,
    fps,
    width,
    height,
    style: project.style,
    project,
    word: p.word,
    startFrame: p.startFrame,
    VideoCopy,
  };
};

const LayerHost: React.FC<{ p: PlacedEffect; project: Project; timeline: Timeline; kind: 'Overlay' | 'Backdrop' }> = ({ p, project, timeline, kind }) => {
  const frame = useCurrentFrame();
  const rp = useRenderProps(p, project, timeline, frame);
  const C = p.def[kind];
  if (!C) return null;
  return <C {...rp} />;
};

/** Everything drawn on top of the look (above captions). */
export const EffectOverlays: React.FC<{ placed: PlacedEffect[]; project: Project; timeline: Timeline }> = ({ placed, project, timeline }) => (
  <>
    {placed
      .filter((p) => p.def.Overlay)
      .map((p) => (
        <Sequence key={p.instance.id} from={p.startFrame} durationInFrames={p.durationInFrames} premountFor={15}>
          <LayerHost p={p} project={project} timeline={timeline} kind="Overlay" />
        </Sequence>
      ))}
  </>
);

const VideoStyleHost: React.FC<{ placed: PlacedEffect[]; project: Project; timeline: Timeline; children: React.ReactNode }> = ({ placed, project, timeline, children }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  // Merge the styles of every active effect (transforms are chained).
  const transforms: string[] = [];
  const filters: string[] = [];
  let opacity = 1;
  let extra: React.CSSProperties = {};
  for (const p of placed) {
    if (!p.def.videoStyle) continue;
    const local = frame - p.startFrame;
    if (local < 0 || local >= p.durationInFrames) continue;
    const st = p.def.videoStyle({
      props: { ...defaultProps(p.def), ...p.instance.props },
      frame: local,
      durationInFrames: p.durationInFrames,
      fps,
      width,
      height,
      style: project.style,
      project,
      word: p.word,
      startFrame: p.startFrame,
      VideoCopy: () => null,
    });
    if (st.transform) transforms.push(String(st.transform));
    if (st.filter) filters.push(String(st.filter));
    if (typeof st.opacity === 'number') opacity *= st.opacity;
    const { transform: _t, filter: _f, opacity: _o, ...rest } = st;
    void _t;
    void _f;
    void _o;
    extra = { ...extra, ...rest };
  }
  void timeline;
  return (
    <AbsoluteFill
      style={{
        ...extra,
        transform: transforms.join(' ') || undefined,
        // The MP4 exporter only applies a filter to a whole subtree when the chain
        // contains a drop-shadow, so a no-op one is appended.
        filter: filters.length ? `${filters.join(' ')} drop-shadow(0 0 0 rgba(0,0,0,0))` : undefined,
        opacity,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** The video layer with backdrops behind it and active video styles applied. */
export const FxVideo: React.FC<{ placed: PlacedEffect[]; project: Project; timeline: Timeline }> = ({ placed, project, timeline }) => (
  <AbsoluteFill>
    {placed
      .filter((p) => p.def.Backdrop)
      .map((p) => (
        <Sequence key={p.instance.id} from={p.startFrame} durationInFrames={p.durationInFrames} premountFor={15}>
          <LayerHost p={p} project={project} timeline={timeline} kind="Backdrop" />
        </Sequence>
      ))}
    <VideoStyleHost placed={placed} project={project} timeline={timeline}>
      <CutVideo project={project} timeline={timeline} />
    </VideoStyleHost>
  </AbsoluteFill>
);
