/**
 * Everything a level allows, put together from the two plain-text settings files:
 * ladders.txt (which steps are open) and levels.txt (how big the canvas is).
 */

import limitsText from '../../settings/levels.txt?raw';
import { figuresIn, type Figure } from '../song/rhythm';
import { LADDERS, levelLinkName, type Ladders } from './ladders';

export interface Level {
  /** As Adam writes it, like "K-1". */
  name: string;
  /** As it appears in the link, like "k-1". */
  link: string;
  /** Rhythm syllables this level can use, from the Rhythm ladder. */
  figures: Figure[];
  /** How many beats a pattern has. */
  beats: number;
  /** How many sounds (rows) a beat can use. */
  maxSounds: number;
}

export interface Levels {
  levels: Level[];
  problems: string[];
}

export function buildLevels(ladders: Ladders, limits: string): Levels {
  const problems: string[] = [];
  const found = new Map<string, { beats: number; sounds: number }>();

  limits.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const m = line.match(/^([^:]+):\s*(\d+)\s*beats?\s*,\s*(\d+)\s*sounds?$/i);
    const level = m && ladders.levels.find(l => l.toLowerCase() === m[1].trim().toLowerCase());
    if (!m || !level) {
      problems.push(`levels.txt line ${i + 1}: should look like "K-1: 4 beats, 3 sounds", with a level from ladders.txt.`);
      return;
    }
    found.set(level, { beats: Number(m[2]), sounds: Number(m[3]) });
  });

  const rhythm = ladders.ladders.find(l => l.element === 'Rhythm');
  const levels = ladders.levels.map((name, index) => {
    const limit = found.get(name);
    if (!limit) problems.push(`levels.txt has no line for ${name}.`);
    const open = (rhythm?.steps ?? []).filter(s => ladders.levels.indexOf(s.level) <= index).map(s => s.text);
    return {
      name,
      link: levelLinkName(name),
      figures: figuresIn(open),
      beats: Math.min(16, Math.max(2, limit?.beats ?? 4)),
      maxSounds: Math.min(8, Math.max(1, limit?.sounds ?? 3)),
    };
  });

  for (const level of levels) {
    if (!level.figures.includes('rest') || !level.figures.includes('ta')) {
      problems.push(`${level.name} needs ta and rest on the Rhythm ladder.`);
    }
  }
  return { levels, problems };
}

export const LEVELS = buildLevels(LADDERS, limitsText);

/** The level a link opens, like kiddaw.vercel.app/k-1. */
export function levelFromPath(path: string): Level | null {
  const name = path.replace(/^\/+|\/+$/g, '').toLowerCase();
  return LEVELS.levels.find(l => l.link === name) ?? null;
}
