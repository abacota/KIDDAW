import { describe, expect, it } from 'vitest';
import { demoSong } from '../song/demo';
import { TICKS_PER_BEAT as BEAT } from '../song/song';
import { buildTimeline, dynamicGain, eventsByWindow, sectionAt, songTickAt, WINDOW } from './timeline';

const BAR = BEAT * 4;

describe('timeline', () => {
  it('the form plays its sections in order: A B A', () => {
    const t = buildTimeline(demoSong());
    expect(t.sections.map(s => [s.name, s.start, s.length])).toEqual([
      ['A', 0, 2 * BAR],
      ['B', 2 * BAR, 2 * BAR],
      ['A', 4 * BAR, 2 * BAR],
    ]);
    expect(t.length).toBe(6 * BAR);
  });

  it('a one-bar pattern repeats to fill a two-bar section', () => {
    const t = buildTimeline(demoSong());
    const kicks = t.events.filter(e => e.layerId === 'kick' && e.tick < 2 * BAR);
    expect(kicks.map(e => e.tick)).toEqual([0, 2 * BEAT, BAR, BAR + 2 * BEAT]);
  });

  it('a layer missing from a section rests there (thin and thick texture)', () => {
    const t = buildTimeline(demoSong());
    const inB = (e: { tick: number }) => e.tick >= 2 * BAR && e.tick < 4 * BAR;
    expect(t.events.some(e => e.layerId === 'kick' && inB(e))).toBe(false);
    expect(t.events.some(e => e.layerId === 'stomp' && inB(e))).toBe(true);
    expect(t.events.some(e => e.layerId === 'stomp' && !inB(e))).toBe(false);
  });

  it('a pattern longer than its section is cut off at the section end', () => {
    const song = demoSong();
    song.sections[0].bars = 1;
    const t = buildTimeline(song);
    const melodyInA = t.events.filter(e => e.layerId === 'melody' && e.tick < BAR);
    expect(melodyInA.every(e => e.tick + e.length <= BAR)).toBe(true);
    expect(t.events.some(e => e.layerId === 'melody' && e.tick === BAR && e.pitch === 67)).toBe(false);
  });

  it('a crescendo gets louder through the section', () => {
    const t = buildTimeline(demoSong());
    const bInB = t.events.filter(e => e.layerId === 'bass' && e.tick >= 2 * BAR && e.tick < 4 * BAR && e.pitch === 48);
    expect(bInB[1].velocity).toBeGreaterThan(bInB[0].velocity);
    expect(dynamicGain({ from: 'ff', to: 'ff' }, 0.5)).toBe(1);
    expect(dynamicGain({ from: 'p', to: 'f' }, 1)).toBeCloseTo(dynamicGain({ from: 'f', to: 'f' }, 0));
  });

  it('swing moves the ti of ta-ti later, and only the ti', () => {
    const song = demoSong();
    song.swing = 100;
    const hats = buildTimeline(song).events.filter(e => e.layerId === 'hihat' && e.tick < BEAT);
    expect(hats.map(e => e.tick)).toEqual([0, BEAT / 2 + BEAT / 6]);
  });

  it('every event lands in the window it starts in', () => {
    const t = buildTimeline({ ...demoSong(), swing: 60 });
    const windows = eventsByWindow(t.events);
    expect([...windows.values()].flat().length).toBe(t.events.length);
    for (const [index, events] of windows) {
      for (const e of events) expect(Math.floor(e.tick / WINDOW)).toBe(index);
    }
  });

  it('the clock circles back at the end of a loop', () => {
    const loop = { start: 2 * BAR, end: 4 * BAR };
    expect(songTickAt(0, 2 * BAR, loop)).toBe(2 * BAR);
    expect(songTickAt(2 * BAR - 1, 2 * BAR, loop)).toBe(4 * BAR - 1);
    expect(songTickAt(2 * BAR, 2 * BAR, loop)).toBe(2 * BAR);
    expect(songTickAt(5 * BAR, 0, loop)).toBe(3 * BAR);
    expect(songTickAt(5 * BAR, 0, null)).toBe(5 * BAR);
  });

  it('knows which section is playing', () => {
    const t = buildTimeline(demoSong());
    expect(sectionAt(t, 0)?.formIndex).toBe(0);
    expect(sectionAt(t, 2 * BAR)?.name).toBe('B');
    expect(sectionAt(t, 5 * BAR)?.formIndex).toBe(2);
    expect(sectionAt(t, 6 * BAR)).toBeUndefined();
  });
});
