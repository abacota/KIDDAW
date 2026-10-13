/**
 * The sounds a layer can use. Names and facts only; the engine makes the actual sound.
 *
 * Beat layers number their lanes the same way in every kit, so switching from the
 * drum kit to body percussion keeps the rhythm: lane 0 is low (kick, stomp),
 * lane 1 is middle (snare, pat), lane 2 is high (hi-hat, snap), lane 3 is clap.
 */

import type { LayerKind } from './song';

export type Family = 'percussion' | 'orff' | 'keyboard' | 'strings' | 'winds' | 'voices' | 'electronic';

export interface SoundInfo {
  id: string;
  name: string;
  kind: LayerKind;
  family: Family;
  /** Beat layers only: the name of each lane, lowest first. */
  lanes?: string[];
}

export const SOUNDS: readonly SoundInfo[] = [
  { id: 'drum-kit', name: 'Drum kit', kind: 'beat', family: 'percussion', lanes: ['Kick drum', 'Snare drum', 'Hi-hat', 'Clap', 'Tom'] },
  { id: 'body', name: 'Body percussion', kind: 'beat', family: 'percussion', lanes: ['Stomp', 'Pat', 'Snap', 'Clap'] },
  { id: 'xylophone', name: 'Xylophone', kind: 'pitched', family: 'orff' },
  { id: 'piano', name: 'Piano', kind: 'pitched', family: 'keyboard' },
  { id: 'bass', name: 'Bass', kind: 'pitched', family: 'electronic' },
  { id: 'chip', name: 'Chip', kind: 'pitched', family: 'electronic' },
];

export function soundById(id: string): SoundInfo | undefined {
  return SOUNDS.find(s => s.id === id);
}

export function defaultSound(kind: LayerKind): SoundInfo {
  return SOUNDS.find(s => s.kind === kind)!;
}
