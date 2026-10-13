/**
 * Song links: a whole song packed into a short piece of text that fits in a web link.
 * Nothing is stored online; the link is the song.
 *
 * The song is written as compact lists (not named fields), squeezed with the
 * browser's built-in compression, then written in link-safe letters.
 */

import { DYNAMICS, MODES, parseSong, type Song } from './song';

/** The first letter of every link says which packing it uses, so old links keep working. */
const FORMAT = '1';
const MAX_LINK_LENGTH = 200_000;

function toLists(song: Song): unknown[] {
  return [
    song.version,
    song.id,
    song.name,
    song.tempo,
    song.meter.beats,
    song.meter.unit,
    song.swing,
    song.key.tonic,
    MODES.indexOf(song.key.mode),
    song.layers.map(l => [
      l.id,
      l.name,
      l.kind === 'beat' ? 0 : 1,
      l.sound,
      l.volume,
      l.pan,
      (l.muted ? 1 : 0) | (l.solo ? 2 : 0),
      l.patterns.map(p => [p.id, p.length, p.notes.flatMap(n => [n.start, n.length, n.pitch, n.velocity])]),
    ]),
    song.sections.map(s => [
      s.id,
      s.name,
      s.bars,
      DYNAMICS.indexOf(s.dynamics.from),
      DYNAMICS.indexOf(s.dynamics.to),
      Object.entries(s.parts).flat(),
    ]),
    song.form,
  ];
}

/** Turns the lists back into a song shape. parseSong does the real checking. */
function fromLists(v: any): unknown {
  const [version, id, name, tempo, beats, unit, swing, tonic, mode, layers, sections, form] = v;
  return {
    version,
    id,
    name,
    tempo,
    meter: { beats, unit },
    swing,
    key: { tonic, mode: MODES[mode] },
    layers: layers.map(([lid, lname, kind, sound, volume, pan, flags, patterns]: any[]) => ({
      id: lid,
      name: lname,
      kind: kind === 0 ? 'beat' : 'pitched',
      sound,
      volume,
      pan,
      muted: (flags & 1) !== 0,
      solo: (flags & 2) !== 0,
      patterns: patterns.map(([pid, length, flat]: any[]) => {
        const notes = [];
        for (let i = 0; i + 3 < flat.length; i += 4) {
          notes.push({ start: flat[i], length: flat[i + 1], pitch: flat[i + 2], velocity: flat[i + 3] });
        }
        return { id: pid, length, notes };
      }),
    })),
    sections: sections.map(([sid, sname, bars, from, to, flatParts]: any[]) => {
      const parts: Record<string, unknown> = {};
      for (let i = 0; i + 1 < flatParts.length; i += 2) parts[flatParts[i]] = flatParts[i + 1];
      return { id: sid, name: sname, bars, parts, dynamics: { from: DYNAMICS[from], to: DYNAMICS[to] } };
    }),
    form,
  };
}

async function squeeze(bytes: Uint8Array, mode: 'compress' | 'decompress'): Promise<Uint8Array> {
  const transform = mode === 'compress' ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toLinkLetters(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromLinkLetters(letters: string): Uint8Array {
  const base64 = letters.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '==='.slice((base64.length + 3) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

/** Packs a song into link text. */
export async function songToLink(song: Song): Promise<string> {
  const json = JSON.stringify(toLists(song));
  return FORMAT + toLinkLetters(await squeeze(new TextEncoder().encode(json), 'compress'));
}

/** Unpacks link text into a checked song, or null if the link is broken or cut short. */
export async function songFromLink(link: string): Promise<Song | null> {
  try {
    const trimmed = link.trim();
    if (!trimmed.startsWith(FORMAT) || trimmed.length > MAX_LINK_LENGTH) return null;
    const bytes = await squeeze(fromLinkLetters(trimmed.slice(FORMAT.length)), 'decompress');
    return parseSong(fromLists(JSON.parse(new TextDecoder().decode(bytes))));
  } catch {
    return null;
  }
}
