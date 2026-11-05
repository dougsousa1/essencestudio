// Google Fonts available in the studio. Loaded on demand through
// @remotion/google-fonts so they work in the preview and in the export.

type FontEntry = { label: string; family: string; kind: 'serif' | 'sans' | 'display' | 'script'; load: () => Promise<{ loadFont: (...args: any[]) => { waitUntilDone: () => Promise<unknown> } }> };

export const FONTS: Record<string, FontEntry> = {
  Inter: { label: 'Inter', family: 'Inter', kind: 'sans', load: () => import('@remotion/google-fonts/Inter') },
  InterTight: { label: 'Inter Tight', family: 'Inter Tight', kind: 'sans', load: () => import('@remotion/google-fonts/InterTight') },
  Montserrat: { label: 'Montserrat', family: 'Montserrat', kind: 'sans', load: () => import('@remotion/google-fonts/Montserrat') },
  Poppins: { label: 'Poppins', family: 'Poppins', kind: 'sans', load: () => import('@remotion/google-fonts/Poppins') },
  SpaceGrotesk: { label: 'Space Grotesk', family: 'Space Grotesk', kind: 'sans', load: () => import('@remotion/google-fonts/SpaceGrotesk') },
  Rubik: { label: 'Rubik', family: 'Rubik', kind: 'display', load: () => import('@remotion/google-fonts/Rubik') },
  Unbounded: { label: 'Unbounded', family: 'Unbounded', kind: 'display', load: () => import('@remotion/google-fonts/Unbounded') },
  Anton: { label: 'Anton', family: 'Anton', kind: 'display', load: () => import('@remotion/google-fonts/Anton') },
  BebasNeue: { label: 'Bebas Neue', family: 'Bebas Neue', kind: 'display', load: () => import('@remotion/google-fonts/BebasNeue') },
  Syne: { label: 'Syne', family: 'Syne', kind: 'display', load: () => import('@remotion/google-fonts/Syne') },
  Fraunces: { label: 'Fraunces', family: 'Fraunces', kind: 'serif', load: () => import('@remotion/google-fonts/Fraunces') },
  PlayfairDisplay: { label: 'Playfair Display', family: 'Playfair Display', kind: 'serif', load: () => import('@remotion/google-fonts/PlayfairDisplay') },
  InstrumentSerif: { label: 'Instrument Serif', family: 'Instrument Serif', kind: 'serif', load: () => import('@remotion/google-fonts/InstrumentSerif') },
  CormorantGaramond: { label: 'Cormorant Garamond', family: 'Cormorant Garamond', kind: 'serif', load: () => import('@remotion/google-fonts/CormorantGaramond') },
  DMSerifDisplay: { label: 'DM Serif Display', family: 'DM Serif Display', kind: 'serif', load: () => import('@remotion/google-fonts/DMSerifDisplay') },
  Italiana: { label: 'Italiana', family: 'Italiana', kind: 'serif', load: () => import('@remotion/google-fonts/Italiana') },
  Caveat: { label: 'Caveat', family: 'Caveat', kind: 'script', load: () => import('@remotion/google-fonts/Caveat') },
  PinyonScript: { label: 'Pinyon Script', family: 'Pinyon Script', kind: 'script', load: () => import('@remotion/google-fonts/PinyonScript') },
};

const loaded = new Map<string, Promise<void>>();

export const ensureFont = (key: string): Promise<void> => {
  const entry = FONTS[key];
  if (!entry) return Promise.resolve();
  let p = loaded.get(key);
  if (!p) {
    p = entry
      .load()
      .then((m) => m.loadFont('normal', { subsets: ['latin', 'latin-ext'] }).waitUntilDone())
      .then(() =>
        // Italic is used for emphasis words; not every family has it.
        entry
          .load()
          .then((m) => m.loadFont('italic', { subsets: ['latin', 'latin-ext'] }).waitUntilDone())
          .catch(() => undefined),
      )
      .then(() => undefined)
      .catch(() => undefined);
    loaded.set(key, p);
  }
  return p;
};

export const fontFamily = (key: string) => {
  const entry = FONTS[key];
  return entry ? `'${entry.family}', sans-serif` : 'sans-serif';
};
