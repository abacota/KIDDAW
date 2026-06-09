import { v4 as uuidv4 } from 'uuid';

export const LOOP_LIBRARY = [
  {
    id: 'loop-four-floor',
    name: 'Four on the Floor',
    type: 'drum-machine',
    color: '#FF6B6B',
    duration: 16,
    notes: [
      { id: uuidv4(), pitch: 'C1', start: 0, duration: 1, velocity: 1 },  // Kick
      { id: uuidv4(), pitch: 'C1', start: 4, duration: 1, velocity: 1 },  // Kick
      { id: uuidv4(), pitch: 'C1', start: 8, duration: 1, velocity: 1 },  // Kick
      { id: uuidv4(), pitch: 'C1', start: 12, duration: 1, velocity: 1 }, // Kick
      { id: uuidv4(), pitch: 'D1', start: 4, duration: 1, velocity: 1 },  // Snare
      { id: uuidv4(), pitch: 'D1', start: 12, duration: 1, velocity: 1 }, // Snare
      { id: uuidv4(), pitch: 'E1', start: 0, duration: 1, velocity: 0.7 }, // Hat
      { id: uuidv4(), pitch: 'E1', start: 2, duration: 1, velocity: 0.7 },
      { id: uuidv4(), pitch: 'E1', start: 4, duration: 1, velocity: 0.7 },
      { id: uuidv4(), pitch: 'E1', start: 6, duration: 1, velocity: 0.7 },
      { id: uuidv4(), pitch: 'E1', start: 8, duration: 1, velocity: 0.7 },
      { id: uuidv4(), pitch: 'E1', start: 10, duration: 1, velocity: 0.7 },
      { id: uuidv4(), pitch: 'E1', start: 12, duration: 1, velocity: 0.7 },
      { id: uuidv4(), pitch: 'E1', start: 14, duration: 1, velocity: 0.7 },
    ]
  },
  {
    id: 'loop-pop-chords',
    name: 'Pop Piano Chords',
    type: 'midi-instrument',
    color: '#A594F9',
    duration: 16,
    notes: [
      // C Major (Beats 1 & 2)
      { id: uuidv4(), pitch: 'C4', start: 0, duration: 8, velocity: 0.8 },
      { id: uuidv4(), pitch: 'E4', start: 0, duration: 8, velocity: 0.8 },
      { id: uuidv4(), pitch: 'G4', start: 0, duration: 8, velocity: 0.8 },
      // F Major (Beats 3 & 4)
      { id: uuidv4(), pitch: 'F3', start: 8, duration: 8, velocity: 0.8 },
      { id: uuidv4(), pitch: 'A3', start: 8, duration: 8, velocity: 0.8 },
      { id: uuidv4(), pitch: 'C4', start: 8, duration: 8, velocity: 0.8 },
    ]
  }
];
