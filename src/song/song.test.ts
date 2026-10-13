import { describe, expect, it } from 'vitest';
import { demoSong } from './demo';
import { barTicks, createSong, parseSong, TICKS_PER_BEAT } from './song';

describe('songs', () => {
  it('the demo song is already clean, so checking it changes nothing', () => {
    expect(parseSong(demoSong())).toEqual(demoSong());
  });

  it('a new song is clean', () => {
    const song = createSong();
    expect(parseSong(song)).toEqual(song);
  });

  it('things that are not songs are turned away', () => {
    for (const bad of [null, 42, 'song', [], {}, { version: 2, id: 'x' }, { ...demoSong(), sections: [] }]) {
      expect(parseSong(bad)).toBeNull();
    }
  });

  it('numbers out of range are brought back in range', () => {
    const song = parseSong({ ...demoSong(), tempo: 9999, swing: -5, meter: { beats: 0, unit: 7 } })!;
    expect(song.tempo).toBe(240);
    expect(song.swing).toBe(0);
    expect(song.meter).toEqual({ beats: 1, unit: 4 });
  });

  it('notes are sorted, kept inside their pattern, and doubled notes are dropped', () => {
    const demo = demoSong();
    demo.layers[2].patterns[0].notes = [
      { start: 96, length: 48, pitch: 64, velocity: 96 },
      { start: 0, length: 9999, pitch: 67, velocity: 500 },
      { start: 96, length: 24, pitch: 64, velocity: 96 },
      { start: -1, length: 48, pitch: 60, velocity: 96 },
    ];
    const notes = parseSong(demo)!.layers[2].patterns[0].notes;
    expect(notes).toEqual([
      { start: 0, length: demo.layers[2].patterns[0].length, pitch: 67, velocity: 127 },
      { start: 96, length: 48, pitch: 64, velocity: 96 },
    ]);
  });

  it('a section that points at a missing pattern or layer just rests there', () => {
    const demo = demoSong();
    demo.sections[0].parts = { drums: 'nope', ghost: 'rock', melody: 'tune-a' };
    expect(parseSong(demo)!.sections[0].parts).toEqual({ melody: 'tune-a' });
  });

  it('the form only lists sections that exist', () => {
    expect(parseSong({ ...demoSong(), form: ['A', 'Z', 'B'] })!.form).toEqual(['A', 'B']);
    expect(parseSong({ ...demoSong(), form: [] })!.form).toEqual(['A']);
  });

  it('an unknown sound falls back to one that fits the layer', () => {
    const demo = demoSong();
    demo.layers[0].sound = 'xylophone';
    demo.layers[2].sound = 'kazoo-3000';
    const song = parseSong(demo)!;
    expect(song.layers[0].sound).toBe('drum-kit');
    expect(song.layers[2].sound).toBe('xylophone');
  });

  it('bar lengths follow the meter', () => {
    expect(barTicks({ beats: 4, unit: 4 })).toBe(4 * TICKS_PER_BEAT);
    expect(barTicks({ beats: 3, unit: 4 })).toBe(3 * TICKS_PER_BEAT);
    expect(barTicks({ beats: 6, unit: 8 })).toBe(3 * TICKS_PER_BEAT);
  });
});
