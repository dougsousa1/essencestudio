import type { LookId, Project, Style } from './types';

export type Palette = { id: string; name: string; colors: Style['colors'] };

export const PALETTES: Palette[] = [
  { id: 'rose', name: 'Rose', colors: { text: '#FFFFFF', accent: '#F2A9C0', background: '#1C1519', secondary: '#FBE7EE' } },
  { id: 'cream', name: 'Cream', colors: { text: '#FFF8EC', accent: '#E9C98B', background: '#F3EBDD', secondary: '#2B241C' } },
  { id: 'lemon', name: 'Lemon', colors: { text: '#FFFFFF', accent: '#F4E36B', background: '#1D1B12', secondary: '#FFF7C2' } },
  { id: 'noir', name: 'Noir', colors: { text: '#FFFFFF', accent: '#FFFFFF', background: '#0E0E10', secondary: '#9A9AA2' } },
  { id: 'ocean', name: 'Ocean', colors: { text: '#FFFFFF', accent: '#7CC6FF', background: '#0B1622', secondary: '#D7ECFF' } },
  { id: 'mint', name: 'Mint', colors: { text: '#FFFFFF', accent: '#8FE3B7', background: '#0F1A15', secondary: '#E2FBEF' } },
  { id: 'sunset', name: 'Sunset', colors: { text: '#FFFFFF', accent: '#FF8A5B', background: '#1E120D', secondary: '#FFE1D2' } },
];

export const BASE_STYLE: Style = {
  palette: 'rose',
  colors: PALETTES[0].colors,
  titleFont: 'CormorantGaramond',
  captionFont: 'Inter',
  accentFont: 'Fraunces',
  captionSize: 54,
  captionY: 0.72,
  captionMode: 'word',
  captionAnimation: 'pop',
  uppercase: false,
  wordsPerPage: 4,
  motion: 'soft',
  grain: 0,
  vignette: 0.2,
  grade: { brightness: 1, contrast: 1, saturate: 1, warmth: 0 },
};

export type LookMeta = {
  id: LookId;
  name: string;
  tagline: string;
  description: string;
  style: Partial<Style>;
};

export const LOOKS: LookMeta[] = [
  {
    id: 'soft',
    name: 'Soft',
    tagline: 'Beleza, lifestyle, moda',
    description: 'Títulos serifados, tons creme, movimento suave e legenda discreta. Calmo e sofisticado.',
    style: {
      palette: 'cream',
      colors: PALETTES[1].colors,
      titleFont: 'CormorantGaramond',
      captionFont: 'Inter',
      accentFont: 'Fraunces',
      captionSize: 44,
      captionY: 0.74,
      captionMode: 'phrase',
      captionAnimation: 'fade',
      uppercase: false,
      wordsPerPage: 4,
      motion: 'soft',
      grain: 0.08,
      vignette: 0.25,
      grade: { brightness: 1.03, contrast: 0.96, saturate: 0.9, warmth: 0.25 },
    },
  },
  {
    id: 'scrapbook',
    name: 'Scrapbook',
    tagline: 'Criativo, divertido, colagem',
    description: 'Vídeo em moldura sobre estampa, palavras-chave em itálico e recortes de papel.',
    style: {
      palette: 'rose',
      colors: { text: '#FFFFFF', accent: '#F2A9C0', background: '#B8A48C', secondary: '#2A1E16' },
      titleFont: 'Caveat',
      captionFont: 'Poppins',
      accentFont: 'InstrumentSerif',
      captionSize: 56,
      captionY: 0.62,
      captionMode: 'phrase',
      captionAnimation: 'pop',
      uppercase: false,
      wordsPerPage: 3,
      motion: 'none',
      grain: 0.12,
      vignette: 0,
      grade: { brightness: 1, contrast: 1.04, saturate: 1, warmth: 0.1 },
    },
  },
  {
    id: 'signature',
    name: 'Signature',
    tagline: 'Elegante, editorial, cinema',
    description: 'Título grande serifado com contador de tempo, legenda clara e zoom suave.',
    style: {
      palette: 'cream',
      colors: { text: '#FFF8EC', accent: '#F2E3C4', background: '#141110', secondary: '#C9B79A' },
      titleFont: 'PlayfairDisplay',
      captionFont: 'CormorantGaramond',
      accentFont: 'InstrumentSerif',
      captionSize: 58,
      captionY: 0.7,
      captionMode: 'karaoke',
      captionAnimation: 'fade',
      uppercase: false,
      wordsPerPage: 5,
      motion: 'soft',
      grain: 0.05,
      vignette: 0.35,
      grade: { brightness: 1, contrast: 1.06, saturate: 0.92, warmth: 0.15 },
    },
  },
  {
    id: 'headline',
    name: 'Headline',
    tagline: 'Especialistas, coaches, marcas',
    description: 'Tipografia forte, palavra destacada com marca-texto e zoom de impacto. Limpo e fácil de ler.',
    style: {
      palette: 'rose',
      colors: { text: '#FFFFFF', accent: '#F2A9C0', background: '#1C1519', secondary: '#FBE7EE' },
      titleFont: 'Rubik',
      captionFont: 'InterTight',
      accentFont: 'Fraunces',
      captionSize: 64,
      captionY: 0.68,
      captionMode: 'word',
      captionAnimation: 'pop',
      uppercase: true,
      wordsPerPage: 3,
      motion: 'punch',
      grain: 0,
      vignette: 0.15,
      grade: { brightness: 1, contrast: 1.08, saturate: 1.05, warmth: 0 },
    },
  },
];

export const lookMeta = (id: LookId) => LOOKS.find((l) => l.id === id) ?? LOOKS[0];

export const styleForLook = (id: LookId): Style => ({ ...BASE_STYLE, ...lookMeta(id).style });

export const initialProject = (): Project => ({
  video: null,
  words: [],
  cut: { removeSilences: true, minSilence: 0.45, padding: 0.08 },
  format: '9:16',
  look: 'soft',
  style: styleForLook('soft'),
  title: { enabled: true, kicker: 'ESSENCE · 01', text: 'Seu título aqui', durationInSeconds: 3 },
  sound: { enabled: true, volume: 0.5, autoOnEmphasis: 'pop', titleSfx: 'shimmer' },
});
