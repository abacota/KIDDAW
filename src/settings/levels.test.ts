import { describe, expect, it } from 'vitest';
import { parseLadders } from './ladders';
import { buildLevels, LEVELS, levelFromPath } from './levels';

describe('levels', () => {
  it('the settings files have no problems', () => {
    expect(LEVELS.problems).toEqual([]);
  });

  it('each level gets the rhythms from its steps and every step below', () => {
    const [k1, g23, g45] = LEVELS.levels;
    expect(k1.figures).toEqual(['ta', 'ta-ti', 'rest']);
    expect(g23.figures).toEqual(['ta', 'ta-ti', 'rest', 'ta-ah', 'ta-ka-ti-ki']);
    expect(g45.figures).toEqual(['ta', 'ta-ti', 'rest', 'ta-ah', 'ta-ka-ti-ki', 'ta-ti-ki', 'ta-ka-ti']);
  });

  it('K-1 has a small canvas and few sounds', () => {
    expect(LEVELS.levels[0]).toMatchObject({ name: 'K-1', link: 'k-1', beats: 4, maxSounds: 3 });
  });

  it('links open their level', () => {
    expect(levelFromPath('/k-1')?.name).toBe('K-1');
    expect(levelFromPath('/Studio/')?.name).toBe('Studio');
    expect(levelFromPath('/')).toBeNull();
    expect(levelFromPath('/grade-9')).toBeNull();
  });

  it('a bad line in levels.txt is pointed out', () => {
    const ladders = parseLadders('Levels: K-1\n== Rhythm ==\nK-1: ta and rest');
    expect(buildLevels(ladders, 'K-1: lots of beats').problems[0]).toMatch(/^levels.txt line 1:/);
  });
});
