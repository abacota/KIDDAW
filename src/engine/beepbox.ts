/**
 * Sounds borrowed from BeepBox, by John Nesky and contributing authors.
 * https://github.com/johnnesky/beepbox
 *
 * The waveforms, "unison" settings and vibrato depths below are copied from BeepBox's
 * synth/SynthConfig.ts, and the four instruments follow BeepBox presets from
 * editor/EditorConfig.ts. KIDDAW plays them with its own engine on Tone.js.
 *
 * MIT License. Copyright (c) 2012-2024 John Nesky and contributing authors.
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
 * to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
 * PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
 * FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

import * as Tone from 'tone';
import type { Voice } from './voices';

/** BeepBox's chip waveforms: one cycle each, drawn as steps. (BeepBox calls them rounded, triangle, square, 1/4 pulse...) */
export const CHIP_WAVES = {
  rounded: [0.0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4, 0.2, 0.0, -0.2, -0.4, -0.5, -0.6, -0.7, -0.8, -0.85, -0.9, -0.95, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -0.95, -0.9, -0.85, -0.8, -0.7, -0.6, -0.5, -0.4, -0.2],
  triangle: [1, 3, 5, 7, 9, 11, 13, 15, 15, 13, 11, 9, 7, 5, 3, 1, -1, -3, -5, -7, -9, -11, -13, -15, -15, -13, -11, -9, -7, -5, -3, -1].map(v => v / 15),
  square: [1.0, -1.0],
  quarterPulse: [1.0, -1.0, -1.0, -1.0],
  eighthPulse: [1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0],
  sawtooth: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, -31, -29, -27, -25, -23, -21, -19, -17, -15, -13, -11, -9, -7, -5, -3, -1].map(v => v / 31),
  doubleSaw: [0.0, -0.2, -0.4, -0.6, -0.8, -1.0, 1.0, -0.8, -0.6, -0.4, -0.2, 1.0, 0.8, 0.6, 0.4, 0.2],
  doublePulse: [1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0],
  spiky: [1.0, -1.0, 1.0, -1.0, 1.0, 0.0],
};
export type ChipWave = keyof typeof CHIP_WAVES;

/** BeepBox's unisons: a second copy of each note, detuned by spread around offset (in semitones). */
const UNISONS = {
  none: { voices: 1, spread: 0, offset: 0 },
  shimmer: { voices: 2, spread: 0.018, offset: 0 },
  hum: { voices: 2, spread: 0.045, offset: 0 },
  honkyTonk: { voices: 2, spread: 0.09, offset: 0 },
  fifth: { voices: 2, spread: 3.5, offset: 3.5 },
  octave: { voices: 2, spread: 6, offset: 6 },
};

/** BeepBox's vibratos: how far the pitch wobbles, in semitones, about 7 times a second. */
const VIBRATOS = { none: 0, light: 0.15, heavy: 0.45 };

// ── The kid-friendly controls ───────────────────────────────────────────────
// Every control is a short list of named choices, and every combination sounds good.
// The labels are what students see; the hints are for tooltips and teachers.

export const SHAPES = {
  round: { label: 'Round', hint: 'smooth and full', wave: 'rounded' },
  soft: { label: 'Soft', hint: 'gentle, a little like a flute', wave: 'triangle' },
  buzzy: { label: 'Buzzy', hint: 'the classic game sound', wave: 'square' },
  game: { label: 'Video game', hint: 'a bright game hero', wave: 'quarterPulse' },
  thin: { label: 'Thin', hint: 'thin and nasal', wave: 'eighthPulse' },
  bright: { label: 'Bright', hint: 'bold, like a synth lead', wave: 'sawtooth' },
  reedy: { label: 'Reedy', hint: 'a little like an accordion', wave: 'doubleSaw' },
  hollow: { label: 'Hollow', hint: 'hollow and woody', wave: 'doublePulse' },
  spiky: { label: 'Spiky', hint: 'sharp and jangly', wave: 'spiky' },
} as const;

