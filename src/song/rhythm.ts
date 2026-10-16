/**
 * Rhythm the way it's taught: one beat at a time, in Adam's syllables.
 * Turns syllables into notes and reads notes back as syllables.
 *
 * The syllables are ta, ta-ti, ta-ah, ta-ka-ti-ki, ta-ti-ki and ta-ka-ti.
 * "ti-ti" is never used.
 */

import { TICKS_PER_BEAT as BEAT, type Note, type Pattern } from './song';

export const FIGURES = ['ta', 'ta-ti', 'rest', 'ta-ah', 'ta-ka-ti-ki', 'ta-ti-ki', 'ta-ka-ti'] as const;
export type Figure = (typeof FIGURES)[number];

export interface FigureInfo {
  id: Figure;
  /** One syllable per sound, in order. Empty for a rest. */
  syllables: string[];
  /** How many beats it fills. */
  beats: 1 | 2;
  /** Each sound: [start, length] in ticks from the start of the figure. */
  sounds: [number, number][];
}

const E = BEAT / 2;
const S = BEAT / 4;

export const FIGURE_INFO: Record<Figure, FigureInfo> = {
  rest: { id: 'rest', syllables: [], beats: 1, sounds: [] },
  ta: { id: 'ta', syllables: ['ta'], beats: 1, sounds: [[0, BEAT]] },
  'ta-ti': { id: 'ta-ti', syllables: ['ta', 'ti'], beats: 1, sounds: [[0, E], [E, E]] },
  'ta-ah': { id: 'ta-ah', syllables: ['ta', 'ah'], beats: 2, sounds: [[0, 2 * BEAT]] },
  'ta-ka-ti-ki': { id: 'ta-ka-ti-ki', syllables: ['ta', 'ka', 'ti', 'ki'], beats: 1, sounds: [[0, S], [S, S], [E, S], [E + S, S]] },
  'ta-ti-ki': { id: 'ta-ti-ki', syllables: ['ta', 'ti', 'ki'], beats: 1, sounds: [[0, E], [E, S], [E + S, S]] },
  'ta-ka-ti': { id: 'ta-ka-ti', syllables: ['ta', 'ka', 'ti'], beats: 1, sounds: [[0, S], [S, S], [E, E]] },
};

/** What one beat box shows. */
export interface Cell {
  /** The beat this cell starts on, counting from 0. */
  beat: number;
  /** 'held' is the second beat of a ta-ah. 'other' is a rhythm made elsewhere that has no syllables yet. */
  figure: Figure | 'held' | 'other';
}

function notesInBeat(notes: Note[], beat: number): Note[] {
  return notes.filter(n => n.start >= beat * BEAT && n.start < (beat + 1) * BEAT);
}

function matches(notes: Note[], beat: number, info: FigureInfo): boolean {
  if (notes.length !== info.sounds.length) return false;
  return info.sounds.every(([start], i) => notes[i].start - beat * BEAT === start);
}

/** Reads a pattern beat by beat. */
export function readBeats(pattern: Pattern): Cell[] {
  const beats = Math.floor(pattern.length / BEAT);
  const cells: Cell[] = [];
  for (let beat = 0; beat < beats; beat++) {
    const here = notesInBeat(pattern.notes, beat);
    const previous = cells[beat - 1];
    if (here.length === 0 && previous?.figure === 'ta-ah') {
      cells.push({ beat, figure: 'held' });
      continue;
    }
    if (here.length === 1 && here[0].start === beat * BEAT && here[0].length >= 2 * BEAT && beat + 1 < beats &&
        notesInBeat(pattern.notes, beat + 1).length === 0) {
      cells.push({ beat, figure: 'ta-ah' });
      continue;
    }
    const figure = FIGURES.find(f => f !== 'ta-ah' && matches(here, beat, FIGURE_INFO[f]));
    cells.push({ beat, figure: figure ?? 'other' });
  }
  return cells;
}

/** Can this figure start on this beat? A ta-ah needs two beats of room. */
export function fits(pattern: Pattern, beat: number, figure: Figure): boolean {
  return beat >= 0 && beat + FIGURE_INFO[figure].beats <= Math.floor(pattern.length / BEAT);
}

/** Puts a figure on a beat, replacing whatever was there. A ta-ah it cuts into becomes a ta. */
export function writeBeat(pattern: Pattern, beat: number, figure: Figure, velocity = 96): Pattern {
  if (!fits(pattern, beat, figure)) return pattern;
  const info = FIGURE_INFO[figure];
  const from = beat * BEAT;
  const to = (beat + info.beats) * BEAT;

  const kept: Note[] = [];
  for (const n of pattern.notes) {
    if (n.start >= from && n.start < to) continue;
    // A long note from an earlier beat that runs into this one is shortened to end here.
    kept.push(n.start < from && n.start + n.length > from ? { ...n, length: from - n.start } : n);
  }
  const added = info.sounds.map(([start, length]) => ({ start: from + start, length, pitch: 0, velocity }));
  const notes = [...kept, ...added].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  return { ...pattern, notes };
}

/** Which figures a level allows, found by name in the Rhythm ladder's steps. */
export function figuresIn(stepTexts: string[]): Figure[] {
  const text = stepTexts.join(' ').toLowerCase();
  return FIGURES.filter(f => new RegExp(`(^|[^a-z-])${f}([^a-z-]|$)`).test(text));
}
