/**
 * A beat written as standard notation, in ABC (the text format abcjs draws from).
 * Each sound gets a one-line percussion staff, with the rhythm syllables printed under
 * the notes, so students can match ta and ta-ti to real notation.
 */

import { beatCount, rowPattern } from './edit';
import { FIGURE_INFO, readBeats, type Cell } from './rhythm';
import { TICKS_PER_BEAT as BEAT, type Note, type Song } from './song';

/** One sixteenth note is the ABC unit (L:1/16), so a beat is 4. */
const SIXTEENTH = BEAT / 4;

/** ABC note lengths in sixteenths for each rhythm, beamed within the beat. */
const FIGURE_ABC: Record<string, string> = {
  ta: 'B4',
  'ta-ti': 'B2B2',
  rest: 'z4',
  'ta-ah': 'B8',
  'ta-ka-ti-ki': 'BBBB',
  'ta-ti-ki': 'B2BB',
  'ta-ka-ti': 'BBB2',
};

/** A rhythm with no syllables yet, written plainly on the sixteenth-note grid. */
function plainBeat(notes: Note[], beat: number): string {
  const onsets = new Set(notes.filter(n => Math.floor(n.start / BEAT) === beat).map(n => Math.round((n.start - beat * BEAT) / SIXTEENTH)));
  let out = '';
  let i = 0;
  while (i < 4) {
    let j = i + 1;
    while (j < 4 && !onsets.has(j)) j++;
    const length = j - i;
    out += (onsets.has(i) ? 'B' : 'z') + (length === 1 ? '' : String(length));
    i = j;
  }
  return out;
}

/** The syllables sung under one beat's notes. */
function syllablesFor(cell: Cell): string[] {
  if (cell.figure === 'held' || cell.figure === 'rest' || cell.figure === 'other') return [];
  if (cell.figure === 'ta-ah') return ['ta\\-ah'];
  return FIGURE_INFO[cell.figure].syllables;
}

/** Notes and syllables are kept separate so the syllables line up under the notes. */
function staffLine(song: Song, layerId: string, beats: number): { music: string; words: string } {
  const pattern = rowPattern(song, layerId);
  if (!pattern) return { music: 'z4 '.repeat(beats).trim(), words: '' };
  const cells = readBeats(pattern);
  const music: string[] = [];
  const words: string[] = [];
  cells.forEach((cell, b) => {
    if (cell.figure === 'held') return;
    let abc: string;
    if (cell.figure === 'other') {
      abc = plainBeat(pattern.notes, b);
      words.push(...abc.split('').filter(c => c === 'B').map(() => '*'));
    } else {
      abc = FIGURE_ABC[cell.figure];
      words.push(...syllablesFor(cell));
    }
    const endsBar = (b + (cell.figure === 'ta-ah' ? 2 : 1)) % 4 === 0;
    music.push(abc + (endsBar ? ' |' : ''));
  });
  return { music: music.join(' ').replace(/\|$/, '|]'), words: words.join(' ') };
}

/** Escapes a sound's name for ABC's quoted text. */
const quoted = (text: string) => text.replace(/["\\]/g, '');

/** Beat Lab's rows as ABC: one single-line staff per sound, syllables underneath. */
export function beatToAbc(song: Song): string {
  const beats = beatCount(song);
  const rows = song.layers.filter(l => l.kind === 'beat');
  const lines = ['X:1', `M:${song.meter.beats}/${song.meter.unit}`, 'L:1/16', '%%stretchlast 1'];
  if (rows.length === 0) return [...lines, 'K:C clef=perc stafflines=1', 'z16|]'].join('\n');
  // Square brackets: each sound on its own staff, grouped together (parentheses would share one staff).
  lines.push(`%%score [${rows.map((_, i) => i + 1).join(' ')}]`);
  lines.push('K:C clef=perc stafflines=1');
  rows.forEach((row, i) => {
    const { music, words } = staffLine(song, row.id, beats);
    lines.push(`V:${i + 1} clef=perc stafflines=1 name="${quoted(row.name)}"`);
    lines.push(music);
    if (words) lines.push(`w: ${words}`);
  });
  return lines.join('\n');
}
