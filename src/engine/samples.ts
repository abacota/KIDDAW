/**
 * Recorded sounds. Each sample set is downloaded the first time a song needs it,
 * then kept, so 25 Chromebooks only fetch the sounds they actually use.
 *
 * The files live in public/sounds and are listed in sample-sets.json, which the
 * sound processing script writes.
 */

import sampleSets from './sample-sets.json';

export interface HitsSet {
  type: 'hits';
  /** Softest first. Each layer holds a few takes of the same hit, played in turn. */
  layers: string[][];
  source: string;
  license: string;
}

export interface NotesSet {
  type: 'notes';
  /** MIDI note number to file. Notes in between are made by retuning the nearest one. */
  notes: Record<string, string>;
  /** Seconds a note takes to fade after it's let go. */
  release: number;
  source: string;
  license: string;
}

export type SampleSet = HitsSet | NotesSet;

export const SAMPLE_SETS = sampleSets as Record<string, SampleSet>;

export interface LoadedHits {
  type: 'hits';
  layers: { buffers: AudioBuffer[]; peak: number }[];
}

export interface LoadedNotes {
  type: 'notes';
  notes: Record<string, AudioBuffer>;
  release: number;
}

const cache = new Map<string, Promise<LoadedHits | LoadedNotes>>();
const ready = new Map<string, LoadedHits | LoadedNotes>();

/** A sample set that has already finished downloading, or undefined. */
export function readySampleSet(id: string): LoadedHits | LoadedNotes | undefined {
  return ready.get(id);
}
let decoder: OfflineAudioContext | null = null;

/** Squeezed audio formats can start with a few milliseconds of silence. Cut it, so hits land on the beat. */
function trimStart(buffer: AudioBuffer): AudioBuffer {
  const data = buffer.getChannelData(0);
  let first = 0;
  while (first < data.length && Math.abs(data[first]) < 0.001) first++;
  const start = Math.max(0, first - Math.round(buffer.sampleRate * 0.001));
  if (start === 0) return buffer;
  const trimmed = new AudioBuffer({ length: buffer.length - start, numberOfChannels: buffer.numberOfChannels, sampleRate: buffer.sampleRate });
  for (let c = 0; c < buffer.numberOfChannels; c++) trimmed.copyToChannel(buffer.getChannelData(c).subarray(start), c);
  return trimmed;
}

function peakOf(buffers: AudioBuffer[]): number {
  let peak = 0;
  for (const b of buffers) for (const v of b.getChannelData(0)) peak = Math.max(peak, Math.abs(v));
  return peak || 1;
}

async function fetchBuffer(file: string): Promise<AudioBuffer> {
  decoder ??= new OfflineAudioContext(1, 1, 44100);
  const response = await fetch(`/sounds/${file}`);
  if (!response.ok) throw new Error(`Could not load ${file}`);
  return trimStart(await decoder.decodeAudioData(await response.arrayBuffer()));
}

/** Downloads a sample set once. Later calls get the same one. */
export function loadSampleSet(id: string): Promise<LoadedHits | LoadedNotes> {
  const existing = cache.get(id);
  if (existing) return existing;
  const set = SAMPLE_SETS[id];
  if (!set) return Promise.reject(new Error(`No sample set ${id}`));

  const loading: Promise<LoadedHits | LoadedNotes> =
    set.type === 'hits'
      ? Promise.all(set.layers.map(files => Promise.all(files.map(fetchBuffer)))).then(layers => ({
          type: 'hits' as const,
          layers: layers.map(buffers => ({ buffers, peak: peakOf(buffers) })),
        }))
      : Promise.all(Object.entries(set.notes).map(async ([midi, file]) => [midi, await fetchBuffer(file)] as const)).then(
          entries => ({ type: 'notes' as const, notes: Object.fromEntries(entries), release: set.release }),
        );

  // A failed download can be tried again later, for example when the wifi comes back.
  loading.then(set => ready.set(id, set)).catch(() => cache.delete(id));
  cache.set(id, loading);
  return loading;
}
