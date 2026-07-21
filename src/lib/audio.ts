import * as Tone from 'tone';

export interface SynthesizedTrackChannel {
  source: any;
  filter: Tone.Filter;
  crusher: Tone.BitCrusher;
  delay: Tone.FeedbackDelay;
  reverb: Tone.Reverb;
  volume: Tone.Volume;
  extras?: Tone.ToneAudioNode[];
  trackType: string;
  instrumentId?: string;
}

const activeChannels: Record<string, SynthesizedTrackChannel> = {};

function createInstrumentSource(instrumentId: string): Tone.PolySynth {
  switch (instrumentId) {
    case 'synth':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.04, decay: 0.3, sustain: 0.6, release: 0.4 },
      });
    case 'guitar':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 1.8, sustain: 0.0, release: 1.0 },
      });
    case 'chiptune':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'square' },
        envelope: { attack: 0, decay: 0.15, sustain: 0.1, release: 0.15 },
      });
    case 'glockenspiel':
      return new Tone.PolySynth(Tone.FMSynth as any, {
        harmonicity: 3.1, modulationIndex: 12,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.2 },
      } as any);
    case 'piano':
    default:
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fmtriangle' as any },
        envelope: { attack: 0.012, decay: 1.5, sustain: 0.25, release: 0.8 },
      });
  }
}

function disposeChannel(ch: SynthesizedTrackChannel) {
  try {
    ch.source?.dispose?.();
    ch.filter?.dispose?.();
    ch.crusher?.dispose?.();
    ch.delay?.dispose?.();
    ch.reverb?.dispose?.();
    ch.volume?.dispose?.();
    ch.extras?.forEach(n => { try { n.dispose?.(); } catch { /* */ } });
  } catch (err) { console.warn('Error disposing audio channel', err); }
}

export function setupTrackAudioChannel(
  trackId: string,
  trackType: string,
  instrumentId?: string
): SynthesizedTrackChannel {
  const existing = activeChannels[trackId];
  if (existing && existing.trackType === trackType && existing.instrumentId === instrumentId) {
    return existing;
  }
  if (existing) { disposeChannel(existing); delete activeChannels[trackId]; }

  const filter  = new Tone.Filter({ type: 'lowpass', frequency: 20000, Q: 1 });
  const crusher = new Tone.BitCrusher(8);
  crusher.wet.value = 0;
  const delay   = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.25, wet: 0 });
  const reverb  = new Tone.Reverb({ decay: 2.5, wet: 0 });
  void reverb.generate();
  const volume  = new Tone.Volume(0);

  let source: any;
  const extras: Tone.ToneAudioNode[] = [];

  if (trackType === 'drum-machine') {
    source = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    });

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.08, octaves: 5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.15 },
    });
    kick.volume.value = 4;

    const snareFilter = new Tone.Filter({ type: 'bandpass', frequency: 1800, Q: 1.5 });
    const snare = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 },
    });
    snare.volume.value = 2;
    snare.connect(snareFilter);

    const hatFilter = new Tone.Filter({ type: 'highpass', frequency: 7000, Q: 0.5 });
    const hat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.03 },
    });
    hat.volume.value = -6;
    hat.connect(hatFilter);

    const clapFilter = new Tone.Filter({ type: 'bandpass', frequency: 2200, Q: 1.2 });
    const clap = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.06 },
    });
    clap.volume.value = 3;
    clap.connect(clapFilter);

    const tom = new Tone.MembraneSynth({
      pitchDecay: 0.12, octaves: 3,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.22, sustain: 0, release: 0.2 },
    });

    [kick, snareFilter, hatFilter, clapFilter, tom].forEach(n => {
      n.connect(filter);
      extras.push(n);
    });
    extras.push(snare, hat, clap);
    (source as any).__drums = { kick, snare, hat, clap, tom };
  } else {
    source = createInstrumentSource(instrumentId || 'piano');
  }

  source.chain(filter, crusher, delay, reverb, volume, Tone.getDestination());

  activeChannels[trackId] = { source, filter, crusher, delay, reverb, volume, extras, trackType, instrumentId };
  return activeChannels[trackId];
}

export function disposeTrackChannel(trackId: string) {
  if (activeChannels[trackId]) { disposeChannel(activeChannels[trackId]); delete activeChannels[trackId]; }
}

export function getTrackChannel(trackId: string) {
  return activeChannels[trackId];
}

export function updateTrackAudioFX(
  trackId: string,
  fxType: 'reverb' | 'delay' | 'bitcrusher' | 'filter',
  value: number
) {
  const ch = activeChannels[trackId];
  if (!ch) return;
  switch (fxType) {
    case 'reverb':     ch.reverb.wet.rampTo(Math.max(0, Math.min(1, value)), 0.05); break;
    case 'delay':      ch.delay.wet.rampTo(Math.max(0, Math.min(1, value)), 0.05); break;
    case 'bitcrusher': {
      const v = Math.max(0, Math.min(1, value));
      ch.crusher.wet.value = v > 0.03 ? 1 : 0;
      ch.crusher.bits.value = Math.max(3, Math.round(16 - v * 12));
      break;
    }
    case 'filter': {
      const v = Math.max(0.01, Math.min(1, value));
      ch.filter.frequency.rampTo(80 + Math.pow(v, 2.2) * 19920, 0.05);
      break;
    }
  }
}

