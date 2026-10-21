import { describe, expect, it } from 'vitest';
import sampleSets from '../engine/sample-sets.json';
import { soundById } from '../song/sounds';
import { parseSoundChoices, SOUND_CHOICES, variantsOf } from './sounds';

describe('sound choices', () => {
  it('the settings file has no problems', () => {
    expect(SOUND_CHOICES.problems).toEqual([]);
  });

  it('every choice is a real sound', () => {
    for (const sound of Object.keys(SOUND_CHOICES.choices)) expect(soundById(sound)).toBeDefined();
  });

  it('a choice that does not exist is pointed out with the real choices', () => {
    const { problems } = parseSoundChoices('kick: jazz');
    expect(problems[0]).toMatch(/kick has no "jazz". Choices: .*studio.*synth/);
  });

  it('every sound with a recording is chosen in the settings file', () => {
    const recorded = new Set(Object.keys(sampleSets).map(id => id.split('.')[0]));
    expect([...recorded].filter(s => !SOUND_CHOICES.choices[s])).toEqual([]);
  });

  it('synth is always a choice', () => {
    expect(parseSoundChoices('kick: synth').choices.kick).toBe('kick.synth');
  });

  it('every recorded sound set has files', () => {
    for (const [id, set] of Object.entries(sampleSets) as [string, any][]) {
      const files = set.type === 'hits' ? set.layers.flat() : Object.values(set.notes);
      expect(files.length, id).toBeGreaterThan(0);
      expect(set.license, id).toBeTruthy();
    }
    expect(variantsOf('kick')).toEqual(expect.arrayContaining(['kick.studio', 'kick.rock']));
  });
});
