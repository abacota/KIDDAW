import { describe, expect, it } from 'vitest';
import { addBeatRow, beatCount, changeSound, newBeatSong, removeLayer, rowPattern, setFigure, toggleMute } from './edit';
import { readBeats } from './rhythm';
import { parseSong } from './song';

describe('Beat Lab edits', () => {
  it('a new beat is a steady beat of claps, and a clean song', () => {
    const song = newBeatSong(4);
    expect(parseSong(song)).toEqual(song);
    expect(beatCount(song)).toBe(4);
    expect(song.layers.map(l => l.sound)).toEqual(['clap']);
    expect(readBeats(rowPattern(song, song.layers[0].id)!).map(c => c.figure)).toEqual(['ta', 'ta', 'ta', 'ta']);
  });

  it('an 8-beat song is two bars long', () => {
    const song = newBeatSong(8);
    expect(song.sections[0].bars).toBe(2);
    expect(beatCount(song)).toBe(8);
  });

  it('a new row starts with rests and plays in the section', () => {
    const song = addBeatRow(newBeatSong(4), 'stomp');
    const row = song.layers[1];
    expect(row).toMatchObject({ name: 'Stomp', sound: 'stomp' });
    expect(readBeats(rowPattern(song, row.id)!).every(c => c.figure === 'rest')).toBe(true);
    expect(parseSong(song)).toEqual(song);
  });

  it('putting ta-ti on beat 2 changes only that beat', () => {
    const start = newBeatSong(4);
    const id = start.layers[0].id;
    const song = setFigure(start, id, 1, 'ta-ti');
    expect(readBeats(rowPattern(song, id)!).map(c => c.figure)).toEqual(['ta', 'ta-ti', 'ta', 'ta']);
    expect(readBeats(rowPattern(start, id)!).map(c => c.figure)).toEqual(['ta', 'ta', 'ta', 'ta']);
  });

  it('changing the sound keeps the rhythm', () => {
    const start = newBeatSong(4);
    const id = start.layers[0].id;
    const song = changeSound(setFigure(start, id, 1, 'ta-ti'), id, 'snare');
    expect(song.layers[0]).toMatchObject({ sound: 'snare', name: 'Snare drum' });
    expect(readBeats(rowPattern(song, id)!)[1].figure).toBe('ta-ti');
  });

  it('removing a row takes it out of the section too', () => {
    const withTwo = addBeatRow(newBeatSong(4), 'pat');
    const song = removeLayer(withTwo, withTwo.layers[1].id);
    expect(song.layers).toHaveLength(1);
    expect(Object.keys(song.sections[0].parts)).toEqual([song.layers[0].id]);
  });

  it('a muted row can be unmuted', () => {
    const song = newBeatSong(4);
    const id = song.layers[0].id;
    expect(toggleMute(song, id).layers[0].muted).toBe(true);
    expect(toggleMute(toggleMute(song, id), id).layers[0].muted).toBe(false);
  });
});
