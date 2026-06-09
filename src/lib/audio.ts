import * as Tone from 'tone';

// Type definitions for audio state
export interface SynthesizedTrackChannel {
  source: any; // Tone.PolySynth, Tone.NoiseSynth, etc.
  filterId: Tone.Filter;
  crusher: Tone.BitCrusher;
  delay: Tone.FeedbackDelay;
  reverb: Tone.Reverb;
  volume: Tone.Volume;
}

// Global active channels map: trackId -> SynthesizedTrackChannel
const activeChannels: { [trackId: string]: SynthesizedTrackChannel } = {};

// Singleton audio destination setup flag
let isInitialized = false;

// Create and initialize the master effect chain for a track
export function setupTrackAudioChannel(trackId: string, trackType: string, instrumentId?: string) {
  // Clear existing nodes if re-setting
  if (activeChannels[trackId]) {
    try {
      activeChannels[trackId].source.disconnect();
      activeChannels[trackId].filterId.disconnect();
      activeChannels[trackId].crusher.disconnect();
      activeChannels[trackId].delay.disconnect();
      activeChannels[trackId].reverb.disconnect();
      activeChannels[trackId].volume.disconnect();
    } catch (err) {
      console.warn("Error cleaning up audio nodes:", err);
    }
  }

  // Create FX nodes
  const filterId = new Tone.Filter({
    type: "lowpass",
    frequency: 20000,
    Q: 1
  });

  const crusher = new Tone.BitCrusher(8);
  crusher.wet.value = 0;

  const delay = new Tone.FeedbackDelay({
    delayTime: "4n",
    feedback: 0.3,
    wet: 0
  });

  const reverb = new Tone.Reverb({
    decay: 2.5
  });
  reverb.wet.value = 0;
  // Pre-warm the reverb so it doesn't click on first use
  reverb.generate();

  const volume = new Tone.Volume(0);

  let source: any;

  if (trackType === 'drum-machine') {
    // Drum machine relies on key triggers, we can use a helper trigger object or a multi-synthesizer
    // We instantiate a synthetic instrument capable of triggering the 5 drum sounds
    source = new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }
    });
  } else if (trackType === 'audio' || trackType === 'sampler') {
    // Microphone sampler/recording source
    source = new Tone.Sampler({
      urls: { C4: "" },
      release: 1
    });
  } else {
    // MIDI Virtual Instrument Selection
    const inst = instrumentId || 'piano';
    if (inst === 'piano') {
      source = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fmtriangle" },
        envelope: {
          attack: 0.012,
          decay: 1.5,
          sustain: 0.25,
          release: 0.8
        }
      });
      // Give soft lowpass filter sweep characteristic to piano
      source.set({
        filter: {
          frequency: 1500,
          type: "lowpass"
        }
      });
    } else if (inst === 'synth') {
      source = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sawtooth" },
        envelope: {
          attack: 0.04,
          decay: 0.3,
          sustain: 0.6,
          release: 0.4
        }
      });
    } else if (inst === 'guitar') {
      // Custom pluck physical string model settings
      source = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: {
          attack: 0.005,
          decay: 1.8,
          sustain: 0.0,
          release: 1.0
        }
      });
    } else if (inst === 'chiptune') {
      // 8-Bit square wave
      source = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "square" },
        envelope: {
          attack: 0,
          decay: 0.15,
          sustain: 0.1,
          release: 0.15
        }
      });
    } else if (inst === 'glockenspiel') {
      // High metal chime
      source = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.1,
        modulationIndex: 12,
        oscillator: { type: "sine" },
        envelope: {
          attack: 0.002,
          decay: 0.4,
          sustain: 0,
          release: 0.4
        },
        modulation: { type: "sine" },
        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.2 }
      });
    }
  }

  // FX Connection Chain: Source -> Filter -> Crusher -> Delay -> Reverb -> Volume -> Destination
  source.chain(filterId, crusher, delay, reverb, volume, Tone.getDestination());

  activeChannels[trackId] = {
    source,
    filterId,
    crusher,
    delay,
    reverb,
    volume
  };

  return activeChannels[trackId];
}

// Update parameters for an active track's FX chain
export function updateTrackAudioFX(trackId: string, fxType: 'reverb' | 'delay' | 'bitcrusher' | 'filter', value: number) {
  const channel = activeChannels[trackId];
  if (!channel) return;

  switch (fxType) {
    case 'reverb':
      // Map 0-1 to wet control
      channel.reverb.wet.value = value;
      break;
    case 'delay':
      // Map 0-1 to wet control
      channel.delay.wet.value = value;
      break;
    case 'bitcrusher':
      // Map 0-1 to wet and scale bits
      channel.crusher.wet.value = value > 0.05 ? 1 : 0;
      // Interpolate bits from 16 down to 4 based on fx level
      const bits = Math.max(3, Math.round(16 - (value * 12)));
      channel.crusher.bits.value = bits;
      break;
    case 'filter':
      // Map 0-1 cutoff frequency exponentially (50Hz to 20,000Hz)
      const freq = Math.round(50 + (Math.pow(value, 2.5) * 19950));
      channel.filterId.frequency.setValueAtTime(freq, Tone.now());
      break;
  }
}

