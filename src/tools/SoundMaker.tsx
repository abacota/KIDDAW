/**
 * Make a sound: the BeepBox-style controls in kid words. Pick a shape, voices, wiggle,
 * brightness, twang, start and end, and hear it right away. Every combination sounds good.
 * This is a first look at the timbre ladder's "shape a sound" and "design a sound" steps.
 */

import { useEffect, useState } from 'react';
import { BEEPBOX_RECIPES, parseRecipe, RECIPE_CONTROLS, recipeId, STARTING_RECIPE, type SoundRecipe } from '../engine/beepbox';
import { engine, type PreviewHit } from '../engine/engine';
import { TICKS_PER_BEAT as BEAT } from '../song/song';

const RECIPE_KEY = 'kiddaw.soundmaker.recipe';

const note = (beat: number, beats: number, pitch: number, velocity = 0.75): PreviewHit => [beat * BEAT, beats * BEAT, velocity, pitch];

const LISTEN: { label: string; hits: PreviewHit[] }[] = [
  {
    label: 'Melody',
    hits: [72, 74, 76, 79, 81, 79, 76].map((p, i) => note(i / 2, i === 6 ? 1.5 : 0.5, p)).concat([note(4, 2, 72, 0.7)]),
  },
  { label: 'Bass line', hits: [[0, 36], [1, 36], [2, 43], [3, 43], [4, 41], [5, 41], [6, 43]].map(([b, p], i) => note(b, i === 6 ? 2 : 1, p)) },
  { label: 'Chord', hits: [60, 64, 67, 72].map(p => note(0, 4, p, 0.6)) },
];

const START_FROM: [string, string][] = [
  ['chip.beepbox', 'Chip'],
  ['lead.beepbox', 'Lead'],
  ['pad.beepbox', 'Pad'],
  ['bass.beepbox', 'Bass'],
];

function loadRecipe(): SoundRecipe {
  try {
    const saved = localStorage.getItem(RECIPE_KEY);
    return saved ? parseRecipe(JSON.parse(saved)) : STARTING_RECIPE;
  } catch {
    return STARTING_RECIPE;
  }
}

export function SoundMaker() {
  const [recipe, setRecipe] = useState<SoundRecipe>(loadRecipe);

  useEffect(() => {
    try {
      localStorage.setItem(RECIPE_KEY, JSON.stringify(recipe));
    } catch {
      // The sound still works; it just won't be remembered.
    }
  }, [recipe]);

  const listen = (hits: PreviewHit[], r = recipe) => void engine.preview(recipeId(r), hits);

  // Ears first: every change plays a short taste of the new sound.
  const change = (next: SoundRecipe) => {
    setRecipe(next);
    listen(LISTEN[0].hits.slice(0, 4), next);
  };

  const summary = RECIPE_CONTROLS.map(c => (c.options as Record<string, { label: string }>)[recipe[c.key]].label);

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-xl font-black">Make a sound</h2>
      <p className="mb-4 text-sm text-slate-500">
        BeepBox's sound ingredients, in kid words. Every choice plays a little taste of the sound.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="w-28 text-sm font-black text-slate-500">Start from</span>
        {START_FROM.map(([id, label]) => (
          <button
            key={id}
            onClick={() => change(BEEPBOX_RECIPES[id])}
            className="rounded-xl bg-amber-100 px-3 py-2 font-bold hover:bg-amber-200 active:scale-95"
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => change(STARTING_RECIPE)}
          className="rounded-xl px-3 py-2 font-bold text-slate-400 hover:bg-slate-100"
        >
          Start over
        </button>
      </div>

      <div className="space-y-3">
        {RECIPE_CONTROLS.map(control => (
          <div key={control.key} className="flex flex-wrap items-center gap-2">
            <span className="w-28 font-black">{control.label}</span>
            {Object.entries(control.options).map(([value, option]) => {
              const chosen = recipe[control.key] === value;
              return (
                <button
                  key={value}
                  title={option.hint}
                  aria-pressed={chosen}
                  onClick={() => change({ ...recipe, [control.key]: value })}
                  className={
                    'rounded-xl border-2 px-3 py-2 font-bold transition active:scale-95 ' +
                    (chosen ? 'border-amber-400 bg-amber-100' : 'border-slate-200 bg-white hover:border-slate-300')
                  }
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-28 font-black">Swirl</span>
          {[false, true].map(on => (
            <button
              key={String(on)}
              title={on ? 'wide and dreamy' : 'plain'}
              aria-pressed={recipe.swirl === on}
              onClick={() => change({ ...recipe, swirl: on })}
              className={
                'rounded-xl border-2 px-3 py-2 font-bold transition active:scale-95 ' +
                (recipe.swirl === on ? 'border-amber-400 bg-amber-100' : 'border-slate-200 bg-white hover:border-slate-300')
              }
            >
              {on ? 'On' : 'Off'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t-2 border-slate-100 pt-4">
        <span className="w-28 font-black">Listen</span>
        {LISTEN.map(l => (
          <button
            key={l.label}
            onClick={() => listen(l.hits)}
            className="rounded-2xl bg-emerald-500 px-4 py-2 font-black text-white shadow-sm hover:bg-emerald-400 active:scale-95"
          >
            ▶ {l.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-500">
        Your sound: {summary.join(' · ')}
        {recipe.swirl ? ' · Swirl' : ''}
      </p>
    </section>
  );
}
