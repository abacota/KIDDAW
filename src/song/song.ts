/**
 * What a song is. Plain data only: no sound, no screens, no storage.
 *
 * Every song is stored at full power, even a kindergartner's. The tools decide
 * how much of it a student sees.
 *
 * Time is counted in ticks. One beat (a quarter note) is 48 ticks, so ta is 48,
 * ta-ti is 24 + 24, ta-ka-ti-ki is 4 x 12, and triplets (16 each) fit too.
 */

import { defaultSound, soundById } from './sounds';

export const TICKS_PER_BEAT = 48;
export const SONG_VERSION = 1;

export type LayerKind = 'beat' | 'pitched';

export const MODES = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian'] as const;
export type Mode = (typeof MODES)[number];

export const DYNAMICS = ['pp', 'p', 'mp', 'mf', 'f', 'ff'] as const;
export type Dynamic = (typeof DYNAMICS)[number];

/** One note or drum hit inside a pattern. */
export interface Note {
  /** Ticks from the start of the pattern. */
  start: number;
  /** Ticks. */
  length: number;
  /** MIDI note number (60 is middle C) on pitched layers. Always 0 on beat layers, which have one sound each. */
  pitch: number;
  /** How hard the note is played, 1-127. */
  velocity: number;
}

/** A short piece of music for one layer. It repeats to fill a section. */
export interface Pattern {
  id: string;
  /** Ticks. */
  length: number;
  /** Always sorted by start, then pitch. */
  notes: Note[];
}

/** One part of the texture: a beat, a melody, a harmony part. */
export interface Layer {
  id: string;
  name: string;
  kind: LayerKind;
  /** A sound id from sounds.ts. */
  sound: string;
  /** 0-100. */
  volume: number;
  /** -100 (left) to 100 (right). */
  pan: number;
  muted: boolean;
  solo: boolean;
  patterns: Pattern[];
}

/** A section of the form, like A or B. */
export interface Section {
  id: string;
  /** What students see: "A", "B", "Intro". */
  name: string;
  bars: number;
  /** Layer id to pattern id. A layer that isn't listed rests in this section. */
  parts: Record<string, string>;
  /** Where the section starts and ends. A different "to" is a crescendo or decrescendo. */
  dynamics: { from: Dynamic; to: Dynamic };
}

export interface Song {
  version: typeof SONG_VERSION;
  id: string;
  name: string;
  /** Quarter-note beats per minute. */
  tempo: number;
  meter: { beats: number; unit: 4 | 8 };
  /** 0 is straight, 100 is a full triplet swing. */
  swing: number;
  /** tonic: 0 is C, 1 is C sharp ... 11 is B. */
  key: { tonic: number; mode: Mode };
  layers: Layer[];
  sections: Section[];
  /** Section ids in the order they play, like A, B, A. */
  form: string[];
}

export const LIMITS = {
  tempo: [40, 240],
  meterBeats: [1, 12],
  nameLength: 60,
  layers: 32,
  patternsPerLayer: 64,
  notesPerPattern: 1024,
  patternLength: [TICKS_PER_BEAT / 4, TICKS_PER_BEAT * 4 * 16],
  sections: 26,
  sectionBars: [1, 64],
  formLength: 128,
} as const;

export function barTicks(meter: Song['meter']): number {
  return (meter.beats * TICKS_PER_BEAT * 4) / meter.unit;
}

export function sectionTicks(song: Song, section: Section): number {
  return section.bars * barTicks(song.meter);
}

export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, b => (b % 36).toString(36)).join('');
}

export function createSong(name = 'My song'): Song {
  const a: Section = { id: newId(), name: 'A', bars: 2, parts: {}, dynamics: { from: 'mf', to: 'mf' } };
  return {
    version: SONG_VERSION,
    id: newId(),
    name,
    tempo: 100,
    meter: { beats: 4, unit: 4 },
    swing: 0,
    key: { tonic: 0, mode: 'major' },
    layers: [],
    sections: [a],
    form: [a.id],
  };
}

// ── Checking ────────────────────────────────────────────────────────────────
// Every song that comes from a link or from storage goes through parseSong.
// It fixes what it can (numbers out of range, notes in the wrong order) and
// drops what it can't, so a damaged song never reaches the engine or the tools.

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const ID = /^[A-Za-z0-9_-]{1,24}$/;
const isId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);

