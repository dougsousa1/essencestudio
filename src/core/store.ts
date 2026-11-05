import { create } from 'zustand';
import { initialProject, styleForLook } from './presets';
import type { LookId, Project, Style, Word } from './types';

export type StepId = 'upload' | 'cut' | 'look' | 'sound' | 'export';

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
  setVideo: (video) => set((s) => ({ project: { ...s.project, video, words: [] } })),
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
