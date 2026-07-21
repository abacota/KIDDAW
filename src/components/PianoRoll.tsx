import React, { useMemo, useState } from 'react';
import { Clip, Note } from '../types';
import { cn, snapToGrid } from '../lib/utils';
import { playLiveInstrumentNote } from '../lib/audio';

const PIANO_KEYS = [
  'B5','A#5','A5','G#5','G5','F#5','F5','E5','D#5','D5','C#5','C5',
  'B4','A#4','A4','G#4','G4','F#4','F4','E4','D#4','D4','C#4','C4',
];
const LIVE_NOTES  = ['C4','D4','E4','F4','G4','A4','B4','C5'];
const SOL_NAMES   = ['Do','Re','Mi','Fa','Sol','La','Ti','Do+'];
const BLACK_KEYS  = new Set(['A#5','G#5','F#5','D#5','C#5','A#4','G#4','F#4','D#4','C#4']);

const INSTRUMENT_META: Record<string, { emoji: string; name: string; btnStyle: string; noteStyle: string }> = {
  piano:        { emoji: '🎹', name: 'Magic Piano',   btnStyle: 'bg-amber-400 text-slate-900', noteStyle: 'from-amber-400 to-yellow-300 border-amber-200 text-slate-900' },
  synth:        { emoji: '🎛️', name: 'Bubble Synth',  btnStyle: 'bg-indigo-500 text-white',   noteStyle: 'from-indigo-500 to-purple-400 border-indigo-200 text-white' },
  guitar:       { emoji: '🎸', name: 'Cozy Guitar',   btnStyle: 'bg-orange-500 text-white',   noteStyle: 'from-orange-500 to-amber-400 border-orange-200 text-white' },
  chiptune:     { emoji: '👾', name: 'Pixel Arcade',  btnStyle: 'bg-emerald-500 text-white',  noteStyle: 'from-emerald-500 to-cyan-400 border-emerald-200 text-white' },
  glockenspiel: { emoji: '🔔', name: 'Twinkle Bells', btnStyle: 'bg-pink-500 text-white',     noteStyle: 'from-pink-500 to-rose-400 border-pink-200 text-white' },
};

interface PianoRollProps {
  clip: Clip;
  onUpdateClip: (clip: Clip) => void;
  onStartUpdate: () => void;
  instrumentId: 'piano' | 'synth' | 'guitar' | 'chiptune' | 'glockenspiel';
  playbackPosition?: number;
}

const STEP = 48;
const ROW  = 32;

