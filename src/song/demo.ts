/**
 * A short demo song in ABA form, used by the foundation check and the tests.
 * A: drum kit, a sol-mi-la melody on xylophone, a do-sol drone.
 * B: body percussion and a new melody, growing from piano to forte.
 */

import { TICKS_PER_BEAT as BEAT, type Note, type Song } from './song';

const BAR = BEAT * 4;
const DO = 60, RE = 62, MI = 64, SOL = 67, LA = 69, HIGH_DO = 72;
const LOW_DO = 48, LOW_SOL = 55;

/** [beat, beats long, pitch] to a note. Beats can be halves, like 2.5 for the ti of ta-ti. */
const notes = (list: [number, number, number][], velocity = 96): Note[] =>
  list.map(([beat, beats, pitch]) => ({ start: beat * BEAT, length: beats * BEAT, pitch, velocity }));

const KICK = 0, SNARE = 1, HIHAT = 2;
const STOMP = 0, PAT = 1, SNAP = 2, CLAP = 3;

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
      {
        id: 'drums',
        name: 'Drum kit',
        kind: 'beat',
        sound: 'drum-kit',
        volume: 80,
        pan: 0,
        muted: false,
        solo: false,
        patterns: [
          {
            id: 'rock',
            length: BAR,
            notes: notes([
              [0, 0.5, KICK], [0, 0.5, HIHAT], [0.5, 0.5, HIHAT],
              [1, 0.5, SNARE], [1, 0.5, HIHAT], [1.5, 0.5, HIHAT],
              [2, 0.5, KICK], [2, 0.5, HIHAT], [2.5, 0.5, HIHAT],
              [3, 0.5, SNARE], [3, 0.5, HIHAT], [3.5, 0.5, HIHAT],
            ]),
          },
        ],
      },
      {
        id: 'body',
        name: 'Body percussion',
        kind: 'beat',
        sound: 'body',
        volume: 85,
        pan: 0,
        muted: false,
        solo: false,
        patterns: [
          {
            id: 'stomp',
            length: BAR,
            notes: notes([[0, 1, STOMP], [1, 0.5, PAT], [1.5, 0.5, PAT], [2, 1, CLAP], [3, 1, SNAP]]),
          },
        ],
      },
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
      { id: 'A', name: 'A', bars: 2, parts: { drums: 'rock', melody: 'tune-a', bass: 'drone' }, dynamics: { from: 'mf', to: 'mf' } },
      { id: 'B', name: 'B', bars: 2, parts: { body: 'stomp', melody: 'tune-b', bass: 'drone' }, dynamics: { from: 'p', to: 'f' } },
    ],
    form: ['A', 'B', 'A'],
  };
}
