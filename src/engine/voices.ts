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

type Build = (out: Tone.Gain, nodes: Tone.ToneAudioNode[]) => Hit;

/** One percussion sound. trimDb sets its level so the sounds balance with each other and with a melody. */
function percussionVoice(trimDb: number, build: Build): Voice {
  const out = new Tone.Gain(Tone.dbToGain(trimDb));
  const nodes: Tone.ToneAudioNode[] = [out];
  const hit = build(out, nodes);
  return {
    output: out,
    play(time, _pitch, _seconds, velocity) {
      hit(time, velocity);
    },
    stopAll() {},
    dispose() {
      nodes.forEach(n => n.dispose());
    },
  };
}

function membrane(out: Tone.ToneAudioNode, nodes: Tone.ToneAudioNode[], opts: ConstructorParameters<typeof Tone.MembraneSynth>[0]) {
  const synth = new Tone.MembraneSynth(opts).connect(out);
  nodes.push(synth);
  return synth;
}

const PERCUSSION: Record<string, [number, Build]> = {
  kick: [-8, (out, nodes) => {
    const kick = membrane(out, nodes, {
      pitchDecay: 0.05,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.1 },
      volume: 2,
    });
    const t = inOrder();
    return (time, v) => kick.triggerAttackRelease('C1', 0.3, t(time), v);
  }],
  snare: [-8, (out, nodes) => {
    const noise = noiseHit(out, nodes, { noise: 'white', filter: 'highpass', frequency: 1200, decay: 0.16, db: -4 });
    const body = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.02 },
      volume: -6,
    }).connect(out);
    nodes.push(body);
    const [a, b] = [inOrder(), inOrder()];
    return (time, v) => {
      noise.triggerAttackRelease(0.16, a(time), v);
      body.triggerAttackRelease(190, 0.07, b(time), v);
    };
  }],
  hihat: [-6, (out, nodes) => {
    const hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      volume: -20,
    }).connect(out);
    nodes.push(hat);
    const t = inOrder();
    return (time, v) => hat.triggerAttackRelease(250, 0.05, t(time), v);
  }],
  tom: [-6, (out, nodes) => {
    const tom = membrane(out, nodes, {
      pitchDecay: 0.08,
      octaves: 3,
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
    });
    const t = inOrder();
    return (time, v) => tom.triggerAttackRelease('G2', 0.3, t(time), v);
  }],
  stomp: [0, (out, nodes) => {
    const thump = membrane(out, nodes, {
      pitchDecay: 0.03,
      octaves: 2.5,
      envelope: { attack: 0.002, decay: 0.22, sustain: 0, release: 0.05 },
      volume: 2,
    });
    const floor = noiseHit(out, nodes, { noise: 'brown', filter: 'lowpass', frequency: 500, decay: 0.08, db: -2 });
    const [a, b] = [inOrder(), inOrder()];
    return (time, v) => {
      thump.triggerAttackRelease('A0', 0.2, a(time), v);
      floor.triggerAttackRelease(0.08, b(time), v);
    };
  }],
  pat: [0, (out, nodes) => {
    const pat = noiseHit(out, nodes, { noise: 'pink', filter: 'lowpass', frequency: 900, decay: 0.07, db: 4 });
    const t = inOrder();
    return (time, v) => pat.triggerAttackRelease(0.07, t(time), v);
  }],
  clap: [0, (out, nodes) => {
    const clap = noiseHit(out, nodes, { noise: 'white', filter: 'bandpass', frequency: 1200, q: 1, decay: 0.06, db: 0 });
    const t = inOrder();
    // A clap is a few hands landing a split second apart.
    return (time, v) => [0, 0.009, 0.019].forEach(d => clap.triggerAttackRelease(0.06, t(time + d), v));
  }],
  snap: [0, (out, nodes) => {
    const snap = noiseHit(out, nodes, { noise: 'white', filter: 'bandpass', frequency: 3000, q: 3, decay: 0.03, db: 6 });
    const t = inOrder();
    return (time, v) => snap.triggerAttackRelease(0.03, t(time), v);
  }],
};

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
  const percussion = PERCUSSION[soundId];
  if (percussion) return percussionVoice(...percussion);
  return pitchedVoice((PITCHED[soundId] ?? PITCHED.piano)());
}
