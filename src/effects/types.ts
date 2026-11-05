// Contract for the motion-graphics library.
// Each effect is a self-contained definition: metadata, editable fields and a Remotion component.
import type React from 'react';
import type { Project, SfxId, Style } from '../core/types';

export type CategoryId = 'cards' | 'camera' | 'text' | 'data' | 'stickers' | 'transitions';

export const CATEGORIES: Array<{ id: CategoryId; label: string; hint: string }> = [
  { id: 'cards', label: 'Cards e interface', hint: 'Celular, checklist, chat, telas de app' },
  { id: 'camera', label: 'Câmera e vídeo', hint: 'Zooms, vertigo, grade de clipes, P&B' },
  { id: 'text', label: 'Texto', hint: 'Títulos animados, máquina de escrever, marca-texto' },
  { id: 'data', label: 'Números e gráficos', hint: 'Contador, barras, gráfico de vidro, A vs B' },
  { id: 'stickers', label: 'Adesivos e colagem', hint: 'Polaroids, rabiscos, post-its, recortes' },
  { id: 'transitions', label: 'Transições', hint: 'Cortina, zoom através, flash' },
];

export type FieldDef =
  | { key: string; label: string; type: 'text'; default: string; placeholder?: string }
  | { key: string; label: string; type: 'textarea'; default: string; placeholder?: string }
  | { key: string; label: string; type: 'number'; default: number; min: number; max: number; step?: number }
  | { key: string; label: string; type: 'color'; default: string }
  | { key: string; label: string; type: 'select'; default: string; options: Array<{ value: string; label: string }> }
  | { key: string; label: string; type: 'toggle'; default: boolean };

/** What every effect component receives. */
export type EffectRenderProps<P = Record<string, any>> = {
  /** Field values (merged with defaults). */
  props: P;
  /** Frame relative to the effect start (0 = the anchor word is spoken). */
  frame: number;
  durationInFrames: number;
  fps: number;
  /** Composition size. Scale every pixel value by `width / 1080`. */
  width: number;
  height: number;
  /** Live project style: colors and fonts the user picked. */
  style: Style;
  project: Project;
  /** The anchor word text (handy default for titles). */
  word: string;
  /** Absolute frame where this effect starts (needed to sync extra video copies). */
  startFrame: number;
  /**
   * Renders an extra muted copy of the (cut) video in sync with the main one.
   * Use it for grids, ghosts, mirrors, polaroids of the footage, etc.
   */
  VideoCopy: React.FC<{ style?: React.CSSProperties }>;
};

export type EffectDef<P = Record<string, any>> = {
  id: string;
  name: string;
  /** Short English/technical term, like the reference library ("pop in", "punch zoom"). */
  term: string;
  category: CategoryId;
  description: string;
  /** Where the idea comes from. */
  source: 'yanny' | 'biblioteca' | 'remocn' | 'elements' | 'essence';
  defaultDuration: number;
  fields: FieldDef[];
  /** Default sound effect when the effect starts. */
  sfx?: SfxId;
  /** Drawn on top of the video (and captions). */
  Overlay?: React.FC<EffectRenderProps<P>>;
  /** Drawn behind the main video (the main video must be transformed to reveal it). */
  Backdrop?: React.FC<EffectRenderProps<P>>;
  /** CSS applied to the main video layer while the effect is active (transform, filter, opacity). */
  videoStyle?: (p: EffectRenderProps<P>) => React.CSSProperties;
};
