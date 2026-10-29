/**
 * Sound check: Adam hears every version of every sound side by side and picks a favorite.
 * Picks are kept on this computer and shown as lines ready for settings/sounds.txt.
 */

import { useEffect, useMemo, useState } from 'react';
import { engine, type PreviewHit } from '../engine/engine';
import { SAMPLE_SETS } from '../engine/samples';
import { preloadSound, versionOf } from '../engine/voices';
import { variantsOf } from '../settings/sounds';
import { soundById } from '../song/sounds';
import { SoundMaker } from './SoundMaker';
import { TICKS_PER_BEAT as BEAT } from '../song/song';

const E = BEAT / 2;
const PICKS_KEY = 'kiddaw.soundcheck.picks';

/** Hits from [beat, velocity] pairs. */
const beats = (list: [number, number][], length = E): PreviewHit[] => list.map(([b, v]) => [b * BEAT, length, v]);

/** Each sound's short test phrase: soft to loud, so the soft and loud recordings both get heard. */
const PHRASES: Record<string, PreviewHit[]> = {
  kick: beats([[0, 0.3], [1, 0.5], [2, 0.75], [3, 1]]),
  snare: beats([[0, 0.3], [1, 0.5], [2, 0.6], [2.5, 0.7], [3, 1]]),
  hihat: beats([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((b, i) => [b, i % 2 ? 0.45 : 0.85])),
  openhat: beats([[0, 0.5], [1, 0.9], [2, 0.9]]),
  tom: beats([[0, 0.4], [0.5, 0.6], [1, 0.8], [1.5, 1], [2, 1]]),
  lowtom: beats([[0, 0.4], [0.5, 0.6], [1, 0.8], [1.5, 1], [2, 1]]),
  crash: beats([[0, 1], [2.5, 0.5]]),
  ride: beats([0, 1, 1.5, 2, 3, 3.5].map(b => [b, 0.7])),
  stomp: beats([[0, 0.4], [1, 0.7], [2, 1], [3, 1]]),
  pat: beats([[0, 0.4], [1, 0.6], [1.5, 0.6], [2, 1], [3, 1]]),
  clap: beats([[0, 0.4], [1, 0.7], [2, 0.8], [2.5, 0.8], [3, 1]]),
  snap: beats([[0, 0.5], [1, 0.7], [2, 1], [3, 1]]),
  chest: beats([[0, 0.4], [1, 0.7], [2, 1], [2.5, 1], [3, 1]]),
};

/** Piano: up a C major scale, then I IV V I chords, soft then loud. */
const PIANO: PreviewHit[] = [
  ...[60, 62, 64, 65, 67, 69, 71, 72].map((p, i): PreviewHit => [i * E, E, 0.7, p]),
  ...[[48, 60, 64, 67], [53, 60, 65, 69], [55, 59, 62, 67], [48, 60, 64, 72]].flatMap((chord, i) =>
    chord.map((p): PreviewHit => [(4 + i) * BEAT, BEAT * (i === 3 ? 2 : 1), i < 2 ? 0.45 : 0.9, p]),
  ),
];

/** Where each pitched instrument sounds best, as a MIDI note: its phrase starts here. */
const HOME_NOTE: Record<string, number> = {
  violin: 67, cello: 48, doublebass: 36, flute: 72, clarinet: 60, recorder: 72, trumpet: 60, horn: 53, trombone: 48,
  guitar: 48, steelguitar: 48, ebass: 36, chip: 72, lead: 72, pad: 60, pluck: 60, bell: 72, bass: 36,
};

const BASS_LINES = new Set(['doublebass', 'ebass', 'bass']);
const SYNTH_IS_A_CHOICE = new Set([
  'kick', 'snare', 'hihat', 'openhat', 'tom', 'lowtom', 'crash', 'ride', 'stomp', 'pat', 'clap', 'snap', 'chest', 'piano',
  'chip', 'lead', 'pad', 'pluck', 'bell', 'bass',
]);
const STRUMMED = new Set(['guitar', 'steelguitar']);

/** A short phrase that suits the instrument: a melody, a bass line, a strum or a held chord. */
function phraseFor(sound: string): PreviewHit[] {
  if (sound === 'piano') return PIANO;
  if (PHRASES[sound]) return PHRASES[sound];
  const home = HOME_NOTE[sound] ?? 60;
  const note = (beat: number, length: number, step: number, velocity = 0.75): PreviewHit => [beat * BEAT, length * BEAT, velocity, home + step];
  if (sound === 'pad') return [0, 4, 7, 12].map(step => note(0, 4, step, 0.6));
  if (BASS_LINES.has(sound)) return [[0, 0], [1, 0], [2, 7], [3, 7], [4, 5], [5, 5], [6, 7]].map(([b, st], i) => note(b, i === 6 ? 2 : 1, st));
  if (STRUMMED.has(sound)) {
    const picked = [0, 4, 7, 12, 16, 12, 7, 4].map((step, i) => note(i / 2, 0.5, step, 0.7));
    const strum = [0, 4, 7, 12, 16].map((step, i): PreviewHit => [4 * BEAT + i * 4, 3 * BEAT, 0.8, home + step]);
    return [...picked, ...strum];
  }
  return [
    ...[0, 2, 4, 5, 7].map((step, i) => note(i / 2, 0.5, step, 0.55 + i * 0.07)),
    note(2.5, 1, 7, 0.85),
    note(3.5, 1, 4, 0.7),
    note(4.5, 2, 0, 0.6),
  ];
}

/** Two bars of a basic rock beat, for hearing a whole kit at once. */
function groove(kit: string): { sound: string; hits: PreviewHit[] }[] {
  const v = (sound: string) => (kit === 'synth' ? `${sound}.synth` : `${sound}.${kit}`);
  const bars = [0, 4];
  return [
    { sound: v('kick'), hits: bars.flatMap(b => beats([[b, 0.9], [b + 2, 0.9], [b + 2.5, 0.7]])) },
    { sound: v('snare'), hits: bars.flatMap(b => beats([[b + 1, 0.85], [b + 3, 0.9]])) },
    { sound: v('hihat'), hits: Array.from({ length: 16 }, (_, i): PreviewHit => [i * E, E, i % 2 ? 0.45 : 0.75]) },
    { sound: v('crash'), hits: beats([[0, 0.8]]) },
  ];
}

const GROUPS: { title: string; sounds: string[] }[] = [
  { title: 'Drum kit', sounds: ['kick', 'snare', 'hihat', 'openhat', 'tom', 'lowtom', 'crash', 'ride'] },
  { title: 'Body percussion', sounds: ['stomp', 'pat', 'clap', 'snap', 'chest'] },
  { title: 'Piano', sounds: ['piano'] },
  { title: 'Orchestra and band', sounds: ['violin', 'cello', 'doublebass', 'flute', 'clarinet', 'recorder', 'trumpet', 'horn', 'trombone'] },
  { title: 'Guitar and bass', sounds: ['guitar', 'steelguitar', 'ebass'] },
  { title: 'Synths', sounds: ['chip', 'lead', 'pad', 'pluck', 'bell', 'bass'] },
];

const VERSION_NAMES: Record<string, string> = {
  studio: 'Studio kit',
  rock: 'Rock kit',
  recorded: 'Recorded',
  beepbox: 'BeepBox style',
  salamander: 'Grand piano',
  synth: 'Synth',
};

const versionName = (version: string) => VERSION_NAMES[version.split('.')[1]] ?? version.split('.')[1];

function loadPicks(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PICKS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function SoundCheck() {
  const [picks, setPicks] = useState<Record<string, string>>(loadPicks);
  const [playing, setPlaying] = useState('');
  const [copied, setCopied] = useState(false);

  // Start every download now, so nothing waits when it's tapped.
  useEffect(() => {
    for (const g of GROUPS) for (const s of g.sounds) for (const v of variantsOf(s)) preloadSound(v);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PICKS_KEY, JSON.stringify(picks));
    } catch {
      // Picks still show on the page; they just won't be remembered.
    }
  }, [picks]);

  const play = async (key: string, parts: { sound: string; hits: PreviewHit[] }[]) => {
    setPlaying(key);
    await engine.previewTogether(parts);
    window.setTimeout(() => setPlaying(p => (p === key ? '' : p)), 1500);
  };

  const pickLines = useMemo(
    () =>
      GROUPS.flatMap(g => g.sounds)
        .filter(s => variantsOf(s).length > 0)
        .map(s => `${s}: ${(picks[s] ?? versionOf(s)).split('.')[1]}`)
        .join('\n'),
    [picks],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pickLines);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const credits = Object.values(SAMPLE_SETS).reduce<Record<string, string>>((all, set) => ({ ...all, [set.source]: set.license }), {
    'BeepBox-style synths: waveforms and presets from BeepBox by John Nesky and contributing authors': 'MIT',
  });

  return (
    <div className="min-h-screen bg-amber-50 text-slate-900">
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <header>
          <h1 className="text-4xl font-black tracking-tight">Sound check</h1>
          <p className="mt-2 text-slate-600">
            Tap a version to hear it, then pick your favorite for each sound. Headphones or good speakers help.
            Your picks are listed at the bottom.
          </p>
        </header>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-xl font-black">Whole drum kit</h2>
          <p className="mb-3 text-sm text-slate-500">The same two bars on each kit: kick, snare, hi-hat and a crash.</p>
          <div className="flex flex-wrap gap-2">
            {['studio', 'rock', 'synth'].map(kit => (
              <button
                key={kit}
                onClick={() => play(`groove-${kit}`, groove(kit))}
                className={
                  'rounded-2xl px-5 py-3 font-bold shadow-sm transition active:scale-95 ' +
                  (playing === `groove-${kit}` ? 'bg-amber-400' : 'bg-amber-100 hover:bg-amber-200')
                }
              >
                ▶ {VERSION_NAMES[kit]}
              </button>
            ))}
          </div>
        </section>

        {GROUPS.map(group => (
          <section key={group.title} className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xl font-black">{group.title}</h2>
            <div className="divide-y divide-slate-100">
              {group.sounds.map(sound => {
                const recorded = variantsOf(sound);
                // For orchestra and band, the synth only stands in while a recording downloads, so it isn't a choice.
                const versions = recorded.length === 0 || SYNTH_IS_A_CHOICE.has(sound) ? [...recorded, `${sound}.synth`] : recorded;
                const chosen = picks[sound] ?? versionOf(sound);
                const hits = phraseFor(sound);
                const onlyOne = versions.length === 1;
                return (
                  <div key={sound} className="flex flex-wrap items-center gap-2 py-3">
                    <span className="w-32 font-bold">{soundById(sound)?.name ?? sound}</span>
                    {versions.map(version => (
                      <div key={version} className="flex items-center overflow-hidden rounded-2xl border-2 border-slate-200">
                        <button
                          onClick={() => play(version, [{ sound: version, hits }])}
                          className={
                            'px-4 py-2 font-bold transition active:scale-95 ' +
                            (playing === version ? 'bg-amber-400' : 'bg-white hover:bg-amber-50')
                          }
                        >
                          ▶ {onlyOne ? 'Listen' : versionName(version)}
                        </button>
                        {!onlyOne && <button
                          onClick={() => setPicks(p => ({ ...p, [sound]: version }))}
                          aria-pressed={chosen === version}
                          title="Pick this one"
                          className={
                            'border-l-2 border-slate-200 px-3 py-2 text-sm font-bold ' +
                            (chosen === version ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:bg-slate-50')
                          }
                        >
                          {chosen === version ? '✓ Pick' : 'Pick'}
                        </button>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <SoundMaker />

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-xl font-black">Your picks</h2>
          <p className="mb-3 text-sm text-slate-500">
            Send these to Claude, or paste them into settings/sounds.txt.
          </p>
          <pre className="rounded-2xl bg-slate-50 p-4 font-mono text-sm">{pickLines}</pre>
          <button onClick={copy} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 font-bold text-white">
            {copied ? 'Copied' : 'Copy my picks'}
          </button>
        </section>

        <section className="text-sm text-slate-500">
          <h2 className="mb-1 font-bold text-slate-700">Sound credits</h2>
          <ul className="list-disc pl-5">
            {Object.entries(credits).map(([source, license]) => (
              <li key={source}>
                {source} ({license})
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