/** levelDb evens out the voices: copies that stay in step add up louder than ones that drift apart. */
export const VOICES = {
  one: { label: 'One', hint: 'a single clean voice', unison: 'none', levelDb: 3.5 },
  shimmer: { label: 'Shimmer', hint: 'two voices, almost together', unison: 'shimmer', levelDb: -1.8 },
  hum: { label: 'Hum', hint: 'two voices that gently hum', unison: 'hum', levelDb: 0 },
  wobbly: { label: 'Wobbly', hint: 'two voices a little out of tune, like an old piano', unison: 'honkyTonk', levelDb: 0 },
  power: { label: 'Power', hint: 'two voices a fifth apart, like a power chord', unison: 'fifth', levelDb: 0.7 },
  highLow: { label: 'High and low', hint: 'two voices an octave apart', unison: 'octave', levelDb: 0.3 },
} as const;

export const WIGGLES = {
  still: { label: 'Still', hint: 'steady pitch', vibrato: 'none' },
  wavy: { label: 'Wavy', hint: 'a gentle wobble, like a singer', vibrato: 'light' },
  extraWavy: { label: 'Extra wavy', hint: 'a big wobble', vibrato: 'heavy' },
} as const;

/** Brightness: how much of the sound's sparkle comes through. */
export const BRIGHTNESSES = {
  dark: { label: 'Dark', hint: 'deep and muffled', hz: 600 },
  warm: { label: 'Warm', hint: 'soft and cozy', hz: 1400 },
  medium: { label: 'Medium', hint: 'in between', hz: 3000 },
  bright: { label: 'Bright', hint: 'clear and shiny', hz: 6000 },
  sparkly: { label: 'Sparkly', hint: 'as bright as it gets', hz: 12000 },
} as const;

/** Twang: the sound starts bright and settles, like a plucked string. */
export const TWANGS = {
  none: { label: 'None', hint: 'the same all the way through', octaves: 0, seconds: 0.01, ring: 0.7 },
  twang: { label: 'Twang', hint: 'starts bright, then mellows', octaves: 2, seconds: 0.5, ring: 3 },
  bigTwang: { label: 'Big twang', hint: 'a quick, springy pluck', octaves: 3.5, seconds: 0.25, ring: 5 },
} as const;

export const STARTS = {
  pop: { label: 'Pop', hint: 'starts right away', seconds: 0.003 },
  soft: { label: 'Soft', hint: 'fades in quickly', seconds: 0.06 },
  swell: { label: 'Swell', hint: 'grows in slowly', seconds: 0.5 },
} as const;

export const ENDS = {
  short: { label: 'Short', hint: 'stops when you let go', seconds: 0.06 },
  medium: { label: 'Medium', hint: 'fades a little', seconds: 0.4 },
  long: { label: 'Long ring', hint: 'keeps ringing', seconds: 1.5 },
} as const;

/** A sound, described the way a student builds it. */
export interface SoundRecipe {
  shape: keyof typeof SHAPES;
  voices: keyof typeof VOICES;
  wiggle: keyof typeof WIGGLES;
  brightness: keyof typeof BRIGHTNESSES;
  twang: keyof typeof TWANGS;
  start: keyof typeof STARTS;
  end: keyof typeof ENDS;
  /** Swirl: a chorus that makes the sound wide and dreamy. */
  swirl: boolean;
}

/** A good sound to start from: round, humming, medium bright. */
export const STARTING_RECIPE: SoundRecipe = {
  shape: 'round',
  voices: 'hum',
  wiggle: 'still',
  brightness: 'medium',
  twang: 'none',
  start: 'pop',
  end: 'medium',
  swirl: false,
};

/** The controls in the order students see them, for building screens. */
export const RECIPE_CONTROLS = [
  { key: 'shape', label: 'Shape', options: SHAPES },
  { key: 'voices', label: 'Voices', options: VOICES },
  { key: 'wiggle', label: 'Wiggle', options: WIGGLES },
  { key: 'brightness', label: 'Brightness', options: BRIGHTNESSES },
  { key: 'twang', label: 'Twang', options: TWANGS },
  { key: 'start', label: 'Start', options: STARTS },
  { key: 'end', label: 'End', options: ENDS },
] as const;

