/**
 * Reads settings/sounds.txt: which recording each sound uses.
 * A choice is the part after the dot in a version's name (kick.studio is "studio", chip.beepbox
 * is "beepbox"), or "synth" for the sound KIDDAW makes itself.
 */

import choicesText from '../../settings/sounds.txt?raw';
import sampleSets from '../engine/sample-sets.json';
import { SYNTH_VERSIONS } from '../engine/synth-versions';

export interface SoundChoices {
  /** Sound id to the full name of what it plays, like kick to kick.studio. Sounds not listed use the synth. */
  choices: Record<string, string>;
  problems: string[];
}

/** Every version of a sound besides its own synth: its recordings, then any extra synth versions. */
export function variantsOf(soundId: string, sets: Record<string, unknown> = sampleSets): string[] {
  return [...Object.keys(sets), ...SYNTH_VERSIONS].filter(id => id.startsWith(`${soundId}.`));
}

export function parseSoundChoices(text: string, sets: Record<string, unknown> = sampleSets): SoundChoices {
  const choices: Record<string, string> = {};
  const problems: string[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const m = line.match(/^([a-z0-9-]+)\s*:\s*([a-z0-9-]+)$/i);
    if (!m) {
      problems.push(`sounds.txt line ${i + 1}: should look like "kick: studio".`);
      return;
    }
    const [, sound, choice] = m.map(s => s.toLowerCase());
    const variant = `${sound}.${choice}`;
    if (choice !== 'synth' && !variantsOf(sound, sets).includes(variant)) {
      const options = [...variantsOf(sound, sets).map(v => v.split('.')[1]), 'synth'];
      problems.push(`sounds.txt line ${i + 1}: ${sound} has no "${choice}". Choices: ${options.join(', ')}.`);
      return;
    }
    choices[sound] = variant;
  });
  return { choices, problems };
}

export const SOUND_CHOICES = parseSoundChoices(choicesText);
