/**
 * The sounds a layer can use. Names and facts only; the engine makes the actual sound.
 *
 * Each beat layer is one percussion sound (one row in Beat Lab), so every sound
 * has its own volume and can be heard on its own or left out.
 */

import type { LayerKind } from './song';

export type Family = 'percussion' | 'orff' | 'keyboard' | 'strings' | 'winds' | 'voices' | 'electronic';

export const KITS = [
  { id: 'body', name: 'Body percussion' },
  { id: 'drum-kit', name: 'Drum kit' },
] as const;
export type KitId = (typeof KITS)[number]['id'];

export interface SoundInfo {
  id: string;
  name: string;
  kind: LayerKind;
  family: Family;
  /** Beat sounds only: which group of sounds it belongs to. */
  kit?: KitId;
}

export const SOUNDS: readonly SoundInfo[] = [
  { id: 'stomp', name: 'Stomp', kind: 'beat', family: 'percussion', kit: 'body' },
  { id: 'pat', name: 'Pat', kind: 'beat', family: 'percussion', kit: 'body' },
  { id: 'clap', name: 'Clap', kind: 'beat', family: 'percussion', kit: 'body' },
  { id: 'snap', name: 'Snap', kind: 'beat', family: 'percussion', kit: 'body' },
  { id: 'chest', name: 'Chest pat', kind: 'beat', family: 'percussion', kit: 'body' },
  { id: 'kick', name: 'Kick drum', kind: 'beat', family: 'percussion', kit: 'drum-kit' },
  { id: 'snare', name: 'Snare drum', kind: 'beat', family: 'percussion', kit: 'drum-kit' },
  { id: 'hihat', name: 'Hi-hat', kind: 'beat', family: 'percussion', kit: 'drum-kit' },
  { id: 'openhat', name: 'Open hi-hat', kind: 'beat', family: 'percussion', kit: 'drum-kit' },
  { id: 'tom', name: 'High tom', kind: 'beat', family: 'percussion', kit: 'drum-kit' },
  { id: 'lowtom', name: 'Low tom', kind: 'beat', family: 'percussion', kit: 'drum-kit' },
  { id: 'crash', name: 'Crash cymbal', kind: 'beat', family: 'percussion', kit: 'drum-kit' },
  { id: 'ride', name: 'Ride cymbal', kind: 'beat', family: 'percussion', kit: 'drum-kit' },
  { id: 'xylophone', name: 'Xylophone', kind: 'pitched', family: 'orff' },
  { id: 'piano', name: 'Piano', kind: 'pitched', family: 'keyboard' },
  { id: 'bass', name: 'Bass', kind: 'pitched', family: 'electronic' },
  { id: 'chip', name: 'Chip', kind: 'pitched', family: 'electronic' },
];

export function soundById(id: string): SoundInfo | undefined {
  return SOUNDS.find(s => s.id === id);
}

const DEFAULTS: Record<LayerKind, string> = { beat: 'clap', pitched: 'xylophone' };

export function defaultSound(kind: LayerKind): SoundInfo {
  return soundById(DEFAULTS[kind])!;
}

export function soundsInKit(kit: KitId): SoundInfo[] {
  return SOUNDS.filter(s => s.kit === kit);
}
