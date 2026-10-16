import { describe, expect, it } from 'vitest';
import { demoSong } from '../song/demo';
import { readSongAddress, songAddress } from './links';
import { createShelf } from './shelf';

function memoryStorage(limit = Infinity) {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      const used = [...data.values()].reduce((n, s) => n + s.length, 0);
      if (used + v.length > limit) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('My songs', () => {
  it('a saved song comes back exactly the same', () => {
    const shelf = createShelf(memoryStorage());
    expect(shelf.save(demoSong(), 1000)).toBe(true);
    expect(shelf.load('demo01')).toEqual(demoSong());
    expect(shelf.list()).toEqual([{ id: 'demo01', name: 'Demo song', savedAt: 1000 }]);
  });

  it('saving again updates the song instead of making a copy, and the newest is first', () => {
    const shelf = createShelf(memoryStorage());
    shelf.save(demoSong(), 1000);
    shelf.save({ ...demoSong(), id: 'other1', name: 'Other' }, 2000);
    shelf.save({ ...demoSong(), name: 'Demo, renamed' }, 3000);
    expect(shelf.list().map(s => s.name)).toEqual(['Demo, renamed', 'Other']);
  });

  it('removing a song takes it off the shelf', () => {
    const storage = memoryStorage();
    const shelf = createShelf(storage);
    shelf.save(demoSong());
    shelf.remove('demo01');
    expect(shelf.list()).toEqual([]);
    expect(storage.data.has('kiddaw.song.demo01')).toBe(false);
  });

  it('damaged saved data is skipped, not crashed on', () => {
    const storage = memoryStorage();
    const shelf = createShelf(storage);
    shelf.save(demoSong());
    storage.data.set('kiddaw.song.demo01', '{not json');
    expect(shelf.load('demo01')).toBeNull();
    storage.data.set('kiddaw.shelf', 'also not json');
    expect(shelf.list()).toEqual([]);
  });

  it('a full Chromebook says the save failed instead of crashing', () => {
    const shelf = createShelf(memoryStorage(10));
    expect(shelf.save(demoSong())).toBe(false);
  });

  it('remembers which song a student was working on at each level', () => {
    const shelf = createShelf(memoryStorage());
    expect(shelf.current('k-1')).toBeNull();
    shelf.setCurrent('k-1', 'demo01');
    expect(shelf.current('k-1')).toBe('demo01');
    expect(shelf.current('2-3')).toBeNull();
  });

  it('a browser that blocks saving still works, it just cannot save', () => {
    const shelf = createShelf(null);
    expect(shelf.available).toBe(false);
    expect(shelf.save(demoSong())).toBe(false);
    expect(shelf.list()).toEqual([]);
  });
});

describe('song links in web addresses', () => {
  it('a song address opens the same song', async () => {
    const address = await songAddress(demoSong(), 'https://kiddaw.vercel.app/');
    expect(address.startsWith('https://kiddaw.vercel.app/#song=')).toBe(true);
    const found = await readSongAddress(new URL(address).hash);
    expect(found).toEqual({ kind: 'song', song: demoSong() });
  });

  it('an address with no song, or a broken one, says so', async () => {
    expect(await readSongAddress('')).toEqual({ kind: 'none' });
    expect(await readSongAddress('#something-else')).toEqual({ kind: 'none' });
    expect(await readSongAddress('#song=1abc')).toEqual({ kind: 'broken' });
  });
});