// Update track volume dynamically
export function updateTrackVolume(trackId: string, dBVal: number) {
  const channel = activeChannels[trackId];
  if (channel) {
    channel.volume.volume.setValueAtTime(dBVal, Tone.now());
  }
}

// Play a note for a MIDI-instrument track
export function triggerTrackNote(trackId: string, pitch: string, durationInSec: number = 0.5, time: number = Tone.now()) {
  const channel = activeChannels[trackId];
  if (!channel || !channel.source) return;

  try {
    if (channel.source.triggerAttackRelease) {
      // Ensure the velocity parameter is set to standard (0.8)
      channel.source.triggerAttackRelease(pitch, durationInSec, time, 0.8);
    }
  } catch (err) {
    console.error(`Failed to trigger note ${pitch} on track ${trackId}:`, err);
  }
}

// Drum Synthesizers (100% offline, fully synthesized)
let kickSynth: Tone.MembraneSynth | null = null;
let snareNoise: Tone.NoiseSynth | null = null;
let snareFilter: Tone.Filter | null = null;
let hihatNoise: Tone.NoiseSynth | null = null;
let hihatFilter: Tone.Filter | null = null;
let tomSynth: Tone.MembraneSynth | null = null;

// Synthesize a beautiful clapped transient with multi-envelope
function setupDrumSynths() {
  if (kickSynth) return;

  kickSynth = new Tone.MembraneSynth({
    pitchDecay: 0.08,
    octaves: 5,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.15 }
  }).toDestination();
  kickSynth.volume.value = 6;

  snareFilter = new Tone.Filter({ type: "bandpass", frequency: 1200, Q: 2 }).toDestination();
  snareNoise = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.002, decay: 0.14, sustain: 0, release: 0.14 }
  }).connect(snareFilter);
  snareNoise.volume.value = 5;

  hihatFilter = new Tone.Filter({ type: "highpass", frequency: 8000, Q: 0.5 }).toDestination();
  hihatNoise = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.04 }
  }).connect(hihatFilter);
  hihatNoise.volume.value = -3;

  tomSynth = new Tone.MembraneSynth({
    pitchDecay: 0.15,
    octaves: 3,
    oscillator: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.25, sustain: 0, release: 0.25 }
  }).toDestination();
}

// Trigger organic synthesized drums
export function triggerDrumSound(pitch: string, time: number = Tone.now()) {
  setupDrumSynths();
  
  try {
    switch (pitch) {
      case 'C1': // Kick
        kickSynth?.triggerAttackRelease("C1", "8n", time);
        break;
      case 'D1': // Snare
        snareNoise?.triggerAttack(time);
        break;
      case 'E1': // Hi-Hat
        hihatNoise?.triggerAttack(time);
        break;
      case 'F1': // Clap (Multi-transient synthetic clap)
        // Simulate a rapid hand clap series of impulses
        hihatNoise?.triggerAttack(time);
        hihatNoise?.triggerAttack(time + 0.015);
        snareNoise?.triggerAttack(time + 0.03);
        break;
      case 'G1': // Tom
        tomSynth?.triggerAttackRelease("G2", "4n", time);
        break;
    }
  } catch (err) {
    console.warn("Drum trigger error:", err);
  }
}

// Setup a micro-synth for user live keyboards previewing
let previewSynth: Tone.PolySynth | null = null;
let currentPreviewInstrument: string = 'piano';

export function playLiveInstrumentNote(pitch: string, instrumentId: string) {
  setupDrumSynths(); // Warm up the drums
  
  // Clean up if the instrument changed
  if (previewSynth && currentPreviewInstrument !== instrumentId) {
    previewSynth.dispose();
    previewSynth = null;
  }

  if (!previewSynth) {
    currentPreviewInstrument = instrumentId;
    if (instrumentId === 'piano') {
      previewSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fmtriangle" },
        envelope: { attack: 0.01, decay: 1.2, sustain: 0.2, release: 0.5 }
      }).toDestination();
    } else if (instrumentId === 'synth') {
      previewSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.3 }
      }).toDestination();
    } else if (instrumentId === 'guitar') {
      previewSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 1.5, sustain: 0, release: 0.6 }
      }).toDestination();
    } else if (instrumentId === 'chiptune') {
      previewSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "square" },
        envelope: { attack: 0, decay: 0.1, sustain: 0.1, release: 0.1 }
      }).toDestination();
    } else { // glockenspiel
      previewSynth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.1,
        modulationIndex: 8,
        oscillator: { type: "sine" },
        envelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.3 }
      }).toDestination();
    }
  }

  try {
    previewSynth.triggerAttackRelease(pitch, "4n");
  } catch (err) {
    console.warn("Error playing live note:", err);
  }
}

// Micro Recorder helper for recording sampler vocals
let mediaRecorder: MediaRecorder | null = null;
let recordedAudioChunks: Blob[] = [];

export async function askMicPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop()); // Instantly release it
    return true;
  } catch (err) {
    console.warn("Microphone access denied:", err);
    return false;
  }
}
