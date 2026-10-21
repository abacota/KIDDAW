/**
 * Sound check: Adam hears every version of every sound side by side and picks a favorite.
 * Picks are kept on this computer and shown as lines ready for settings/sounds.txt.
 */

import { useEffect, useMemo, useState } from 'react';
import { engine, type PreviewHit } from '../engine/engine';
import { SAMPLE_SETS } from '../engine/samples';
import { preloadSound } from '../engine/voices';
import { SOUND_CHOICES, variantsOf } from '../settings/sounds';
import { soundById } from '../song/sounds';
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
];

const VERSION_NAMES: Record<string, string> = {
  studio: 'Studio kit',
  rock: 'Rock kit',
  recorded: 'Recorded',
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
        .map(s => `${s}: ${(picks[s] ?? SOUND_CHOICES.choices[s] ?? `${s}.synth`).split('.')[1]}`)
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

  const credits = Object.values(SAMPLE_SETS).reduce<Record<string, string>>((all, set) => ({ ...all, [set.source]: set.license }), {});

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
                const versions = [...variantsOf(sound), `${sound}.synth`];
                const chosen = picks[sound] ?? SOUND_CHOICES.choices[sound] ?? `${sound}.synth`;
                const hits = sound === 'piano' ? PIANO : PHRASES[sound];
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
                          ▶ {versionName(version)}
                        </button>
                        <button
                          onClick={() => setPicks(p => ({ ...p, [sound]: version }))}
                          aria-pressed={chosen === version}
                          title="Pick this one"
                          className={
                            'border-l-2 border-slate-200 px-3 py-2 text-sm font-bold ' +
                            (chosen === version ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:bg-slate-50')
                          }
                        >
                          {chosen === version ? '✓ Pick' : 'Pick'}
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

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
