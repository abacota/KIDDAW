import { describe, expect, it } from 'vitest';
import { ELEMENTS, LADDERS, levelLinkName, parseLadders } from './ladders';

describe('the ladders file', () => {
  it('has no problems', () => {
    expect(LADDERS.problems).toEqual([]);
  });

  it('has all seven elements, in order, with four levels', () => {
    expect(LADDERS.ladders.map(l => l.element)).toEqual([...ELEMENTS]);
    expect(LADDERS.levels).toEqual(['K-1', '2-3', '4-5', 'Studio']);
    expect(LADDERS.ladders.find(l => l.element === 'Rhythm')!.steps[1]).toEqual({ number: 2, level: 'K-1', text: 'ta-ti' });
  });

  it('level link names are simple', () => {
    expect(LADDERS.levels.map(levelLinkName)).toEqual(['k-1', '2-3', '4-5', 'studio']);
  });
});

describe('reading a ladders file', () => {
  const header = 'Levels: K-1, 2-3, 4-5, Studio\n';
  const allElements = ELEMENTS.map(e => `== ${e} ==\nK-1: first step`).join('\n');

  it('points out a step whose level is missing or misspelled, with its line number', () => {
    const { problems } = parseLadders(header + allElements + '\nGrade 3: something');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^Line 16:/);
  });

  it('points out a step that opens earlier than the step before it', () => {
    const text = header + allElements.replace('== Melody ==\nK-1: first step', '== Melody ==\n4-5: a\n2-3: b');
    expect(parseLadders(text).problems).toEqual(['Melody step 2 opens at 2-3, earlier than step 1 (4-5).']);
  });

  it('points out an unknown element and a missing one', () => {
    const { problems } = parseLadders(header + allElements.replace('== Form ==', '== Forms =='));
    expect(problems.some(p => p.includes('"Forms" isn\'t one of the elements'))).toBe(true);
    expect(problems).toContain('Form has no steps.');
  });
});