function int(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function text(v: unknown, fallback: string, maxLength: number = LIMITS.nameLength): string {
  if (typeof v !== 'string') return fallback;
  const t = v.trim().slice(0, maxLength);
  return t || fallback;
}

function oneOf<T extends string>(options: readonly T[], v: unknown, fallback: T): T {
  return options.includes(v as T) ? (v as T) : fallback;
}

function parseNotes(value: unknown, patternLength: number, kind: LayerKind): Note[] {
  if (!Array.isArray(value)) return [];
  const notes: Note[] = [];
  for (const n of value.slice(0, LIMITS.notesPerPattern)) {
    // A note that starts outside its pattern is damaged, not just off by a little.
    if (!isObj(n) || typeof n.start !== 'number' || !(n.start >= 0 && n.start < patternLength)) continue;
    const start = int(n.start, 0, patternLength - 1, 0);
    notes.push({
      start,
      length: int(n.length, 1, patternLength - start, 1),
      pitch: kind === 'beat' ? 0 : int(n.pitch, 0, 127, 60),
      velocity: int(n.velocity, 1, 127, 96),
    });
  }
  notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  // Two notes on the same pitch at the same moment are one note.
  return notes.filter((n, i) => i === 0 || n.start !== notes[i - 1].start || n.pitch !== notes[i - 1].pitch);
}

function parsePattern(value: unknown, kind: LayerKind): Pattern | null {
  if (!isObj(value) || !isId(value.id)) return null;
  const length = int(value.length, LIMITS.patternLength[0], LIMITS.patternLength[1], TICKS_PER_BEAT * 4);
  return { id: value.id, length, notes: parseNotes(value.notes, length, kind) };
}

function parseLayer(value: unknown): Layer | null {
  if (!isObj(value) || !isId(value.id)) return null;
  const kind = oneOf(['beat', 'pitched'] as const, value.kind, 'pitched');
  const known = typeof value.sound === 'string' ? soundById(value.sound) : undefined;
  const sound = known && known.kind === kind ? known.id : defaultSound(kind).id;
  const patterns: Pattern[] = [];
  if (Array.isArray(value.patterns)) {
    for (const p of value.patterns.slice(0, LIMITS.patternsPerLayer)) {
      const pattern = parsePattern(p, kind);
      if (pattern && !patterns.some(q => q.id === pattern.id)) patterns.push(pattern);
    }
  }
  return {
    id: value.id,
    name: text(value.name, 'Layer'),
    kind,
    sound,
    volume: int(value.volume, 0, 100, 80),
    pan: int(value.pan, -100, 100, 0),
    muted: value.muted === true,
    solo: value.solo === true,
    patterns,
  };
}

function parseSection(value: unknown, layers: Layer[]): Section | null {
  if (!isObj(value) || !isId(value.id)) return null;
  const parts: Record<string, string> = {};
  if (isObj(value.parts)) {
    for (const layer of layers) {
      const patternId = value.parts[layer.id];
      if (layer.patterns.some(p => p.id === patternId)) parts[layer.id] = patternId as string;
    }
  }
  const dynamics = isObj(value.dynamics) ? value.dynamics : {};
  const from = oneOf(DYNAMICS, dynamics.from, 'mf');
  return {
    id: value.id,
    name: text(value.name, 'A', 12),
    bars: int(value.bars, LIMITS.sectionBars[0], LIMITS.sectionBars[1], 2),
    parts,
    dynamics: { from, to: oneOf(DYNAMICS, dynamics.to, from) },
  };
}

/** Returns a clean, safe copy of a song, or null if this isn't a song at all. */
export function parseSong(value: unknown): Song | null {
  if (!isObj(value) || value.version !== SONG_VERSION || !isId(value.id)) return null;

  const layers: Layer[] = [];
  if (Array.isArray(value.layers)) {
    for (const l of value.layers.slice(0, LIMITS.layers)) {
      const layer = parseLayer(l);
      if (layer && !layers.some(x => x.id === layer.id)) layers.push(layer);
    }
  }

  const sections: Section[] = [];
  if (Array.isArray(value.sections)) {
    for (const s of value.sections.slice(0, LIMITS.sections)) {
      const section = parseSection(s, layers);
      if (section && !sections.some(x => x.id === section.id)) sections.push(section);
    }
  }
  if (sections.length === 0) return null;

  const form = Array.isArray(value.form)
    ? value.form.slice(0, LIMITS.formLength).filter((id): id is string => sections.some(s => s.id === id))
    : [];

  const meter = isObj(value.meter) ? value.meter : {};
  const key = isObj(value.key) ? value.key : {};
  return {
    version: SONG_VERSION,
    id: value.id,
    name: text(value.name, 'My song'),
    tempo: int(value.tempo, LIMITS.tempo[0], LIMITS.tempo[1], 100),
    meter: {
      beats: int(meter.beats, LIMITS.meterBeats[0], LIMITS.meterBeats[1], 4),
      unit: meter.unit === 8 ? 8 : 4,
    },
    swing: int(value.swing, 0, 100, 0),
    key: { tonic: int(key.tonic, 0, 11, 0), mode: oneOf(MODES, key.mode, 'major') },
    layers,
    sections,
    form: form.length > 0 ? form : [sections[0].id],
  };
}
