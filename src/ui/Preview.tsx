import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { Main } from '../remotion/Main';
import { buildTimeline, durationInFrames, FORMAT_SIZE, FPS } from '../core/timeline';
import { ensureFont } from '../core/fonts';
import { useStudio } from '../core/store';

let activePlayer: PlayerRef | null = null;

/** Jump the main preview to a time (seconds) and play. */
export const seekPreview = (seconds: number) => {
  if (!activePlayer) return;
  activePlayer.seekTo(Math.max(0, Math.round(seconds * FPS)));
  activePlayer.play();
};

/** Live preview: re-renders instantly whenever the project changes. */
export const Preview: React.FC = () => {
  const project = useStudio((s) => s.project);
  const playerRef = useRef<PlayerRef>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 400, h: 700 });
  const [fontsTick, setFontsTick] = useState(0);
  const size = FORMAT_SIZE[project.format];
  const timeline = useMemo(() => buildTimeline(project), [project]);
  const frames = durationInFrames(timeline);

  useEffect(() => {
    const { titleFont, captionFont, accentFont } = project.style;
    Promise.all([ensureFont(titleFont), ensureFont(captionFont), ensureFont(accentFont)]).then(() => setFontsTick((t) => t + 1));
  }, [project.style]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the composition inside the available stage.
  const ratio = size.width / size.height;
  let w = box.w;
  let h = w / ratio;
  if (h > box.h) {
    h = box.h;
    w = h * ratio;
  }

  const setPlayhead = useStudio((s) => s.setPlayhead);
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setPlayhead(e.detail.frame / FPS);
    p.addEventListener('frameupdate', onFrame);
    return () => p.removeEventListener('frameupdate', onFrame);
  }, [project.video, setPlayhead]);

  useEffect(() => {
    activePlayer = playerRef.current;
    // Handy for automated checks in development.
    if (import.meta.env.DEV) (window as unknown as { __player?: PlayerRef | null }).__player = playerRef.current;
  });

  const inputProps = useMemo(() => ({ project }), [project, fontsTick]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={boxRef} className="flex h-full w-full items-center justify-center">
      {project.video ? (
        <div style={{ width: w, height: h }} className="overflow-hidden rounded-[22px] shadow-[0_30px_80px_rgba(0,0,0,0.55)] ring-1 ring-line-strong">
          <Player
            ref={playerRef}
            component={Main}
            inputProps={inputProps}
            durationInFrames={frames}
            compositionWidth={size.width}
            compositionHeight={size.height}
            fps={FPS}
            controls
            loop
            clickToPlay
            spaceKeyToPlayOrPause
            acknowledgeRemotionLicense
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      ) : (
        <div style={{ width: w, height: h }} className="flex flex-col items-center justify-center rounded-[22px] border border-dashed border-line-strong bg-panel/60 text-center">
          <div className="font-display text-3xl italic text-rose">Essence</div>
          <p className="mt-2 max-w-[220px] text-sm text-muted">Envie um vídeo para ver a prévia aqui, ao vivo.</p>
        </div>
      )}
    </div>
  );
};
