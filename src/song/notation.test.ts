import { describe, expect, it } from 'vitest';
import { addBeatRow, newBeatSong, setFigure } from './edit';
import { beatToAbc } from './notation';
import { TICKS_PER_BEAT as BEAT } from './song';

const musicAndWords = (abc: string) => {
  const lines = abc.split('\n');
  const first = lines.findIndex(l => l.startsWith('V:1'));
  return { music: lines[first + 1], words: lines[first + 2] };
};

describe('beats as standard notation', () => {
  it('a steady beat is four quarter notes, sung ta ta ta ta', () => {
    const { music, words } = musicAndWords(beatToAbc(newBeatSong(4)));
    expect(music).toBe('B4 B4 B4 B4 |]');
    expect(words).toBe('w: ta ta ta ta');
  });

  it('every rhythm card becomes the right notes, beamed within its beat', () => {
    let song = newBeatSong(8);
    const id = song.layers[0].id;
    song = setFigure(song, id, 0, 'ta-ti');
    song = setFigure(song, id, 1, 'rest');
    song = setFigure(song, id, 2, 'ta-ka-ti-ki');
    song = setFigure(song, id, 3, 'ta-ti-ki');
    song = setFigure(song, id, 4, 'ta-ka-ti');
    song = setFigure(song, id, 5, 'ta-ah');
    const { music, words } = musicAndWords(beatToAbc(song));
    expect(music).toBe('B2B2 z4 BBBB B2BB | BBB2 B8 B4 |]');
    expect(words).toBe('w: ta ti ta ka ti ki ta ti ki ta ka ti ta\\-ah ta');
  });

  it('each sound gets its own staff with its name, all braced together', () => {
    const song = addBeatRow(newBeatSong(4), 'stomp');
    const abc = beatToAbc(song);
    expect(abc).toContain('%%score [1 2]');
    expect(abc).toContain('V:1 clef=perc stafflines=1 name="Clap"');
    expect(abc).toContain('V:2 clef=perc stafflines=1 name="Stomp"');
    expect(abc.split('\n')).toContain('z4 z4 z4 z4 |]');
  });

  it('a rhythm made elsewhere, with no syllables yet, is still written correctly', () => {
    const song = newBeatSong(4);
    const layer = song.layers[0];
    layer.patterns[0] = { ...layer.patterns[0], notes: [{ start: BEAT / 4, length: BEAT / 4, pitch: 0, velocity: 96 }] };
    const { music } = musicAndWords(beatToAbc(song));
    expect(music.startsWith('zB3 ')).toBe(true);
  });

  it('never writes the ruled-out syllable', () => {
    let song = newBeatSong(4);
    for (let b = 0; b < 4; b++) song = setFigure(song, song.layers[0].id, b, 'ta-ti');
    expect(beatToAbc(song)).not.toMatch(/ti-ti/i);
  });
});
