/**
 * Turns a song into a list of moments to play. Pure arithmetic, no sound, so it can be tested.
 *
 * The engine's clock asks for one small window of time at a time (a sixteenth note),
 * which is why events are also grouped by window.
 */

import { barTicks, TICKS_PER_BEAT, type Dynamic, type Section, type Song } from '../song/song';

export interface PlayEvent {
  /** Ticks from the start of the song. Can be a fraction when swing moves a note. */
  tick: number;
  layerId: string;
  pitch: number;
  /** Ticks. */
  length: number;
  /** 0-1, after dynamics. */
  velocity: number;
}

export interface SectionSpan {
  /** Position in the form: the second A in A B A is 2. */
  formIndex: number;
  sectionId: string;
  name: string;
  start: number;
  length: number;
}

export interface Timeline {
  events: PlayEvent[];
  sections: SectionSpan[];
  /** Ticks. */
  length: number;
}

/** The engine schedules one sixteenth note of the song at a time. */
export const WINDOW = TICKS_PER_BEAT / 4;

/** Loudness of each dynamic, in decibels below the loudest. */
const DYNAMIC_DB: Record<Dynamic, number> = { pp: -16, p: -12, mp: -8, mf: -5, f: -2, ff: 0 };

/** How loud a section is at a point through it (0 is the start, 1 the end). Crescendos rise smoothly. */
export function dynamicGain(dynamics: Section['dynamics'], through: number): number {
  const from = DYNAMIC_DB[dynamics.from];
  const db = from + (DYNAMIC_DB[dynamics.to] - from) * through;
  return Math.pow(10, db / 20);
}

/** How far swing pushes the ti of ta-ti. Full swing lands it on the last third of the beat. */
function swingShift(song: Song, tickInSection: number): number {
  if (song.swing === 0 || song.meter.unit !== 4) return 0;
  if (tickInSection % TICKS_PER_BEAT !== TICKS_PER_BEAT / 2) return 0;
  return (song.swing / 100) * (TICKS_PER_BEAT / 6);
}

export function buildTimeline(song: Song): Timeline {
  const events: PlayEvent[] = [];
  const sections: SectionSpan[] = [];
  const bar = barTicks(song.meter);
  let start = 0;

  song.form.forEach((sectionId, formIndex) => {
    const section = song.sections.find(s => s.id === sectionId);
    if (!section) return;
    const length = section.bars * bar;
    sections.push({ formIndex, sectionId, name: section.name, start, length });

    for (const layer of song.layers) {
      const pattern = layer.patterns.find(p => p.id === section.parts[layer.id]);
      if (!pattern) continue;
      // A short pattern repeats until the section is full.
      for (let offset = 0; offset < length; offset += pattern.length) {
        for (const note of pattern.notes) {
          const at = offset + note.start;
          if (at >= length) break;
          events.push({
            tick: start + at + swingShift(song, at),
            layerId: layer.id,
            pitch: note.pitch,
            length: Math.min(note.length, length - at),
            velocity: (note.velocity / 127) * dynamicGain(section.dynamics, at / length),
          });
        }
      }
    }
    start += length;
  });

  events.sort((a, b) => a.tick - b.tick);
  return { events, sections, length: start };
}

/** Groups events by the window they start in, so the clock can find them quickly. */
export function eventsByWindow(events: PlayEvent[]): Map<number, PlayEvent[]> {
  const windows = new Map<number, PlayEvent[]>();
  for (const event of events) {
    const index = Math.floor(event.tick / WINDOW);
    const list = windows.get(index);
    if (list) list.push(event);
    else windows.set(index, [event]);
  }
  return windows;
}

/**
 * Where in the song the music is, given how far the clock has run.
 * With a loop, the music plays up to the loop's end, then circles back to its start.
 */
export function songTickAt(clockTicks: number, from: number, loop: { start: number; end: number } | null): number {
  const tick = from + clockTicks;
  if (!loop || tick < loop.end || loop.end <= loop.start) return tick;
  return loop.start + ((tick - loop.start) % (loop.end - loop.start));
}

/** Which section span is playing at a tick. */
export function sectionAt(timeline: Timeline, tick: number): SectionSpan | undefined {
  return timeline.sections.find(s => tick >= s.start && tick < s.start + s.length);
}