export const PianoRoll: React.FC<PianoRollProps> = ({
  clip, onUpdateClip, onStartUpdate, instrumentId, playbackPosition = -1,
}) => {
  const [grid, setGrid] = useState<1 | 2 | 4>(1);
  const notes = useMemo(() => (clip.notes as Note[]) || [], [clip.notes]);
  const meta  = INSTRUMENT_META[instrumentId] || INSTRUMENT_META.piano;

  const relPlayhead =
    playbackPosition >= clip.startTime && playbackPosition < clip.startTime + clip.duration
      ? playbackPosition - clip.startTime : -1;

  const play   = (pitch: string) => playLiveInstrumentNote(pitch, instrumentId);
  const update = (next: Note[]) => onUpdateClip({ ...clip, notes: next });

  const toggleNote = (pitch: string, step: number) => {
    const snapped = Math.max(0, snapToGrid(step, grid));
    const found   = notes.findIndex(n => n.pitch === pitch && n.start <= snapped && n.start + n.duration > snapped);
    onStartUpdate();
    if (found >= 0) { update(notes.filter((_, i) => i !== found)); }
    else {
      play(pitch);
      update([...notes, { id: crypto.randomUUID(), pitch, start: snapped, duration: Math.max(1, grid * 2), velocity: 0.8 }]);
    }
  };

  const startResize = (id: string, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onStartUpdate();
    const startX = e.clientX;
    const orig   = notes.find(n => n.id === id);
    if (!orig) return;
    const move = (ev: PointerEvent) => {
      const dur = Math.max(grid, Math.min(
        clip.duration - orig.start,
        snapToGrid(orig.duration + Math.round((ev.clientX - startX) / STEP), grid)
      ));
      update(notes.map(n => n.id === id ? { ...n, duration: dur } : n));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="flex flex-col bg-slate-950/40 border border-white/5 rounded-3xl overflow-hidden select-none">
      {/* Header */}
      <div className="p-4 bg-slate-900/70 border-b border-white/5 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{meta.emoji}</span>
          <div>
            <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Virtual Instrument</p>
            <h2 className="text-base font-black uppercase text-white">{meta.name}</h2>
          </div>
        </div>
        <div className="flex gap-1 bg-black/30 rounded-xl p-1">
          {([1,2,4] as const).map(size => (
            <button key={size} onClick={() => setGrid(size)}
              className={cn('min-h-[36px] px-3 rounded-lg text-[10px] font-black touch-manipulation',
                grid === size ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-white/5')}>
              {size === 1 ? 'Fine' : size === 2 ? 'Normal' : 'Wide'}
            </button>
          ))}
        </div>
      </div>

      {/* Live keyboard */}
      <div className="p-3 bg-black/30 border-b border-white/5 overflow-x-auto">
        <div className="flex gap-2 min-w-max justify-center">
          {LIVE_NOTES.map((pitch, i) => (
            <button key={pitch} onClick={() => play(pitch)}
              className="w-12 h-20 rounded-b-xl bg-white text-slate-900 border-b-4 border-slate-300
                font-black text-xs active:scale-95 touch-manipulation flex flex-col justify-end pb-1 items-center">
              <span className="text-slate-500 text-[8px]">{pitch}</span>
              <span className="text-[11px]">{SOL_NAMES[i]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex" style={{ height: 32 + PIANO_KEYS.length * ROW + 32 }}>
        {/* Key labels */}
        <div className="w-16 shrink-0 bg-slate-900 border-r border-white/10 overflow-hidden">
          <div className="h-8 bg-slate-950 border-b border-white/5" />
          {PIANO_KEYS.map(pitch => (
            <button key={pitch} onClick={() => play(pitch)}
              className={cn('h-8 w-full border-b border-black/20 pr-2 text-right text-[9px] font-black touch-manipulation',
                BLACK_KEYS.has(pitch) ? 'bg-slate-950 text-purple-400' : 'bg-slate-800 text-slate-200')}>
              {pitch}
            </button>
          ))}
        </div>

        {/* Note canvas */}
        <div className="flex-1 overflow-auto">
          <div className="relative" style={{ width: clip.duration * STEP, height: 32 + PIANO_KEYS.length * ROW }}>
            {/* Bar ruler */}
            <div className="sticky top-0 z-20 h-8 flex bg-slate-950 border-b border-white/10">
              {Array.from({ length: clip.duration }).map((_, i) => (
                <div key={i} className="h-8 border-r border-white/5 text-center text-[9px] text-slate-500 pt-2 shrink-0"
                  style={{ width: STEP }}>
                  {i % 4 === 0 ? i / 4 + 1 : ''}
                </div>
              ))}
            </div>

            {/* Row backgrounds */}
            {PIANO_KEYS.map((pitch, row) => (
              <div key={pitch}
                className={cn('absolute left-0 right-0 border-b border-white/5',
                  BLACK_KEYS.has(pitch) ? 'bg-black/10' : 'bg-white/[0.01]')}
                style={{ top: 32 + row * ROW, height: ROW }}>
                <div className="flex h-full">
                  {Array.from({ length: clip.duration }).map((_, step) => (
                    <div key={step} onClick={() => toggleNote(pitch, step)}
                      className="h-full border-r border-white/5 hover:bg-sky-500/10 touch-manipulation shrink-0"
                      style={{ width: STEP }} />
                  ))}
                </div>
              </div>
            ))}

            {/* Playhead */}
            {relPlayhead >= 0 && (
              <div className="absolute z-30 top-8 bottom-0 w-0.5 bg-sky-400 pointer-events-none"
                style={{ left: relPlayhead * STEP + STEP / 2 }} />
            )}

            {/* Notes */}
            {notes.map(note => {
              const row = PIANO_KEYS.indexOf(note.pitch);
              if (row < 0) return null;
              const vel = note.velocity ?? 0.8;
              return (
                <div key={note.id}
                  onClick={e => { e.stopPropagation(); onStartUpdate(); update(notes.filter(n => n.id !== note.id)); }}
                  className={cn('absolute z-10 rounded-lg border bg-gradient-to-r px-1 flex items-center text-[9px] font-black cursor-pointer touch-manipulation', meta.noteStyle)}
                  style={{ top: 32 + row * ROW + 2, height: ROW - 4, left: note.start * STEP, width: Math.max(STEP - 2, note.duration * STEP - 2), opacity: 0.35 + vel * 0.65 }}>
                  <span className="truncate flex-1">{note.pitch}</span>
                  <div onPointerDown={e => startResize(note.id, e)} onClick={e => e.stopPropagation()}
                    className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize bg-white/20 rounded-r-lg"
                    aria-label="Resize note" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
