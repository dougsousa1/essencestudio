// Shared data model for the whole studio.
// Everything the video needs to render lives in `Project` so the same
// object drives the live Player preview and the MP4 export.

export type FormatId = '9:16' | '1:1' | '16:9';

export type SfxId = 'pop' | 'swish' | 'shimmer' | 'paper' | 'click' | 'whoosh';

export type Word = {
  id: string;
  text: string;
  /** Source video time, in seconds. */
  start: number;
  end: number;
  /** Cut this word out of the final video. */
  removed: boolean;
  /** Highlight this word in captions (accent font / color). */
  emphasis: boolean;
  /** Sound effect that plays when this word appears. */
  sfx: SfxId | null;
};

export type VideoSource = {
  url: string;
  name: string;
  durationInSeconds: number;
  width: number;
  height: number;
};

export type CaptionMode = 'word' | 'phrase' | 'karaoke' | 'off';
export type CaptionAnimation = 'pop' | 'fade' | 'slide' | 'typewriter';
export type MotionMode = 'none' | 'soft' | 'punch';

export type LookId = 'soft' | 'scrapbook' | 'signature' | 'headline';

export type Style = {
  palette: string;
  colors: {
    /** Main caption / title text. */
    text: string;
    /** Highlight color for emphasis words, chips, accents. */
    accent: string;
    /** Background color for framed layouts / chips. */
    background: string;
    /** Secondary color (patterns, outlines, details). */
    secondary: string;
  };
  titleFont: string;
  captionFont: string;
  accentFont: string;
  captionSize: number; // px at 1080 wide
  /** 0 = top, 1 = bottom. */
  captionY: number;
  captionMode: CaptionMode;
  captionAnimation: CaptionAnimation;
  uppercase: boolean;
  /** Words per caption page when captionMode is phrase/karaoke. */
  wordsPerPage: number;
  motion: MotionMode;
  grain: number; // 0..1
  vignette: number; // 0..1
  /** Basic color grade. */
  grade: { brightness: number; contrast: number; saturate: number; warmth: number };
};

export type TitleSettings = {
  enabled: boolean;
  kicker: string;
  text: string;
  durationInSeconds: number;
};

export type CutSettings = {
  removeSilences: boolean;
  /** Pauses longer than this (seconds) are removed. */
  minSilence: number;
  /** Breathing room kept around each word (seconds). */
  padding: number;
};

export type SoundSettings = {
  enabled: boolean;
  volume: number; // 0..1
  /** Automatically put a sound on emphasis words. */
  autoOnEmphasis: SfxId | null;
  titleSfx: SfxId | null;
};

/** A motion-graphics effect placed on the video ("one word = one effect"). */
export type EffectInstance = {
  id: string;
  /** Key in the effects registry. */
  effectId: string;
  /** Word that triggers the effect. When null (or the word was cut), `at` is used. */
  wordId: string | null;
  /** Start in output seconds, used when there is no anchor word. */
  at: number;
  durationInSeconds: number;
  props: Record<string, unknown>;
};

export type Project = {
  /** 'static' when rendered locally by the plugin: media come from the Remotion public folder. */
  assetBase?: 'static';
  video: VideoSource | null;
  words: Word[];
  effects: EffectInstance[];
  cut: CutSettings;
  format: FormatId;
  look: LookId;
  style: Style;
  title: TitleSettings;
  sound: SoundSettings;
};

/** A kept piece of the source video, placed on the output timeline. */
export type Segment = {
  srcStart: number;
  srcEnd: number;
  outStart: number;
};

/** A word placed on the output timeline (after cuts). */
export type TimedWord = Word & { outStart: number; outEnd: number };

export type Timeline = {
  segments: Segment[];
  words: TimedWord[];
  durationInSeconds: number;
};

/** Props every Look component receives. */
export type LookProps = {
  project: Project;
  timeline: Timeline;
  width: number;
  height: number;
  /** The (already cut) video layer. Looks decide where to place it. */
  video: React.ReactNode;
};
