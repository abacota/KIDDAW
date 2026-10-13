/**
 * My songs: every song a student makes, saved on their Chromebook.
 * This is the only part of KIDDAW that touches the browser's storage.
 */

import { parseSong, type Song } from '../song/song';

export interface SavedSong {
  id: string;
  name: string;
  savedAt: number;
}

export interface Shelf {
  /** False when this browser won't let KIDDAW save (for example, a private window). */
  available: boolean;
  /** Newest first. */
  list(): SavedSong[];
  load(id: string): Song | null;
  /** Returns false if the song could not be saved (for example, storage is full). */
  save(song: Song, now?: number): boolean;
  remove(id: string): void;
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

const SHELF_KEY = 'kiddaw.shelf';
const songKey = (id: string) => `kiddaw.song.${id}`;

function readJson(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isSaved(v: unknown): v is SavedSong {
  const s = v as SavedSong;
  return typeof s === 'object' && s !== null && typeof s.id === 'string' && typeof s.name === 'string' && typeof s.savedAt === 'number';
}

export function createShelf(storage: Storage | null): Shelf {
  if (!storage) {
    return { available: false, list: () => [], load: () => null, save: () => false, remove: () => {} };
  }

  const readList = (): SavedSong[] => {
    const value = readJson(storage, SHELF_KEY);
    return Array.isArray(value) ? value.filter(isSaved) : [];
  };

  const writeList = (list: SavedSong[]): boolean => {
    try {
      storage.setItem(SHELF_KEY, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  };

  return {
    available: true,

    list() {
      // A song whose data has gone missing is left off the shelf.
      return readList()
        .filter(s => storage.getItem(songKey(s.id)) !== null)
        .sort((a, b) => b.savedAt - a.savedAt);
    },

    load(id) {
      return parseSong(readJson(storage, songKey(id)));
    },

    save(song, now = Date.now()) {
      try {
        storage.setItem(songKey(song.id), JSON.stringify(song));
      } catch {
        return false;
      }
      const list = readList().filter(s => s.id !== song.id);
      list.push({ id: song.id, name: song.name, savedAt: now });
      return writeList(list);
    },

    remove(id) {
      try {
        storage.removeItem(songKey(id));
      } catch {
        // Nothing more to do; the shelf skips songs with no data.
      }
      writeList(readList().filter(s => s.id !== id));
    },
  };
}

/** The browser's storage, or null if this browser won't allow saving. */
export function browserStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    storage.setItem('kiddaw.test', '1');
    storage.removeItem('kiddaw.test');
    return storage;
  } catch {
    return null;
  }
}
