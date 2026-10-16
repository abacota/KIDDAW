/**
 * The changes Beat Lab makes to a song. Each takes a song and returns a new one,
 * so screens stay simple and every change can be tested.
 */

import { writeBeat, type Figure } from './rhythm';
import { soundById } from './sounds';
import { newId, SONG_VERSION, TICKS_PER_BEAT, type Layer, type Pattern, type Song } from './song';

export const TEMPOS = { slow: 76, medium: 100, fast: 126 } as const;
export type TempoName = keyof typeof TEMPOS;

/** The section Beat Lab works on: the first one in the form. */
function firstSection(song: Song) {
  return song.sections.find(s => s.id === song.form[0]) ?? song.sections[0];
}

/** The pattern a row plays in the section Beat Lab works on. */
export function rowPattern(song: Song, layerId: string): Pattern | undefined {
  const layer = song.layers.find(l => l.id === layerId);
  return layer?.patterns.find(p => p.id === firstSection(song).parts[layerId]);
}

/** How many beats Beat Lab shows. */
export function beatCount(song: Song): number {
  const section = firstSection(song);
  return Math.round((section.bars * song.meter.beats * 4) / song.meter.unit);
}

function beatRow(soundId: string, beats: number): Layer {
  return {
    id: newId(),
    name: soundById(soundId)?.name ?? 'Beat',
    kind: 'beat',
    sound: soundId,
    volume: 80,
    pan: 0,
    muted: false,
    solo: false,
    patterns: [{ id: newId(), length: beats * TICKS_PER_BEAT, notes: [] }],
  };
}

/** A new beat to start from: a steady beat of claps, ta on every beat, ready to change. */
export function newBeatSong(beats: number, name = 'My beat'): Song {
  const clap = beatRow('clap', beats);
  for (let b = 0; b < beats; b++) clap.patterns[0] = writeBeat(clap.patterns[0], b, 'ta');
  const sectionId = newId();
  return {
    version: SONG_VERSION,
    id: newId(),
    name,
    tempo: TEMPOS.medium,
    meter: { beats: 4, unit: 4 },
    swing: 0,
    key: { tonic: 0, mode: 'major' },
    layers: [clap],
    sections: [
      {
        id: sectionId,
        name: 'A',
        bars: Math.max(1, Math.ceil(beats / 4)),
        parts: { [clap.id]: clap.patterns[0].id },
        dynamics: { from: 'mf', to: 'mf' },
      },
    ],
    form: [sectionId],
  };
}

/** Adds a row that plays a sound, starting with all rests. */
export function addBeatRow(song: Song, soundId: string): Song {
  const row = beatRow(soundId, beatCount(song));
  const section = firstSection(song);
  return {
    ...song,
    layers: [...song.layers, row],
    sections: song.sections.map(s => (s.id === section.id ? { ...s, parts: { ...s.parts, [row.id]: row.patterns[0].id } } : s)),
  };
}

export function removeLayer(song: Song, layerId: string): Song {
  return {
    ...song,
    layers: song.layers.filter(l => l.id !== layerId),
    sections: song.sections.map(s => {
      const { [layerId]: _removed, ...parts } = s.parts;
      return { ...s, parts };
    }),
  };
}

/** Puts a rhythm on one beat of a row. */
export function setFigure(song: Song, layerId: string, beat: number, figure: Figure): Song {
  const pattern = rowPattern(song, layerId);
  if (!pattern) return song;
  const changed = writeBeat(pattern, beat, figure);
  return {
    ...song,
    layers: song.layers.map(l =>
      l.id === layerId ? { ...l, patterns: l.patterns.map(p => (p.id === pattern.id ? changed : p)) } : l,
    ),
  };
}

/** Changes a row's sound and keeps its rhythm, like moving a pattern from clap to snare drum. */
export function changeSound(song: Song, layerId: string, soundId: string): Song {
  const name = soundById(soundId)?.name;
  if (!name) return song;
  return { ...song, layers: song.layers.map(l => (l.id === layerId ? { ...l, sound: soundId, name } : l)) };
}

export function toggleMute(song: Song, layerId: string): Song {
  return { ...song, layers: song.layers.map(l => (l.id === layerId ? { ...l, muted: !l.muted } : l)) };
}

export function setTempo(song: Song, tempo: number): Song {
  return { ...song, tempo };
}

export function renameSong(song: Song, name: string): Song {
  const trimmed = name.trim().slice(0, 60);
  return trimmed ? { ...song, name: trimmed } : song;
}
