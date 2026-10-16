import { describe, expect, it } from 'vitest';
import { FIGURES, FIGURE_INFO, figuresIn, fits, readBeats, writeBeat } from './rhythm';
import { TICKS_PER_BEAT as BEAT, type Pattern } from './song';

const empty = (beats: number): Pattern => ({ id: 'p', length: beats * BEAT, notes: [] });

describe('rhythm syllables', () => {
  it('an empty pattern reads as rests', () => {
    expect(readBeats(empty(4)).map(c => c.figure)).toEqual(['rest', 'rest', 'rest', 'rest']);
  });

  it('every figure written on a beat reads back as the same figure', () => {
    for (const figure of FIGURES) {
      const p = writeBeat(empty(4), 1, figure);
      const cells = readBeats(p);
      expect(cells[1].figure).toBe(figure);
      if (figure === 'ta-ah') expect(cells[2].figure).toBe('held');
    }
  });

  it('ta ta-ti ta-ah reads in order', () => {
    let p = writeBeat(empty(4), 0, 'ta');
    p = writeBeat(p, 1, 'ta-ti');
    p = writeBeat(p, 2, 'ta-ah');
    expect(readBeats(p).map(c => c.figure)).toEqual(['ta', 'ta-ti', 'ta-ah', 'held']);
  });

  it('writing over a beat replaces it', () => {
    const p = writeBeat(writeBeat(empty(4), 0, 'ta-ka-ti-ki'), 0, 'ta');
    expect(p.notes).toEqual([{ start: 0, length: BEAT, pitch: 0, velocity: 96 }]);
  });

  it('writing on the held beat of a ta-ah turns the ta-ah into a ta', () => {
    const p = writeBeat(writeBeat(empty(4), 0, 'ta-ah'), 1, 'ta-ti');
    expect(readBeats(p).map(c => c.figure)).toEqual(['ta', 'ta-ti', 'rest', 'rest']);
  });

  it('a ta-ah needs two beats, so it cannot start on the last beat', () => {
    expect(fits(empty(4), 3, 'ta-ah')).toBe(false);
    expect(writeBeat(empty(4), 3, 'ta-ah')).toEqual(empty(4));
  });

  it('a rhythm with no syllables yet reads as other, not as a wrong syllable', () => {
    const syncopated: Pattern = { id: 'p', length: 4 * BEAT, notes: [{ start: 12, length: 12, pitch: 0, velocity: 96 }] };
    expect(readBeats(syncopated)[0].figure).toBe('other');
  });

  it('each sound has a syllable (ta-ah also says "ah" for the held beat)', () => {
    for (const f of FIGURES) {
      const extra = f === 'ta-ah' ? 1 : 0;
      expect(FIGURE_INFO[f].syllables.length).toBe(FIGURE_INFO[f].sounds.length + extra);
    }
    expect(FIGURE_INFO['ta-ti'].syllables).toEqual(['ta', 'ti']);
  });

  it('reads which syllables a ladder step names', () => {
    expect(figuresIn(['Steady beat; ta and rest; fast and slow', 'ta-ti'])).toEqual(['ta', 'ta-ti', 'rest']);
    expect(figuresIn(['ta-ti-ki and ta-ka-ti; meter in 3'])).toEqual(['ta-ti-ki', 'ta-ka-ti']);
    expect(figuresIn(['ta-ah; meter in 2 and 4', 'ta-ka-ti-ki'])).toEqual(['ta-ah', 'ta-ka-ti-ki']);
    expect(figuresIn(['Steady beat'])).toEqual([]);
  });
});