/** Keeps only choices that exist; anything else becomes the starting choice. */
export function parseRecipe(value: unknown): SoundRecipe {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const pick = <T extends object>(options: T, key: string, fallback: keyof T): keyof T =>
    typeof v[key] === 'string' && (v[key] as string) in options ? (v[key] as keyof T) : fallback;
  return {
    shape: pick(SHAPES, 'shape', STARTING_RECIPE.shape),
    voices: pick(VOICES, 'voices', STARTING_RECIPE.voices),
    wiggle: pick(WIGGLES, 'wiggle', STARTING_RECIPE.wiggle),
    brightness: pick(BRIGHTNESSES, 'brightness', STARTING_RECIPE.brightness),
    twang: pick(TWANGS, 'twang', STARTING_RECIPE.twang),
    start: pick(STARTS, 'start', STARTING_RECIPE.start),
    end: pick(ENDS, 'end', STARTING_RECIPE.end),
    swirl: v.swirl === true,
  };
}

/** A recipe as a sound id the engine understands, like any other sound. */
export const RECIPE_PREFIX = 'recipe:';
export const recipeId = (recipe: SoundRecipe) => RECIPE_PREFIX + JSON.stringify(recipe);

/**
 * The tone recipe (strength of each harmonic) of a stepped waveform. BeepBox holds each step
 * flat, so the steps themselves shape the sound; this counts them in, so the copy sounds alike.
 * Scaled to the same total power for every shape, so changing shape doesn't change loudness.
 */
export function partialsOf(steps: readonly number[], count = 48): number[] {
  const n = steps.length;
  const mean = steps.reduce((a, b) => a + b, 0) / n;
  const partials: number[] = [];
  for (let k = 1; k <= count; k++) {
    let re = 0;
    let im = 0;
    steps.forEach((s, j) => {
      re += (s - mean) * Math.cos((2 * Math.PI * k * j) / n);
      im -= (s - mean) * Math.sin((2 * Math.PI * k * j) / n);
    });
    const x = (Math.PI * k) / n;
    const hold = Math.abs(Math.sin(x) / x);
    partials.push((2 * Math.sqrt(re * re + im * im) * hold) / n);
  }
  const power = Math.sqrt(partials.reduce((sum, p) => sum + p * p, 0)) || 1;
  return partials.map(p => (p < power * 1e-4 ? 0 : p / power));
}

/** How much of the filter's loss to give back; a dark sound should still feel a bit softer. */
const BRIGHTNESS_MAKEUP = 0.6;

/**
 * How much of a sound gets through its brightness filter, as a power fraction, for a note
 * around A4. Used to turn the volume back up, so a buzzy shape behind a dark filter isn't
 * quieter than a smooth one.
 */
export function filteredPower(partials: number[], cutoffHz: number, q: number, pitchHz = 440): number {
  return partials.reduce((sum, p, i) => {
    const r = ((i + 1) * pitchHz) / cutoffHz;
    const response = 1 / Math.sqrt((1 - r * r) ** 2 + (r / q) ** 2);
    return sum + (p * Math.min(response, 1)) ** 2;
  }, 0);
}

/**
 * The browser scales every custom waveform so its highest point is the same, which makes
 * thin, spiky waves (tall peaks, little body) sound quieter. This is that peak, so the
 * volume can be given back.
 */
export function waveformPeak(partials: number[], points = 512): number {
  let peak = 0;
  for (let t = 0; t < points; t++) {
    let v = 0;
    partials.forEach((p, i) => {
      v += p * Math.sin((2 * Math.PI * (i + 1) * t) / points);
    });
    peak = Math.max(peak, Math.abs(v));
  }
  return peak || 1;
}