export function updateTrackVolume(trackId: string, dBVal: number) {
  const ch = activeChannels[trackId];
  if (!ch) return;
  if (!isFinite(dBVal) || dBVal < -60) { ch.volume.mute = true; }
  else { ch.volume.mute = false; ch.volume.volume.rampTo(dBVal, 0.05); }
}

export function triggerTrackNote(
  trackId: string,
  pitch: string,
  durationInSec: number = 0.5,
  time?: number,
  velocity: number = 0.8
) {
  const ch = activeChannels[trackId];
  if (!ch?.source?.triggerAttackRelease) return;
  try {
    ch.source.triggerAttackRelease(pitch, Math.max(0.05, durationInSec), time ?? Tone.now(), velocity);
  } catch (err) { console.warn(`Note fail ${pitch} on ${trackId}`, err); }
}

export function triggerDrumSound(pitch: string, time?: number, trackId?: string) {
  const t = time ?? Tone.now();
  try {
    if (trackId && activeChannels[trackId]) {
      const drums = (activeChannels[trackId].source as any)?.__drums;
      if (drums) { fireDrum(drums, pitch, t); return; }
    }
    ensureSharedDrums();
    fireDrum({ kick: sharedKick, snare: sharedSnare, hat: sharedHat, clap: sharedClap, tom: sharedTom }, pitch, t);
  } catch (err) { console.warn('Drum trigger error', err); }
}

function fireDrum(drums: any, pitch: string, t: number) {
  switch (pitch) {
    case 'C1': drums.kick?.triggerAttackRelease('C1', '8n', t); break;
    case 'D1': drums.snare?.triggerAttack(t); break;
    case 'E1': drums.hat?.triggerAttack(t); break;
    case 'F1':
      drums.clap?.triggerAttack(t);
      drums.clap?.triggerAttack(t + 0.012);
      drums.clap?.triggerAttack(t + 0.028);
      break;
    case 'G1': drums.tom?.triggerAttackRelease('G2', '8n', t); break;
  }
}

let sharedKick: Tone.MembraneSynth | null = null;
let sharedSnare: Tone.NoiseSynth | null = null;
let sharedHat: Tone.NoiseSynth | null = null;
let sharedClap: Tone.NoiseSynth | null = null;
let sharedTom: Tone.MembraneSynth | null = null;

function ensureSharedDrums() {
  if (sharedKick) return;
  sharedKick = new Tone.MembraneSynth({
    pitchDecay: 0.08, octaves: 5,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.15 },
  }).toDestination();
  sharedKick.volume.value = 4;

  const snF = new Tone.Filter({ type: 'bandpass', frequency: 1800, Q: 1.5 }).toDestination();
  sharedSnare = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 },
  }).connect(snF);
  sharedSnare.volume.value = 2;

  const hF = new Tone.Filter({ type: 'highpass', frequency: 7000 }).toDestination();
  sharedHat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.03 },
  }).connect(hF);
  sharedHat.volume.value = -6;

  const cF = new Tone.Filter({ type: 'bandpass', frequency: 2200, Q: 1.2 }).toDestination();
  sharedClap = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.06 },
  }).connect(cF);
  sharedClap.volume.value = 3;

  sharedTom = new Tone.MembraneSynth({
    pitchDecay: 0.12, octaves: 3,
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.22, sustain: 0, release: 0.2 },
  }).toDestination();
}

let previewSynth: Tone.PolySynth | null = null;
let previewInstrument = '';

export function playLiveInstrumentNote(pitch: string, instrumentId: string) {
  if (previewSynth && previewInstrument !== instrumentId) {
    try { previewSynth.dispose(); } catch { /* */ }
    previewSynth = null;
  }
  if (!previewSynth) {
    previewInstrument = instrumentId;
    previewSynth = createInstrumentSource(instrumentId);
    previewSynth.toDestination();
    previewSynth.volume.value = -4;
  }
  try { previewSynth.triggerAttackRelease(pitch, '8n'); }
  catch (err) { console.warn('Live note error', err); }
}

let metroSynth: Tone.MembraneSynth | null = null;

export function triggerMetronomeClick(isDownbeat: boolean, time?: number) {
  if (!metroSynth) {
    metroSynth = new Tone.MembraneSynth({
      pitchDecay: 0.01, octaves: 2,
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
    }).toDestination();
    metroSynth.volume.value = -10;
  }
  metroSynth.triggerAttackRelease(isDownbeat ? 'C5' : 'G4', '32n', time ?? Tone.now());
}

export async function askMicPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch { return false; }
}
