import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Clip } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function snapToGrid(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

export function checkClipCollision(existing: Clip[], candidate: Clip): boolean {
  return existing.some(c => {
    if (c.trackId !== candidate.trackId || c.id === candidate.id) return false;
    const a0 = c.startTime, a1 = c.startTime + c.duration;
    const b0 = candidate.startTime, b1 = candidate.startTime + candidate.duration;
    return a0 < b1 && b0 < a1;
  });
}

const TRACK_NAME_POOL: Record<string, string[]> = {
  piano:       ['Sparkle Piano','Soft Keys','Rainbow Keys','Happy Piano','Magic Piano'],
  synth:       ['Fat Synth','Neon Beep','Bubble Synth','Space Synth','Glow Pad'],
  guitar:      ['Cozy Guitar','Sunny Strum','Plucky Strings','Campfire Guitar'],
  chiptune:    ['Pixel Beep','Arcade Blip','8-Bit Hero','Game Tune'],
  glockenspiel:['Twinkle Bells','Magic Chimes','Star Bells','Toy Glock'],
  drums:       ['Drum Beats','Boom Kit','Clap Trap','Beat Box','Rhythm Rock'],
};

export function generateTrackName(
  instrumentId: string | undefined,
  type: string,
  existingNames: string[]
): string {
  const key = type === 'drum-machine' ? 'drums' : (instrumentId || 'piano');
  const pool = TRACK_NAME_POOL[key] || TRACK_NAME_POOL.piano;
  const unused = pool.find(n => !existingNames.includes(n));
  if (unused) return unused;
  return `${pool[0]} ${existingNames.length + 1}`;
}

export function ticksToSeconds(ticks: number, bpm: number): number {
  return ticks * (60 / bpm / 4);
}
