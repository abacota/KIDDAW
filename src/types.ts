export interface TrackFX {
  reverb: number; // 0 to 1
  delay: number; // 0 to 1
  bitcrusher: number; // 0 to 1
  filter: number; // 0.01 to 1 (cutoff representation)
}

export interface Track {
  id: string;
  name: string;
  type: 'drum-machine' | 'midi-instrument' | 'audio' | 'sampler';
  color: string;
  volume: number; // in dB (-60 to 6)
  muted: boolean;
  soloed: boolean;
  instrumentId?: 'piano' | 'synth' | 'guitar' | 'chiptune' | 'glockenspiel';
  fx: TrackFX;
}

export interface Note {
  id: string;
  pitch: string; // e.g. "C4", "E4"
  start: number; // sixteenth notes from clip start
  duration: number; // sixteenth notes
  velocity?: number; // 0 to 1
}

export interface DrumHit {
  id: string;
  pitch: string; // "C1", "D1", "E1", "F1", "G1"
  start: number; // sixteenth notes from clip start
  duration: number; // reference
  velocity?: number;
}

export interface Clip {
  id: string;
  trackId: string;
  type: 'drum-machine' | 'midi-instrument' | 'audio';
  startTime: number; // sixteenth notes from timeline start
  duration: number; // sixteenth notes length
  notes: Note[] | DrumHit[];
  audioUrl?: string; // for audio tracks
}

export interface Instrument {
  id: 'piano' | 'synth' | 'guitar' | 'chiptune' | 'glockenspiel';
  name: string;
  description: string;
  color: string;
  iconName: string; // string key for lucide icon selection
  themeClass: string; // css styling key for keyboard editor decoration
}
