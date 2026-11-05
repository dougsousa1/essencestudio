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

  // Leave room for the phone bezel.
  const bezel = 10;
  return (
    <div ref={boxRef} className="flex h-full w-full items-center justify-center">
      {project.video ? (
        <div style={{ width: w, height: h, padding: bezel }} className="rounded-[34px] bg-fg shadow-[0_30px_60px_rgba(16,24,40,0.22)]">
          <div className="h-full w-full overflow-hidden rounded-[26px] bg-black">
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
        </div>
      ) : (
        <div style={{ width: w, height: h, padding: bezel }} className="rounded-[34px] bg-fg/90 shadow-[0_30px_60px_rgba(16,24,40,0.18)]">
          <div className="flex h-full w-full flex-col items-center justify-center rounded-[26px] bg-subtle px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-xl text-brand">▶</div>
            <p className="mt-3 max-w-[200px] text-sm text-muted">Envie um vídeo para ver a prévia aqui, ao vivo.</p>
          </div>
        </div>
      )}
    </div>
  );
};
