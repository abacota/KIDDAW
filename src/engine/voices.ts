/**
 * The instruments. Each sound id from song/sounds.ts gets a voice the engine can play.
 *
 * Each sound has a synth version, made right here with no files to download, and
 * many also have recordings (see samples.ts). settings/sounds.txt picks which one plays.
 */

import * as Tone from 'tone';
import { SOUND_CHOICES } from '../settings/sounds';
import { loadSampleSet, readySampleSet, SAMPLE_SETS, type LoadedHits, type LoadedNotes } from './samples';

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
  openhat: [-6, (out, nodes) => {
    const hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.4, release: 0.1 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      volume: -20,
    }).connect(out);
    nodes.push(hat);
    const t = inOrder();
    return (time, v) => hat.triggerAttackRelease(250, 0.4, t(time), v);
  }],
  lowtom: [-6, (out, nodes) => {
    const tom = membrane(out, nodes, {
      pitchDecay: 0.1,
      octaves: 3,
      envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.1 },
    });
    const t = inOrder();
    return (time, v) => tom.triggerAttackRelease('C2', 0.45, t(time), v);
  }],
  crash: [-10, (out, nodes) => {
    const cymbal = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 1.6, release: 0.4 },
      harmonicity: 5.1,
      modulationIndex: 40,
      resonance: 3000,
      octaves: 2,
      volume: -16,
    }).connect(out);
    nodes.push(cymbal);
    const t = inOrder();
    return (time, v) => cymbal.triggerAttackRelease(300, 1.6, t(time), v);
  }],
  ride: [-10, (out, nodes) => {
    const cymbal = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.9, release: 0.3 },
      harmonicity: 3.1,
      modulationIndex: 16,
      resonance: 6000,
      octaves: 1,
      volume: -18,
    }).connect(out);
    nodes.push(cymbal);
    const t = inOrder();
    return (time, v) => cymbal.triggerAttackRelease(440, 0.9, t(time), v);
  }],
  chest: [0, (out, nodes) => {
    const thump = membrane(out, nodes, {
      pitchDecay: 0.02,
      octaves: 1.5,
      envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.05 },
    });
    const t = inOrder();
    return (time, v) => thump.triggerAttackRelease('A1', 0.1, t(time), v);
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

function synthVoice(soundId: string): Voice {
  const percussion = PERCUSSION[soundId];
  if (percussion) return percussionVoice(...percussion);
  return pitchedVoice((PITCHED[soundId] ?? PITCHED.piano)());
}

/**
 * Level for each recorded set, so recordings sit well with each other and with the synths.
 * The processing script sets every recording to the same peak, so this does the balancing.
 */
const RECORDED_TRIM_DB: Record<string, number> = {
  piano: -2,
};
const BEAT_TRIM_DB = -6;

/**
 * A recorded percussion sound. Until its recording arrives it plays the synth version,
 * so the first beat never comes out silent.
 */
function recordedHits(setId: string, fallback: Voice, trimDb: number): Voice {
  const out = new Tone.Gain(Tone.dbToGain(trimDb));
  fallback.output.connect(out);
  const already = readySampleSet(setId);
  let loaded: LoadedHits | null = already?.type === 'hits' ? already : null;
  let alive = true;
  let turn = 0;
  if (!loaded) {
    loadSampleSet(setId)
      .then(set => {
        if (alive && set.type === 'hits') loaded = set;
      })
      .catch(err => console.warn(`Using the synth ${setId} for now`, err));
  }

  return {
    output: out,
    play(time, pitch, seconds, velocity) {
      if (!loaded) return fallback.play(time, pitch, seconds, velocity);
      // Use the softest take that can still play this loud, then set its level, so a
      // soft note sounds soft (not just quiet) and loudness still follows velocity smoothly.
      const layers = loaded.layers;
      const want = velocity * layers[layers.length - 1].peak;
      const layer = layers.find(l => l.peak >= want * 0.95) ?? layers[layers.length - 1];
      const buffer = layer.buffers[turn++ % layer.buffers.length];
      const source = new Tone.ToneBufferSource(buffer).connect(out);
      source.onended = () => source.dispose();
      source.start(time, 0, undefined, Math.min(2, want / layer.peak));
    },
    stopAll() {},
    dispose() {
      alive = false;
      fallback.dispose();
      out.dispose();
    },
  };
}

/** A recorded pitched instrument. Notes between the recorded ones are retuned from the nearest. */
function recordedNotes(setId: string, fallback: Voice, trimDb: number): Voice {
  const out = new Tone.Gain(Tone.dbToGain(trimDb));
  fallback.output.connect(out);
  let sampler: Tone.Sampler | null = null;
  let alive = true;
  const build = (set: LoadedNotes) => {
    const urls = Object.fromEntries(
      Object.entries(set.notes).map(([midi, buffer]) => [Tone.Frequency(Number(midi), 'midi').toNote(), buffer]),
    );
    sampler = new Tone.Sampler({ urls, release: set.release }).connect(out);
  };
  const already = readySampleSet(setId);
  if (already?.type === 'notes') build(already);
  else {
    loadSampleSet(setId)
      .then(set => {
        if (alive && set.type === 'notes') build(set);
      })
      .catch(err => console.warn(`Using the synth ${setId} for now`, err));
  }

  return {
    output: out,
    play(time, pitch, seconds, velocity) {
      if (!sampler) return fallback.play(time, pitch, seconds, velocity);
      sampler.triggerAttackRelease(Tone.Frequency(pitch, 'midi').toFrequency(), seconds, time, velocity);
    },
    stopAll() {
      sampler?.releaseAll();
      fallback.stopAll();
    },
    dispose() {
      alive = false;
      sampler?.dispose();
      fallback.dispose();
      out.dispose();
    },
  };
}

/** Which version a sound plays: an exact version like kick.rock, or the one chosen in settings/sounds.txt. */
export function versionOf(id: string): string {
  return id.includes('.') ? id : SOUND_CHOICES.choices[id] ?? `${id}.synth`;
}

/** Starts downloading a sound's recording, if it has one, before it's needed. */
export function preloadSound(id: string): void {
  const version = versionOf(id);
  if (SAMPLE_SETS[version]) loadSampleSet(version).catch(() => {});
}

/**
 * Extra level for each version, in decibels, measured so that every version of a sound
 * is equally loud (a fair comparison on the Sound check page) and the sounds balance in a
 * mix: kick and stomp strongest, hi-hat and ride lighter. Measured by ear-like loudness
 * (the loudest twentieth of a second) at velocity 0.8. Re-measure when a sound changes.
 */
const LEVEL_DB: Record<string, number> = {
  'kick.rock': 3.3, 'kick.studio': 0.4, 'kick.synth': -2.6,
  'snare.rock': 0.7, 'snare.studio': 2.8, 'snare.synth': 4.2,
  'hihat.rock': -1.4, 'hihat.studio': -1.8, 'hihat.synth': 9,
  'openhat.rock': -0.6, 'openhat.studio': -1.4, 'openhat.synth': 3.3,
  'tom.rock': 2.6, 'tom.studio': 0.3, 'tom.synth': -4.9,
  'lowtom.rock': 3.1, 'lowtom.studio': 2.2, 'lowtom.synth': -5.6,
  'crash.rock': -0.1, 'crash.studio': -2, 'crash.synth': 4.5,
  'ride.rock': -3, 'ride.studio': 2.9, 'ride.synth': 1.6,
  'stomp.recorded': -2.7, 'stomp.synth': -8.7,
  'pat.recorded': 2, 'pat.synth': 2.9,
  'clap.recorded': 7.6, 'clap.synth': -3.8,
  'snap.recorded': 4.6, 'snap.synth': -2.3,
  'chest.recorded': 7.3, 'chest.synth': -10.7,
  'piano.salamander': -0.6, 'piano.synth': 5,
};

/** Resolves once a sound's recording has downloaded (right away if it has none). Gives up after a few seconds. */
export function waitForSound(id: string): Promise<void> {
  const version = versionOf(id);
  if (!SAMPLE_SETS[version] || readySampleSet(version)) return Promise.resolve();
  const timeout = new Promise<void>(resolve => setTimeout(resolve, 4000));
  return Promise.race([loadSampleSet(version).then(() => {}, () => {}), timeout]);
}

/** id is a sound (kick) or one exact version of it (kick.rock, kick.synth). */
export function createVoice(id: string): Voice {
  const soundId = id.split('.')[0];
  const version = versionOf(id);
  const set = SAMPLE_SETS[version];
  const synthDb = LEVEL_DB[`${soundId}.synth`] ?? 0;
  if (!set) return withLevel(synthVoice(soundId), synthDb);
  const trim = (RECORDED_TRIM_DB[soundId] ?? (set.type === 'hits' ? BEAT_TRIM_DB : 0)) + (LEVEL_DB[version] ?? 0);
  // Until the recording arrives, the synth stands in. It plays through the recording's level,
  // so take that back off: the stand-in comes out at the synth's own level.
  const standIn = withLevel(synthVoice(soundId), synthDb - trim);
  return set.type === 'hits' ? recordedHits(version, standIn, trim) : recordedNotes(version, standIn, trim);
}

function withLevel(voice: Voice, db: number): Voice {
  if (db === 0) return voice;
  const level = new Tone.Gain(Tone.dbToGain(db));
  voice.output.connect(level);
  return {
    ...voice,
    output: level,
    dispose() {
      voice.dispose();
      level.dispose();
    },
  };
}
