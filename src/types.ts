export interface TrackFX {
  reverb: number;
  delay: number;
  bitcrusher: number;
  filter: number;
}

export interface Track {
  id: string;
  name: string;
  type: 'drum-machine' | 'midi-instrument' | 'audio' | 'sampler';
  color: string;
  volume: number;
  muted: boolean;
  soloed: boolean;
  instrumentId?: 'piano' | 'synth' | 'guitar' | 'chiptune' | 'glockenspiel';
  fx: TrackFX;
}

export interface Note {
  id: string;
  pitch: string;
  start: number;
  duration: number;
  velocity?: number;
}

export interface DrumHit {
  id: string;
  pitch: string;
  start: number;
  duration: number;
  velocity?: number;
}

export interface Clip {
  id: string;
  trackId: string;
  type: 'drum-machine' | 'midi-instrument' | 'audio';
  startTime: number;
  duration: number;
  notes: Note[] | DrumHit[];
  audioUrl?: string;
}

export interface Instrument {
  id: 'piano' | 'synth' | 'guitar' | 'chiptune' | 'glockenspiel';
  name: string;
  description: string;
  color: string;
  iconName: string;
  themeClass: string;
}

export interface StudentProfile {
  name: string;
  createdAt: number;
}

export interface PersistedProject {
  version: string;
  studentName: string;
  tracks: Track[];
  clips: Clip[];
  bpm: number;
  savedAt: number;
}
