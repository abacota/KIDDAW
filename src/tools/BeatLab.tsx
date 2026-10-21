/**
 * Beat Lab: students build a rhythm pattern, one beat at a time, in ta and ta-ti.
 * Each row is one sound. The pattern loops while they work, so they hear every change.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { engine } from '../engine/engine';
import { browserStorage, createShelf } from '../saving/shelf';
import type { Level } from '../settings/levels';
import {
  addBeatRow,
  beatCount,
  newBeatSong,
  removeLayer,
  renameSong,
  rowPattern,
  setFigure,
  setTempo,
  TEMPOS,
  toggleMute,
  type TempoName,
} from '../song/edit';
import { FIGURE_INFO, readBeats, type Cell, type Figure } from '../song/rhythm';
import { KITS, soundById, soundsInKit } from '../song/sounds';
import { TICKS_PER_BEAT, type Song } from '../song/song';
import { Sticks } from './Sticks';
import { useEngineState, usePlayhead } from './useEngine';

const shelf = createShelf(browserStorage());

/** Each sound's color, so a row is easy to find by eye and by name. */
const SOUND_COLORS: Record<string, string> = {
  stomp: 'bg-orange-500',
  pat: 'bg-amber-400',
  clap: 'bg-rose-500',
  snap: 'bg-violet-500',
  chest: 'bg-red-700',
  kick: 'bg-blue-600',
  snare: 'bg-teal-500',
  hihat: 'bg-sky-400',
  openhat: 'bg-cyan-300',
  tom: 'bg-indigo-500',
  lowtom: 'bg-indigo-800',
  crash: 'bg-yellow-400',
  ride: 'bg-lime-500',
};

const TEMPO_LABELS: Record<TempoName, [string, string]> = { slow: ['🐢', 'Slow'], medium: ['🚶', 'Medium'], fast: ['🐇', 'Fast'] };

function openSong(level: Level): Song {
  const id = shelf.current(level.link);
  const saved = id ? shelf.load(id) : null;
  if (saved && saved.layers.some(l => l.kind === 'beat')) return saved;
  return newBeatSong(level.beats);
}

