import { create } from 'zustand';
import { initialProject, styleForLook } from './presets';
import type { EffectInstance, LookId, Project, Style, Word } from './types';
import { defaultProps, getEffect } from '../effects/registry';

export type StepId = 'upload' | 'cut' | 'look' | 'effects' | 'sound' | 'export';

type SavedPreset = { name: string; look: LookId; style: Style };

type StudioState = {
  project: Project;
  step: StepId;
  setStep: (s: StepId) => void;
  setVideo: (v: Project['video']) => void;
  setWords: (w: Word[]) => void;
  updateWord: (id: string, patch: Partial<Word>) => void;
  setCut: (patch: Partial<Project['cut']>) => void;
  setFormat: (f: Project['format']) => void;
  applyLook: (id: LookId) => void;
  setStyle: (patch: Partial<Style>) => void;
  setTitle: (patch: Partial<Project['title']>) => void;
  setSound: (patch: Partial<Project['sound']>) => void;
  /** Adds an effect anchored to a word (or at a time in seconds). Returns the new id. */
  addEffect: (effectId: string, opts?: { wordId?: string | null; at?: number; props?: Record<string, unknown> }) => string | null;
  updateEffect: (id: string, patch: Partial<EffectInstance>) => void;
  updateEffectProps: (id: string, patch: Record<string, unknown>) => void;
  removeEffect: (id: string) => void;
  /** Effect picked in the library, waiting to be placed in the studio. */
  pendingEffect: string | null;
  setPendingEffect: (id: string | null) => void;
  /** Current preview time (seconds), kept in sync by the Player. */
  playhead: number;
  setPlayhead: (t: number) => void;
  presets: SavedPreset[];
  savePreset: (name: string) => void;
  loadPreset: (name: string) => void;
};

const PRESET_KEY = 'essence-studio:presets';
const readPresets = (): SavedPreset[] => {
  try {
    return JSON.parse(localStorage.getItem(PRESET_KEY) ?? '[]');
  } catch {
    return [];
  }
};

export const useStudio = create<StudioState>((set, get) => ({
  project: initialProject(),
  step: 'upload',
  setStep: (step) => set({ step }),
  setVideo: (video) => set((s) => ({ project: { ...s.project, video, words: [], effects: [] } })),
  setWords: (words) => set((s) => ({ project: { ...s.project, words } })),
  updateWord: (id, patch) =>
    set((s) => ({
      project: { ...s.project, words: s.project.words.map((w) => (w.id === id ? { ...w, ...patch } : w)) },
    })),
  setCut: (patch) => set((s) => ({ project: { ...s.project, cut: { ...s.project.cut, ...patch } } })),
  setFormat: (format) => set((s) => ({ project: { ...s.project, format } })),
  applyLook: (look) => set((s) => ({ project: { ...s.project, look, style: styleForLook(look) } })),
  setStyle: (patch) => set((s) => ({ project: { ...s.project, style: { ...s.project.style, ...patch } } })),
  setTitle: (patch) => set((s) => ({ project: { ...s.project, title: { ...s.project.title, ...patch } } })),
  setSound: (patch) => set((s) => ({ project: { ...s.project, sound: { ...s.project.sound, ...patch } } })),
  addEffect: (effectId, opts = {}) => {
    const def = getEffect(effectId);
    if (!def) return null;
    const id = `fx${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
    const inst: EffectInstance = {
      id,
      effectId,
      wordId: opts.wordId ?? null,
      at: opts.at ?? get().playhead,
      durationInSeconds: def.defaultDuration,
      props: { ...defaultProps(def), ...(opts.props ?? {}) },
    };
    set((s) => ({ project: { ...s.project, effects: [...s.project.effects, inst] } }));
    return id;
  },
  updateEffect: (id, patch) =>
    set((s) => ({ project: { ...s.project, effects: s.project.effects.map((e) => (e.id === id ? { ...e, ...patch } : e)) } })),
  updateEffectProps: (id, patch) =>
    set((s) => ({
      project: { ...s.project, effects: s.project.effects.map((e) => (e.id === id ? { ...e, props: { ...e.props, ...patch } } : e)) },
    })),
  removeEffect: (id) => set((s) => ({ project: { ...s.project, effects: s.project.effects.filter((e) => e.id !== id) } })),
  pendingEffect: null,
  setPendingEffect: (pendingEffect) => set({ pendingEffect }),
  playhead: 0,
  setPlayhead: (playhead) => set({ playhead }),
  presets: readPresets(),
  savePreset: (name) => {
    const { project, presets } = get();
    const next = [...presets.filter((p) => p.name !== name), { name, look: project.look, style: project.style }];
    try {
      localStorage.setItem(PRESET_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: keep in memory only */
    }
    set({ presets: next });
  },
  loadPreset: (name) => {
    const p = get().presets.find((x) => x.name === name);
    if (p) set((s) => ({ project: { ...s.project, look: p.look, style: p.style } }));
  },
}));

// Handy for automated checks in development.
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __studio: typeof useStudio }).__studio = useStudio;
