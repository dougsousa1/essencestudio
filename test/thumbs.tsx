// Dev-only: renders library thumbnails of a few effects at several moments.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Thumbnail } from '@remotion/player';
import { EffectStage, stageDuration } from '../src/effects/EffectStage';
import { getEffect } from '../src/effects/registry';

const ids = new URLSearchParams(location.search).get('ids')?.split(',') ?? [];
const fr = [0.05, 0.1, 0.15, 0.25, 0.35, 0.45, 0.55];
const App = () => (
  <div>
    {ids.map((id) => (
      <div key={id} style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {fr.map((f) => {
          const def = getEffect(id)!;
          const frame = 8 + Math.round(def.defaultDuration * 30 * f);
          return (
            <div key={f} style={{ width: 160, height: 200, position: 'relative' }}>
              <Thumbnail component={EffectStage} inputProps={{ effectId: id }} durationInFrames={stageDuration(id, 30)} compositionWidth={1080} compositionHeight={1350} fps={30} frameToDisplay={frame} style={{ width: 160, height: 200 }} />
              <span style={{ position: 'absolute', left: 4, top: 2, fontSize: 11, background: '#fff' }}>{id} {f}</span>
            </div>
          );
        })}
      </div>
    ))}
  </div>
);
createRoot(document.getElementById('root')!).render(<App />);