export function BeatLab({ level }: { level: Level }) {
  const [song, setSong] = useState<Song>(() => openSong(level));
  const [card, setCard] = useState<Figure>(level.figures.includes('ta-ti') ? 'ta-ti' : 'ta');
  const [picking, setPicking] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [hint, setHint] = useState('');
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const { status } = useEngineState();
  const playing = status === 'playing';
  const tick = usePlayhead(playing);

  const beats = beatCount(song);
  const rows = song.layers.filter(l => l.kind === 'beat');
  const nowBeat = playing ? Math.floor((tick % (beats * TICKS_PER_BEAT)) / TICKS_PER_BEAT) : -1;
  const tempoName = (Object.keys(TEMPOS) as TempoName[]).reduce((best, name) =>
    Math.abs(TEMPOS[name] - song.tempo) < Math.abs(TEMPOS[best] - song.tempo) ? name : best,
  );

  // The engine always has the latest song, and the pattern loops while students work.
  useEffect(() => {
    engine.setSong(song);
    engine.setLoop({ start: 0, end: beats * TICKS_PER_BEAT });
  }, [song, beats]);

  // Save a moment after each change.
  const firstSave = useRef(true);
  useEffect(() => {
    if (firstSave.current) {
      firstSave.current = false;
      shelf.setCurrent(level.link, song.id);
    }
    const id = window.setTimeout(() => {
      shelf.save(song);
      shelf.setCurrent(level.link, song.id);
    }, 400);
    return () => window.clearTimeout(id);
  }, [song, level.link]);

  useEffect(() => () => engine.stop(), []);

  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(''), 2500);
    return () => window.clearTimeout(id);
  }, [hint]);

  const place = (layerId: string, sound: string, cell: Cell) => {
    const current = cell.figure;
    const figure: Figure = current === card ? 'rest' : card;
    if (figure === 'ta-ah' && cell.beat + 2 > beats) {
      setHint('ta-ah needs two beats. Try it on an earlier beat.');
      return;
    }
    setSong(s => setFigure(s, layerId, cell.beat, figure));
    // Ears first: when the music is stopped, hear the beat you just placed.
    if (!playing && figure !== 'rest') void engine.preview(sound, FIGURE_INFO[figure].sounds);
  };

  const addRow = (soundId: string) => {
    void engine.preview(soundId);
    setSong(s => addBeatRow(s, soundId));
    setPicking(false);
  };

  const removeRow = (layerId: string) => {
    if (confirmRemove !== layerId) {
      setConfirmRemove(layerId);
      window.setTimeout(() => setConfirmRemove(c => (c === layerId ? null : c)), 3000);
      return;
    }
    setSong(s => removeLayer(s, layerId));
    setConfirmRemove(null);
  };

  const columns = `minmax(5.5rem, 10rem) repeat(${beats}, minmax(3.5rem, 1fr)) auto`;
  const usedSounds = useMemo(() => new Set(rows.map(r => r.sound)), [rows]);

  return (
    <div className="min-h-screen bg-amber-50 text-slate-900">
      <header className="flex flex-wrap items-center gap-3 px-4 pt-4 sm:px-6">
        <span className="text-2xl font-black tracking-tight">KIDDAW</span>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-bold text-amber-50">Beat Lab</span>
        <span className="rounded-full bg-amber-200 px-3 py-1 text-sm font-bold">{level.name}</span>
        <input
          aria-label="Song name"
          value={nameDraft ?? song.name}
          onChange={e => setNameDraft(e.target.value)}
          onBlur={() => {
            if (nameDraft !== null) setSong(s => renameSong(s, nameDraft));
            setNameDraft(null);
          }}
          onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
          className="ml-auto w-48 rounded-xl border-2 border-amber-200 bg-white px-3 py-1.5 font-bold focus:border-amber-400 focus:outline-none"
        />
      </header>

      <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
        <button
          onClick={() => (playing ? engine.stop() : void engine.play())}
          className={
            'flex h-16 items-center gap-2 rounded-full px-7 text-xl font-black shadow-md transition active:scale-95 ' +
            (playing ? 'bg-slate-900 text-white' : 'bg-emerald-500 text-white hover:bg-emerald-400')
          }
        >
          {playing ? '■ Stop' : '▶ Play'}
        </button>
        <div className="flex gap-1 rounded-full bg-white p-1 shadow-sm">
          {(Object.keys(TEMPOS) as TempoName[]).map(name => (
            <button
              key={name}
              onClick={() => setSong(s => setTempo(s, TEMPOS[name]))}
              className={
                'flex items-center rounded-full px-4 py-2 font-bold transition ' + (tempoName === name ? 'bg-amber-400' : 'hover:bg-amber-100')
              }
            >
              <span className="mr-1.5">{TEMPO_LABELS[name][0]}</span>
              {TEMPO_LABELS[name][1]}
            </button>
          ))}
        </div>
      </div>

      <main className="px-4 pb-44 sm:px-6">
        <div className="overflow-x-auto rounded-3xl bg-white p-4 shadow-sm">
          <div className="grid items-center gap-2" style={{ gridTemplateColumns: columns }}>
            <div />
            {Array.from({ length: beats }, (_, b) => (
              <div
                key={b}
                className={
                  'text-center text-lg font-black transition ' + (nowBeat === b ? 'text-amber-500' : 'text-slate-300')
                }
              >
                {b + 1}
              </div>
            ))}
            <div />

            {rows.map(row => {
              const pattern = rowPattern(song, row.id);
              const cells = pattern ? readBeats(pattern) : [];
              const color = SOUND_COLORS[row.sound] ?? 'bg-slate-400';
              return (
                <Row key={row.id}>
                  <button
                    onClick={() => void engine.preview(row.sound)}
                    title="Tap to hear this sound"
                    className={'flex h-24 items-center gap-2 rounded-2xl px-3 text-left text-lg font-bold transition active:scale-95 ' + (row.muted ? 'opacity-40' : '')}
                  >
                    <span className={'h-5 w-5 shrink-0 rounded-full ' + color} />
                    <span className="leading-tight">{row.name}</span>
                  </button>

                  {cells.map(cell =>
                    cell.figure === 'held' ? null : (
                      <button
                        key={cell.beat}
                        onClick={() => place(row.id, row.sound, cell)}
                        style={cell.figure === 'ta-ah' ? { gridColumn: 'span 2' } : undefined}
                        className={
                          'flex h-24 items-center justify-center rounded-2xl border-2 transition active:scale-95 ' +
                          (cell.figure === 'rest' ? 'border-slate-200 text-slate-300 ' : 'border-slate-300 text-slate-900 ') +
                          (nowBeat === cell.beat || (cell.figure === 'ta-ah' && nowBeat === cell.beat + 1)
                            ? 'bg-amber-100 ring-4 ring-amber-300 '
                            : 'bg-white hover:bg-amber-50 ') +
                          (row.muted ? 'opacity-40' : '')
                        }
                      >
                        {cell.figure === 'other' ? (
                          <span className="text-2xl text-slate-400">• • •</span>
                        ) : (
                          <Sticks figure={cell.figure} className={cell.figure === 'ta-ah' ? 'h-20 w-full max-w-40' : 'h-20 w-full max-w-20'} />
                        )}
                      </button>
                    ),
                  )}

                  <div className="flex gap-1">
                    <button
                      onClick={() => setSong(s => toggleMute(s, row.id))}
                      title={row.muted ? 'Hear this sound again' : 'Hear the beat without this sound'}
                      className="h-12 w-10 rounded-xl text-xl hover:bg-slate-100"
                    >
                      {row.muted ? '🔇' : '🔈'}
                    </button>
                    <button
                      onClick={() => removeRow(row.id)}
                      title="Take this sound away"
                      className={
                        'h-12 rounded-xl px-2 font-bold transition ' +
                        (confirmRemove === row.id ? 'bg-rose-500 text-white' : 'text-slate-400 hover:bg-slate-100')
                      }
                    >
                      {confirmRemove === row.id ? 'Remove?' : '✕'}
                    </button>
                  </div>
                </Row>
              );
            })}
          </div>

          {rows.length === 0 && <p className="py-6 text-center text-lg font-bold text-slate-400">Add a sound to start your beat.</p>}

          <div className="mt-4">
            {rows.length < level.maxSounds ? (
              <button
                onClick={() => setPicking(p => !p)}
                className="rounded-2xl border-2 border-dashed border-slate-300 px-5 py-3 font-bold text-slate-500 hover:border-amber-400 hover:text-slate-900"
              >
                + Add a sound
              </button>
            ) : (
              <p className="text-sm font-bold text-slate-400">
                {level.name} beats use up to {level.maxSounds} sounds. Take one away to try a different one.
              </p>
            )}
          </div>

          {picking && (
            <div className="mt-3 grid gap-4 rounded-2xl bg-amber-50 p-4 sm:grid-cols-2">
              {KITS.map(kit => (
                <div key={kit.id}>
                  <h3 className="mb-2 font-black">{kit.name}</h3>
                  <div className="flex flex-wrap gap-2">
                    {soundsInKit(kit.id).map(sound => (
                      <button
                        key={sound.id}
                        onClick={() => addRow(sound.id)}
                        disabled={usedSounds.has(sound.id)}
                        className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 font-bold shadow-sm transition hover:shadow active:scale-95 disabled:opacity-30"
                      >
                        <span className={'h-4 w-4 rounded-full ' + (SOUND_COLORS[sound.id] ?? 'bg-slate-400')} />
                        {soundById(sound.id)?.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t-2 border-amber-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-black text-slate-500">Rhythm cards</span>
          {level.figures.map(f => (
            <button
              key={f}
              onClick={() => setCard(f)}
              aria-pressed={card === f}
              className={
                'flex h-24 flex-col items-center justify-center rounded-2xl border-2 px-2 transition active:scale-95 ' +
                (card === f ? 'border-amber-400 bg-amber-100 ring-4 ring-amber-200' : 'border-slate-200 bg-white hover:border-slate-300')
              }
            >
              <Sticks figure={f} className={FIGURE_INFO[f].beats === 2 ? 'h-20 w-40' : 'h-20 w-20'} />
            </button>
          ))}
          {hint && <span className="ml-2 font-bold text-rose-500">{hint}</span>}
        </div>
      </footer>
    </div>
  );
}

/** One row of the grid. Its children sit directly in the grid's columns. */
function Row({ children }: { children: ReactNode }) {
  return <div className="contents">{children}</div>;
}
