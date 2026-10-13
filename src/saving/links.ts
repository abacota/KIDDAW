/**
 * Putting song links into web addresses and reading them back out.
 *
 * The song goes after the # in the address. Browsers never send that part to
 * the website, so a song link shares the song without storing it anywhere.
 */

import { songFromLink, songToLink } from '../song/link';
import type { Song } from '../song/song';

const MARK = 'song=';

export type SongInAddress = { kind: 'none' } | { kind: 'broken' } | { kind: 'song'; song: Song };

export async function songAddress(song: Song, base: string): Promise<string> {
  return `${base}#${MARK}${await songToLink(song)}`;
}

export async function readSongAddress(hash: string): Promise<SongInAddress> {
  const text = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!text.startsWith(MARK)) return { kind: 'none' };
  const song = await songFromLink(text.slice(MARK.length));
  return song ? { kind: 'song', song } : { kind: 'broken' };
}
