import React from 'react';
import { Composition } from 'remotion';
import { Main, type MainProps } from './Main';
import { buildTimeline, durationInFrames, FORMAT_SIZE, FPS } from '../core/timeline';
import { initialProject } from '../core/presets';

export const Root: React.FC = () => (
  <Composition
    id="Main"
    component={Main}
    fps={FPS}
    width={1080}
    height={1920}
    durationInFrames={30}
    defaultProps={{ project: initialProject() } as MainProps}
    calculateMetadata={({ props }) => {
      // project.json written by Claude may only hold part of the settings.
      const base = initialProject();
      const p = props.project;
      const project = { ...base, ...p, style: { ...base.style, ...p.style }, title: { ...base.title, ...p.title }, sound: { ...base.sound, ...p.sound }, cut: { ...base.cut, ...p.cut } };
      const size = FORMAT_SIZE[project.format];
      return { props: { project }, durationInFrames: durationInFrames(buildTimeline(project)), width: size.width, height: size.height };
    }}
  />
);