/** Builds a playable instrument from a recipe. */
export function recipeVoice(recipe: SoundRecipe): Voice {
  const wave = CHIP_WAVES[SHAPES[recipe.shape].wave];
  const unison = UNISONS[VOICES[recipe.voices].unison];
  const bright = BRIGHTNESSES[recipe.brightness];
  const twang = TWANGS[recipe.twang];
  const release = ENDS[recipe.end].seconds;
  const partials = partialsOf(wave);
  const kept = filteredPower(partials, bright.hz, 0.7);
  const options = {
    oscillator: { type: 'custom' as const, partials },
    envelope: { attack: STARTS[recipe.start].seconds, decay: 0.05, sustain: 1, release },
    filter: { type: 'lowpass' as const, Q: twang.ring, rolloff: -12 as const },
    filterEnvelope: {
      attack: 0.001,
      decay: twang.seconds,
      sustain: twang.octaves ? 0 : 1,
      release,
      baseFrequency: bright.hz,
      octaves: twang.octaves,
    },
    // Even loudness whatever the choices: voices balanced, and what the filter and the
    // browser's waveform scaling take away is given back.
    volume:
      -24 +
      VOICES[recipe.voices].levelDb -
      BRIGHTNESS_MAKEUP * 10 * Math.log10(Math.max(kept, 0.05)) +
      20 * Math.log10(waveformPeak(partials)),
  };

  // Each voice is its own synth, detuned, joined in one mix.
  const mix = new Tone.Gain(1);
  const out = new Tone.Gain(1);
  const nodes: Tone.ToneAudioNode[] = [mix, out];
  const layers: Tone.PolySynth[] = [];
  const detunes = unison.voices === 1 ? [0] : [unison.offset + unison.spread, unison.offset - unison.spread];
  for (const semitones of detunes) {
    const synth = new Tone.PolySynth(Tone.MonoSynth, { ...options, detune: semitones * 100 }).connect(mix);
    layers.push(synth);
    nodes.push(synth);
  }

  // Effects after the notes: the wiggle (vibrato), then the swirl (chorus).
  const effects: Tone.ToneAudioNode[] = [];
  const wobble = VIBRATOS[WIGGLES[recipe.wiggle].vibrato];
  if (wobble > 0) {
    // Tone's vibrato sweeps a short delay; this depth gives about the same pitch wobble as BeepBox.
    effects.push(new Tone.Vibrato({ frequency: 7, depth: Math.min(1, wobble / 1.9) }));
  }
  if (recipe.swirl) effects.push(new Tone.Chorus({ frequency: 1.2, delayTime: 3.5, depth: 0.6, wet: 0.5 }).start());
  nodes.push(...effects);
  mix.chain(...effects, out);

  return {
    output: out,
    play(time, pitch, seconds, velocity) {
      const frequency = Tone.Frequency(pitch, 'midi').toFrequency();
      layers.forEach(l => l.triggerAttackRelease(frequency, seconds, time, velocity));
    },
    stopAll() {
      layers.forEach(l => l.releaseAll());
    },
    dispose() {
      nodes.forEach(n => n.dispose());
    },
  };
}

/** The BeepBox-style versions of KIDDAW's synths, each after a BeepBox preset, written as recipes. */
export const BEEPBOX_RECIPES: Record<string, SoundRecipe> = {
  // BeepBox's "square lead"
  'chip.beepbox': { ...STARTING_RECIPE, shape: 'buzzy', brightness: 'bright', end: 'short' },
  // BeepBox's "sawtooth lead 2"
  'lead.beepbox': { ...STARTING_RECIPE, shape: 'bright', wiggle: 'wavy', brightness: 'bright' },
  // BeepBox's "polysynth pad"
  'pad.beepbox': { ...STARTING_RECIPE, shape: 'bright', voices: 'wobbly', wiggle: 'wavy', brightness: 'warm', twang: 'twang', start: 'soft', end: 'long', swirl: true },
  // BeepBox's "bass & lead"
  'bass.beepbox': { ...STARTING_RECIPE, shape: 'bright', voices: 'shimmer', brightness: 'dark', twang: 'bigTwang', end: 'short' },
};
