import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { Audio } from '@remotion/media';
import { buildTimeline, FPS } from '../core/timeline';
import type { LookId, LookProps, Project, SfxId } from '../core/types';
import { EffectOverlays, FxVideo, placeEffects } from '../effects/runtime';
import { SoftLook } from './looks/Soft';
import { ScrapbookLook } from './looks/Scrapbook';
import { SignatureLook } from './looks/Signature';
import { HeadlineLook } from './looks/Headline';

export const LOOK_COMPONENTS: Record<LookId, React.FC<LookProps>> = {
  soft: SoftLook,
  scrapbook: ScrapbookLook,
  signature: SignatureLook,
  headline: HeadlineLook,
};

export const sfxUrl = (id: SfxId) => `${import.meta.env.BASE_URL}sfx/${id}.wav`;

export type MainProps = { project: Project };

/** Root composition: cut video + look + sound effects. Used by Player and export. */
export const Main: React.FC<MainProps> = ({ project }) => {
  const { width, height } = useVideoConfig();
  const timeline = useMemo(() => buildTimeline(project), [project]);
  const Look = LOOK_COMPONENTS[project.look] ?? SoftLook;

  const placed = useMemo(() => placeEffects(project, timeline), [project, timeline]);

  const sfxCues = useMemo(() => {
    if (!project.sound.enabled) return [];
    const cues: Array<{ at: number; id: SfxId }> = [];
    for (const p of placed) {
      // undefined = effect default, null = muted on purpose.
      const own = p.instance.props.sfx as SfxId | null | undefined;
      const id = own === undefined ? p.def.sfx : own;
      if (id) cues.push({ at: p.startFrame / FPS, id });
    }
    if (project.title.enabled && project.sound.titleSfx) cues.push({ at: 0, id: project.sound.titleSfx });
    for (const w of timeline.words) {
      const id = w.sfx ?? (w.emphasis ? project.sound.autoOnEmphasis : null);
      if (id) cues.push({ at: w.outStart, id });
    }
    return cues;
  }, [project, timeline, placed]);

  if (!project.video) {
    return <AbsoluteFill style={{ backgroundColor: '#111' }} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Look project={project} timeline={timeline} width={width} height={height} video={<FxVideo placed={placed} project={project} timeline={timeline} />} />
      <EffectOverlays placed={placed} project={project} timeline={timeline} />
      {sfxCues.map((c, i) => (
        <Sequence key={i} from={Math.round(c.at * FPS)} durationInFrames={FPS * 2}>
          <Audio src={sfxUrl(c.id)} volume={project.sound.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
