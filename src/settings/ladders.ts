/**
 * Reads settings/ladders.txt: the steps of each element of music, and which level opens each step.
 * Adam edits that file in plain text; problems are reported with line numbers in plain words.
 */

import ladderText from '../../settings/ladders.txt?raw';

export const ELEMENTS = ['Rhythm', 'Melody', 'Harmony', 'Texture', 'Timbre', 'Dynamics', 'Form'] as const;
export type Element = (typeof ELEMENTS)[number];

export interface Step {
  /** 1 is the bottom of the ladder. */
  number: number;
  /** The level where this step first opens, like "K-1". */
  level: string;
  text: string;
}

export interface Ladder {
  element: Element;
  steps: Step[];
}

export interface Ladders {
  /** Lowest first, like K-1, 2-3, 4-5, Studio. */
  levels: string[];
  /** In the order of ELEMENTS. */
  ladders: Ladder[];
  /** Plain-words problems. An empty list means the file is fine. */
  problems: string[];
}

/** The level's name in a link: "K-1" becomes kiddaw.vercel.app/k-1. */
export function levelLinkName(level: string): string {
  return level.trim().toLowerCase().replace(/\s+/g, '-');
}

export function parseLadders(text: string): Ladders {
  const problems: string[] = [];
  let levels: string[] = [];
  const found = new Map<Element, Step[]>();
  let current: Step[] | null = null;

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    const where = `Line ${i + 1}`;
    if (!line || line.startsWith('#')) return;

    const levelsLine = line.match(/^levels\s*:\s*(.+)$/i);
    if (levelsLine) {
      levels = levelsLine[1].split(',').map(l => l.trim()).filter(Boolean);
      return;
    }

    const heading = line.match(/^==\s*(.+?)\s*==$/);
    if (heading) {
      const element = ELEMENTS.find(e => e.toLowerCase() === heading[1].toLowerCase());
      if (!element) {
        problems.push(`${where}: "${heading[1]}" isn't one of the elements (${ELEMENTS.join(', ')}).`);
        current = null;
      } else if (found.has(element)) {
        problems.push(`${where}: ${element} appears twice.`);
        current = null;
      } else {
        current = [];
        found.set(element, current);
      }
      return;
    }

    const step = line.match(/^([^:]+):\s*(.+)$/);
    const level = step && levels.find(l => l.toLowerCase() === step[1].trim().toLowerCase());
    if (!step || !level) {
      problems.push(`${where}: a step should start with a level (${levels.join(', ') || 'no levels listed yet'}), then a colon.`);
      return;
    }
    if (!current) {
      problems.push(`${where}: this step isn't under an element heading like == Rhythm ==.`);
      return;
    }
    current.push({ number: current.length + 1, level, text: step[2].trim() });
  });

  if (levels.length === 0) problems.push('The file needs a line like "Levels: K-1, 2-3, 4-5, Studio".');

  const ladders: Ladder[] = [];
  for (const element of ELEMENTS) {
    const steps = found.get(element);
    if (!steps || steps.length === 0) {
      problems.push(`${element} has no steps.`);
      continue;
    }
    steps.forEach((s, i) => {
      const before = steps[i - 1];
      if (before && levels.indexOf(s.level) < levels.indexOf(before.level)) {
        problems.push(`${element} step ${s.number} opens at ${s.level}, earlier than step ${before.number} (${before.level}).`);
      }
    });
    ladders.push({ element, steps });
  }

  return { levels, ladders, problems };
}

export const LADDERS = parseLadders(ladderText);
