import { describe, expect, it } from 'vitest';
import { demoSong } from './demo';
import { songFromLink, songToLink } from './link';
import { parseSong, TICKS_PER_BEAT, type Song } from './song';

/** A big Studio-sized song: 16 layers, 8 patterns each, 64 notes per pattern, cleaned like any song. */
function bigSong(): Song {
  const song = demoSong();
  let seed = 7;
  const random = (n: number) => (seed = (seed * 16807) % 2147483647) % n;
  song.layers = Array.from({ length: 16 }, (_, l) => ({
    id: `layer${l}`,
    name: `Layer ${l + 1}`,
    kind: l < 4 ? ('beat' as const) : ('pitched' as const),
    sound: l < 4 ? 'drum-kit' : 'piano',
    volume: 80,
    pan: 0,
    muted: false,
    solo: false,
    patterns: Array.from({ length: 8 }, (_, p) => {
      const length = TICKS_PER_BEAT * 16;
      const notes = Array.from({ length: 64 }, (_, n) => ({
        start: n * 12,
        length: 12 + random(36),
        pitch: l < 4 ? random(5) : 48 + random(36),
        velocity: 40 + random(87),
      }));
      return { id: `p${p}`, length, notes };
    }),
  }));
  song.sections = song.sections.map(s => ({ ...s, parts: {} }));
  return parseSong(song)!;
}

describe('song links', () => {
  it('a song link turns back into the exact same song', async () => {
    const song = demoSong();
    expect(await songFromLink(await songToLink(song))).toEqual(song);
  });

  it('a big song survives the trip too', async () => {
    const song = bigSong();
    expect(await songFromLink(await songToLink(song))).toEqual(song);
  });

  it('a link uses only letters that are safe in a web address', async () => {
    expect(await songToLink(bigSong())).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('the demo song makes a short link', async () => {
    expect((await songToLink(demoSong())).length).toBeLessThan(1000);
  });

  it('a broken or cut-off link gives no song instead of crashing', async () => {
    const link = await songToLink(demoSong());
    for (const bad of ['', 'hello', link.slice(0, link.length - 10), link.slice(0, 20), '9' + link.slice(1), link + '!!']) {
      expect(await songFromLink(bad)).toBeNull();
    }
  });
});
