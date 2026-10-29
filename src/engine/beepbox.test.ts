import { describe, expect, it } from 'vitest';
import { BEEPBOX_RECIPES, CHIP_WAVES, parseRecipe, partialsOf, RECIPE_CONTROLS, STARTING_RECIPE } from './beepbox';
import { SYNTH_VERSIONS } from './synth-versions';

describe('BeepBox-style sounds', () => {
  it('a square wave has only odd harmonics, each weaker by 1/k, like the real thing', () => {
    const p = partialsOf(CHIP_WAVES.square, 9);
    expect(p[1]).toBeCloseTo(0);
    expect(p[3]).toBeCloseTo(0);
    expect(p[2] / p[0]).toBeCloseTo(1 / 3, 2);
    expect(p[4] / p[0]).toBeCloseTo(1 / 5, 2);
  });

  it('every shape has the same total power, so changing shape does not change loudness', () => {
    for (const steps of Object.values(CHIP_WAVES)) {
      const power = Math.sqrt(partialsOf(steps).reduce((sum, p) => sum + p * p, 0));
      expect(power).toBeCloseTo(1, 3);
    }
  });

  it('a damaged recipe keeps its good choices and fills the rest from the starting recipe', () => {
    expect(parseRecipe({ shape: 'buzzy', voices: 'kazoo', swirl: 'yes' })).toEqual({ ...STARTING_RECIPE, shape: 'buzzy' });
    expect(parseRecipe(null)).toEqual(STARTING_RECIPE);
  });

  it('every control and choice has a short label students can read, and a hint', () => {
    for (const control of RECIPE_CONTROLS) {
      expect(control.label.length).toBeLessThanOrEqual(12);
      for (const option of Object.values(control.options)) {
        expect(option.label.length).toBeLessThanOrEqual(12);
        expect(option.hint.length).toBeGreaterThan(5);
      }
    }
  });

  it('the controls cover every part of a recipe (swirl is an on-off switch)', () => {
    const keys = [...RECIPE_CONTROLS.map(c => c.key), 'swirl'].sort();
    expect(keys).toEqual(Object.keys(STARTING_RECIPE).sort());
  });

  it('every BeepBox-style version is a clean recipe and is listed for the settings file', () => {
    for (const [id, recipe] of Object.entries(BEEPBOX_RECIPES)) {
      expect(parseRecipe(recipe)).toEqual(recipe);
      expect(SYNTH_VERSIONS).toContain(id);
    }
    expect(SYNTH_VERSIONS.length).toBe(Object.keys(BEEPBOX_RECIPES).length);
  });
});
