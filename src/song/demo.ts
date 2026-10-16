/**
 * A short demo song in ABA form, used by the foundation check and the tests.
 * A: kick, snare and hi-hat, a sol-mi-la melody on xylophone, a do-sol drone.
 * B: body percussion and a new melody, growing from piano to forte.
 */

import { TICKS_PER_BEAT as BEAT, type Layer, type Note, type Song } from './song';

const BAR = BEAT * 4;
const DO = 60, RE = 62, MI = 64, SOL = 67, LA = 69, HIGH_DO = 72;
const LOW_DO = 48, LOW_SOL = 55;

/** [beat, beats long, pitch] to a note. Beats can be halves, like 2.5 for the ti of ta-ti. */
const notes = (list: [number, number, number][], velocity = 96): Note[] =>
  list.map(([beat, beats, pitch]) => ({ start: beat * BEAT, length: beats * BEAT, pitch, velocity }));

/** A one-bar percussion row: [beat, beats long] for each hit. */
function row(id: string, name: string, sound: string, hits: [number, number][]): Layer {
  return {
    id,
    name,
    kind: 'beat',
    sound,
    volume: 80,
    pan: 0,
    muted: false,
    solo: false,
    patterns: [{ id: `${id}-1`, length: BAR, notes: notes(hits.map(([b, l]) => [b, l, 0])) }],
  };
}

const eighths: [number, number][] = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map(b => [b, 0.5]);

export function demoSong(): Song {
  return {
    version: 1,
    id: 'demo01',
    name: 'Demo song',
    tempo: 104,
    meter: { beats: 4, unit: 4 },
    swing: 0,
    key: { tonic: 0, mode: 'major' },
    layers: [
      row('kick', 'Kick drum', 'kick', [[0, 1], [2, 1]]),
      row('snare', 'Snare drum', 'snare', [[1, 1], [3, 1]]),
      row('hihat', 'Hi-hat', 'hihat', eighths),
      row('stomp', 'Stomp', 'stomp', [[0, 1]]),
      row('pat', 'Pat', 'pat', [[1, 0.5], [1.5, 0.5]]),
      row('clap', 'Clap', 'clap', [[2, 1]]),
      row('snap', 'Snap', 'snap', [[3, 1]]),
      {
        id: 'melody',
        name: 'Melody',
        kind: 'pitched',
        sound: 'xylophone',
        volume: 85,
        pan: 0,
        muted: false,
        solo: false,
        patterns: [
          {
            id: 'tune-a',
            length: BAR * 2,
            notes: notes([
              [0, 1, SOL], [1, 1, MI], [2, 0.5, SOL], [2.5, 0.5, LA], [3, 1, SOL],
              [4, 1, SOL], [5, 1, MI], [6, 0.5, RE], [6.5, 0.5, MI], [7, 1, DO],
            ]),
          },
          {
            id: 'tune-b',
            length: BAR * 2,
            notes: notes([
              [0, 0.5, LA], [0.5, 0.5, LA], [1, 1, SOL], [2, 1, MI], [3, 1, SOL],
              [4, 0.5, LA], [4.5, 0.5, HIGH_DO], [5, 1, LA], [6, 2, SOL],
            ]),
          },
        ],
      },
      {
        id: 'bass',
        name: 'Drone',
        kind: 'pitched',
        sound: 'bass',
        volume: 70,
        pan: 0,
        muted: false,
        solo: false,
        patterns: [{ id: 'drone', length: BAR, notes: notes([[0, 4, LOW_DO], [0, 4, LOW_SOL]], 80) }],
      },
    ],
    sections: [
      {
        id: 'A',
        name: 'A',
        bars: 2,
        parts: { kick: 'kick-1', snare: 'snare-1', hihat: 'hihat-1', melody: 'tune-a', bass: 'drone' },
        dynamics: { from: 'mf', to: 'mf' },
      },
      {
        id: 'B',
        name: 'B',
        bars: 2,
        parts: { stomp: 'stomp-1', pat: 'pat-1', clap: 'clap-1', snap: 'snap-1', melody: 'tune-b', bass: 'drone' },
        dynamics: { from: 'p', to: 'f' },
      },
    ],
    form: ['A', 'B', 'A'],
  };
}
