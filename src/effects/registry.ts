import type { EffectDef } from './types';
import { CARD_EFFECTS } from './library/cards';
import { CAMERA_EFFECTS } from './library/camera';
import { TEXT_EFFECTS } from './library/text';
import { DATA_EFFECTS } from './library/data';
import { STICKER_EFFECTS } from './library/stickers';

export const EFFECTS: EffectDef<any>[] = [...CARD_EFFECTS, ...CAMERA_EFFECTS, ...TEXT_EFFECTS, ...DATA_EFFECTS, ...STICKER_EFFECTS];

const byId = new Map(EFFECTS.map((e) => [e.id, e]));
export const getEffect = (id: string) => byId.get(id);

export const defaultProps = (def: EffectDef<any>) => Object.fromEntries(def.fields.map((f) => [f.key, f.default]));
