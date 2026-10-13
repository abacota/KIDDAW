/**
 * The instruments. Each sound id from song/sounds.ts gets a voice the engine can play.
 *
 * These are synthesized first drafts (no files to download, so they start instantly).
 * Recorded samples for real instruments and body percussion come in a later phase.
 */

import * as Tone from 'tone';

export interface Voice {
  output: Tone.ToneAudioNode;
  /** time: audio time in seconds. seconds: how long the note lasts. velocity: 0-1. */
  play(time: number, pitch: number, seconds: number, velocity: number): void;
  stopAll(): void;
  dispose(): void;
}

type Hit = (time: number, velocity: number) => void;

/**
 * A single-note synth can't start two sounds at the same instant, so a hit that
 * lands at the same time as the last one moves a hair later.
 */
function inOrder(): (time: number) => number {
  let last = 0;
  return time => {
    const t = time <= last ? last + 0.001 : time;
    last = t;
    return t;
  };
}

/** A short noise burst through a filter: the basis of snares, claps, pats and snaps. */
function noiseHit(
  out: Tone.ToneAudioNode,
  nodes: Tone.ToneAudioNode[],
  opts: { noise: 'white' | 'pink' | 'brown'; filter: BiquadFilterType; frequency: number; q?: number; decay: number; db?: number },
): Tone.NoiseSynth {
  const filter = new Tone.Filter({ type: opts.filter, frequency: opts.frequency, Q: opts.q ?? 1 }).connect(out);
  const synth = new Tone.NoiseSynth({
    noise: { type: opts.noise },
    envelope: { attack: 0.001, decay: opts.decay, sustain: 0, release: 0.02 },
    volume: opts.db ?? 0,
  }).connect(filter);
  nodes.push(filter, synth);
  return synth;
}

/** trimDb sets the whole kit's level so it sits well under a melody. */
function beatVoice(trimDb: number, build: (out: Tone.Gain, nodes: Tone.ToneAudioNode[]) => Hit[]): Voice {
  const out = new Tone.Gain(Tone.dbToGain(trimDb));
  const nodes: Tone.ToneAudioNode[] = [out];
  const hits = build(out, nodes);
  return {
    output: out,
    play(time, lane, _seconds, velocity) {
      hits[lane]?.(time, velocity);
    },
    stopAll() {},
    dispose() {
      nodes.forEach(n => n.dispose());
    },
  };
}

function drumKit(): Voice {
  return beatVoice(-6, (out, nodes) => {
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.1 },
      volume: 2,
    }).connect(out);
    const snare = noiseHit(out, nodes, { noise: 'white', filter: 'highpass', frequency: 1200, decay: 0.16, db: -4 });
    const snareBody = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.02 },
      volume: -6,
    }).connect(out);
    const hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      volume: -20,
    }).connect(out);
    const clap = noiseHit(out, nodes, { noise: 'pink', filter: 'bandpass', frequency: 1400, q: 0.8, decay: 0.1, db: -2 });
    const tom = new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 3,
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
    }).connect(out);
    nodes.push(kick, snareBody, hat, tom);

    const [k, s, sb, h, c, t] = [inOrder(), inOrder(), inOrder(), inOrder(), inOrder(), inOrder()];
    return [
      (time, v) => kick.triggerAttackRelease('C1', 0.3, k(time), v),
      (time, v) => {
        snare.triggerAttackRelease(0.16, s(time), v);
        snareBody.triggerAttackRelease(190, 0.07, sb(time), v);
      },
      (time, v) => hat.triggerAttackRelease(250, 0.05, h(time), v),
      (time, v) => [0, 0.011, 0.023].forEach(d => clap.triggerAttackRelease(0.1, c(time + d), v)),
      (time, v) => tom.triggerAttackRelease('G2', 0.3, t(time), v),
    ];
  });
}

function bodyPercussion(): Voice {
  return beatVoice(0, (out, nodes) => {
    const stompThump = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 2.5,
      envelope: { attack: 0.002, decay: 0.22, sustain: 0, release: 0.05 },
      volume: 2,
    }).connect(out);
    const stompFloor = noiseHit(out, nodes, { noise: 'brown', filter: 'lowpass', frequency: 500, decay: 0.08, db: -2 });
    const pat = noiseHit(out, nodes, { noise: 'pink', filter: 'lowpass', frequency: 900, decay: 0.07, db: 4 });
    const snap = noiseHit(out, nodes, { noise: 'white', filter: 'bandpass', frequency: 3000, q: 3, decay: 0.03, db: 6 });
    const clap = noiseHit(out, nodes, { noise: 'white', filter: 'bandpass', frequency: 1200, q: 1, decay: 0.06, db: 0 });
    nodes.push(stompThump);

    const [st, sf, p, sn, c] = [inOrder(), inOrder(), inOrder(), inOrder(), inOrder()];
    return [
      (time, v) => {
        stompThump.triggerAttackRelease('A0', 0.2, st(time), v);
        stompFloor.triggerAttackRelease(0.08, sf(time), v);
      },
      (time, v) => pat.triggerAttackRelease(0.07, p(time), v),
      (time, v) => snap.triggerAttackRelease(0.03, sn(time), v),
      (time, v) => [0, 0.009, 0.019].forEach(d => clap.triggerAttackRelease(0.06, c(time + d), v)),
    ];
  });
}

function pitchedVoice(synth: Tone.PolySynth): Voice {
  return {
    output: synth,
    play(time, pitch, seconds, velocity) {
      synth.triggerAttackRelease(Tone.Frequency(pitch, 'midi').toFrequency(), seconds, time, velocity);
    },
    stopAll() {
      synth.releaseAll();
    },
    dispose() {
      synth.dispose();
    },
  };
}

const PITCHED: Record<string, () => Tone.PolySynth> = {
  xylophone: () =>
    new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.5,
      modulationIndex: 3,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.3 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
      volume: 0,
    }),
  piano: () =>
    new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1,
      modulationIndex: 1.2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.003, decay: 1.4, sustain: 0.15, release: 0.9 },
      modulation: { type: 'triangle' },
      modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0.1, release: 0.5 },
      volume: -6,
    }),
  bass: () =>
    new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'sawtooth' },
      filter: { type: 'lowpass', Q: 1 },
      filterEnvelope: { attack: 0.005, decay: 0.25, sustain: 0.4, release: 0.3, baseFrequency: 110, octaves: 2.5 },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.3 },
      volume: -16,
    }),
  chip: () =>
    new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0.35, release: 0.08 },
      volume: -16,
    }),
};

export function createVoice(soundId: string): Voice {
  if (soundId === 'drum-kit') return drumKit();
  if (soundId === 'body') return bodyPercussion();
  return pitchedVoice((PITCHED[soundId] ?? PITCHED.piano)());
}
