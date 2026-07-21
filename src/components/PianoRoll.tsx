import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clip, Note } from '../types';
import { cn } from '../lib/utils';
import { playLiveInstrumentNote } from '../lib/audio';
import { Sparkles } from 'lucide-react';

const PIANO_KEYS = [
  { pitch: 'B5', isBlack: false }, { pitch: 'A#5', isBlack: true },
  { pitch: 'A5', isBlack: false }, { pitch: 'G#5', isBlack: true },
  { pitch: 'G5', isBlack: false }, { pitch: 'F#5', isBlack: true },
  { pitch: 'F5', isBlack: false }, { pitch: 'E5', isBlack: false },
  { pitch: 'D#5', isBlack: true }, { pitch: 'D5', isBlack: false },
  { pitch: 'C#5', isBlack: true }, { pitch: 'C5', isBlack: false },
  { pitch: 'B4', isBlack: false }, { pitch: 'A#4', isBlack: true },
  { pitch: 'A4', isBlack: false }, { pitch: 'G#4', isBlack: true },
  { pitch: 'G4', isBlack: false }, { pitch: 'F#4', isBlack: true },
  { pitch: 'F4', isBlack: false }, { pitch: 'E4', isBlack: false },
  { pitch: 'D#4', isBlack: true }, { pitch: 'D4', isBlack: false },
  { pitch: 'C#4', isBlack: true }, { pitch: 'C4', isBlack: false },
];

const INTERACTIVE_NOTES = [
  { note: 'C4', color: '#ef4444', label: 'Do' },
  { note: 'D4', color: '#f97316', label: 'Re' },
  { note: 'E4', color: '#eab308', label: 'Mi' },
  { note: 'F4', color: '#22c55e', label: 'Fa' },
  { note: 'G4', color: '#06b6d4', label: 'Sol' },
  { note: 'A4', color: '#3b82f6', label: 'La' },
  { note: 'B4', color: '#8b5cf6', label: 'Ti' },
  { note: 'C5', color: '#ec4899', label: 'Do+' },
];

interface PianoRollProps {
  clip: Clip;
  onUpdateClip: (clip: Clip) => void;
  onStartUpdate: () => void;
  instrumentId: 'piano' | 'synth' | 'guitar' | 'chiptune' | 'glockenspiel';
}

export const PianoRoll: React.FC<PianoRollProps> = ({
  clip, onUpdateClip, onStartUpdate, instrumentId
}) => {
  const [activeFret, setActiveFret] = useState<number | null>(null);
  const [activeMallet, setActiveMallet] = useState<string | null>(null);
  const [synthCutoff, setSynthCutoff] = useState(50);
  const [synthResonance, setSynthResonance] = useState(30);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const STEP_WIDTH = 48;
  const ROW_HEIGHT = 32;
  const notes = useMemo(() => (clip.notes as Note[]) || [], [clip.notes]);

  // ── Play a note — safe to call from any touch/click handler ──
  const playNote = (pitch: string) => {
    playLiveInstrumentNote(pitch, instrumentId);
  };

  // ── Toggle a note cell (single tap on grid) ──
  const toggleGridCell = (pitch: string, step: number) => {
    onStartUpdate();
    const existingIndex = notes.findIndex(
      n => n.pitch === pitch && n.start <= step && n.start + n.duration > step
    );
    if (existingIndex !== -1) {
      onUpdateClip({ ...clip, notes: notes.filter((_, i) => i !== existingIndex) });
    } else {
      playNote(pitch);
      onUpdateClip({
        ...clip,
        notes: [...notes, { id: crypto.randomUUID(), pitch, start: step, duration: 2, velocity: 0.8 }]
      });
    }
  };

  const deleteNote = (noteId: string) => {
    onStartUpdate();
    onUpdateClip({ ...clip, notes: notes.filter(n => n.id !== noteId) });
  };

  return (
    <div className="flex flex-col bg-slate-950/40 border border-white/5 rounded-3xl font-sans select-none">

      {/* ── Instrument header ── */}
      <div className={cn(
        'p-4 flex items-center gap-3 border-b',
        instrumentId === 'piano' && 'bg-gradient-to-r from-amber-950/20 to-slate-900 border-amber-500/10',
        instrumentId === 'synth' && 'bg-gradient-to-r from-purple-950/20 to-slate-900 border-purple-500/10',
        instrumentId === 'guitar' && 'bg-gradient-to-r from-orange-950/20 to-slate-900 border-orange-500/10',
        instrumentId === 'chiptune' && 'bg-gradient-to-r from-cyan-950/20 to-slate-900 border-cyan-500/10',
        instrumentId === 'glockenspiel' && 'bg-gradient-to-r from-pink-950/20 to-slate-900 border-pink-500/10',
      )}>
        <div className={cn(
          'w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border shrink-0',
          instrumentId === 'piano' && 'bg-amber-800/20 border-amber-500/20',
          instrumentId === 'synth' && 'bg-purple-800/20 border-purple-500/20',
          instrumentId === 'guitar' && 'bg-orange-800/20 border-orange-500/20',
          instrumentId === 'chiptune' && 'bg-cyan-800/20 border-cyan-500/20',
          instrumentId === 'glockenspiel' && 'bg-pink-800/20 border-pink-500/20',
        )}>
          {instrumentId === 'piano' && '🎹'}
          {instrumentId === 'synth' && '🎛️'}
          {instrumentId === 'guitar' && '🎸'}
          {instrumentId === 'chiptune' && '👾'}
          {instrumentId === 'glockenspiel' && '🔔'}
        </div>
        <div>
          <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Virtual Instrument</span>
          <h2 className="text-base font-black tracking-tight text-white uppercase">
            {instrumentId === 'piano' && 'Vintage Wooden Piano'}
            {instrumentId === 'synth' && 'Neon Bubble Synth'}
            {instrumentId === 'guitar' && 'Cozy Acoustic Plucker'}
            {instrumentId === 'chiptune' && 'Pixel Chiptune Arcade'}
            {instrumentId === 'glockenspiel' && 'Magic Toy Glockenspiel'}
          </h2>
          <span className="text-[10px] text-slate-400">Tap keys to play · Tap grid to add notes</span>
        </div>
      </div>

      {/* ── Interactive instrument (touch-friendly keys/pads) ── */}
      <div className="p-3 bg-black/40 border-b border-white/5 shrink-0">
        <AnimatePresence mode="wait">

          {/* PIANO */}
          {instrumentId === 'piano' && (
            <motion.div key="piano" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex justify-center p-3 bg-slate-900 border-b-8 border-amber-900 rounded-2xl shadow-2xl overflow-x-auto"
            >
              <div className="flex gap-1.5 mt-2">
                {INTERACTIVE_NOTES.map((k) => (
                  <button
                    key={k.note}
                    onTouchEnd={(e) => { e.preventDefault(); playNote(k.note); }}
                    onClick={() => playNote(k.note)}
                    className="w-12 h-28 sm:w-14 sm:h-32 bg-gradient-to-b from-white to-slate-200 text-slate-900 rounded-b-xl flex flex-col justify-end items-center pb-2 font-black text-xs shadow-xl active:scale-95 transition-all touch-manipulation"
                  >
                    <span className="text-slate-400 text-[9px]">{k.note}</span>
                    <span className="text-indigo-600 uppercase text-xs">{k.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* SYNTH */}
          {instrumentId === 'synth' && (
            <motion.div key="synth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-4 bg-[#120024] border-t-4 border-purple-500 rounded-2xl flex flex-col gap-4 shadow-2xl"
            >
              <div className="flex gap-4 justify-around">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black uppercase text-purple-400 mb-2">Cutoff</span>
                  <input type="range" min="10" max="100" value={synthCutoff} onChange={(e) => setSynthCutoff(Number(e.target.value))} className="w-24 accent-purple-500" />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black uppercase text-purple-400 mb-2">Reso</span>
                  <input type="range" min="5" max="95" value={synthResonance} onChange={(e) => setSynthResonance(Number(e.target.value))} className="w-24 accent-purple-500" />
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {INTERACTIVE_NOTES.map((k) => (
                  <button
                    key={k.note}
                    onTouchEnd={(e) => { e.preventDefault(); playNote(k.note); }}
                    onClick={() => playNote(k.note)}
                    className="flex-1 min-w-[50px] h-20 bg-gradient-to-br from-purple-900 to-indigo-950 border-2 border-purple-400/30 rounded-xl flex flex-col items-center justify-center text-xs font-black active:scale-95 text-purple-200 touch-manipulation"
                  >
                    <span className="text-[10px] text-purple-400">{k.note}</span>
                    <span className="text-white text-[13px] font-mono uppercase mt-1">{k.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* GUITAR */}
          {instrumentId === 'guitar' && (
            <motion.div key="guitar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-4 bg-[#23120b] border-2 border-[#542d18] rounded-2xl shadow-2xl"
            >
              <div className="flex flex-col gap-4">
                {['E4','G4','A4','C5','D5','E5'].map((note, i) => (
                  <button
                    key={i}
                    onTouchEnd={(e) => { e.preventDefault(); playNote(note); setActiveFret(i); setTimeout(() => setActiveFret(null), 150); }}
                    onClick={() => { playNote(note); setActiveFret(i); setTimeout(() => setActiveFret(null), 150); }}
                    className={cn(
                      'w-full h-12 bg-gradient-to-r from-amber-900/40 to-black/60 rounded-xl border border-amber-900/30 flex items-center justify-between px-4 text-amber-400 font-black text-sm active:scale-95 transition-all touch-manipulation',
                      activeFret === i && 'brightness-150'
                    )}
                  >
                    <span className="text-xs font-mono">{note}</span>
                    <div className="flex-1 mx-4 h-0.5 bg-gradient-to-r from-slate-400 to-slate-200" />
                    <span className="text-[9px] font-bold text-orange-200 bg-amber-950 px-2 py-1 rounded-full">PLUCK</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* CHIPTUNE */}
          {instrumentId === 'chiptune' && (
            <motion.div key="chip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-4 bg-[#0a1811] border-2 border-emerald-500/30 rounded-2xl shadow-2xl"
            >
              <div className="grid grid-cols-4 gap-2">
                {INTERACTIVE_NOTES.map((k) => (
                  <button
                    key={k.note}
                    onTouchEnd={(e) => { e.preventDefault(); playNote(k.note); }}
                    onClick={() => playNote(k.note)}
                    className="h-16 rounded-xl border-b-4 border-emerald-800 bg-[#0f2115] border-2 border-emerald-500/40 text-emerald-400 font-mono text-xs font-black flex flex-col justify-center items-center gap-1 active:scale-95 touch-manipulation"
                  >
                    <span className="uppercase">{k.label}</span>
                    <span className="text-[8px] opacity-50">{k.note}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* GLOCKENSPIEL */}
          {instrumentId === 'glockenspiel' && (
            <motion.div key="bell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-4 bg-[#1a0f19] border-t-4 border-pink-500 rounded-2xl shadow-2xl"
            >
              <div className="flex justify-center items-end gap-1.5 h-32 px-2 overflow-x-auto">
                {INTERACTIVE_NOTES.map((k, index) => (
                  <button
                    key={k.note}
                    onTouchEnd={(e) => { e.preventDefault(); playNote(k.note); setActiveMallet(k.note); setTimeout(() => setActiveMallet(null), 150); }}
                    onClick={() => { playNote(k.note); setActiveMallet(k.note); setTimeout(() => setActiveMallet(null), 150); }}
                    className={cn(
                      'min-w-[44px] flex-1 rounded-t-lg border-2 flex flex-col justify-between items-center py-2 active:scale-95 transition-all touch-manipulation',
                      activeMallet === k.note && 'translate-y-1 brightness-150'
                    )}
                    style={{
                      height: `${100 - index * 6}%`,
                      backgroundColor: k.color + '20',
                      borderColor: k.color,
                    }}
                  >
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="text-white text-[10px] font-black uppercase">{k.label}</span>
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── MIDI grid (horizontally scrollable, not scroll-trapping) ── */}
      <div className="flex" style={{ height: '320px' }}>

        {/* Key labels column */}
        <div className="w-16 shrink-0 bg-slate-900 border-r border-white/10 overflow-hidden flex flex-col">
          <div className="h-8 bg-slate-950 border-b border-white/10 shrink-0 flex items-center justify-center">
            <span className="text-[8px] font-black uppercase text-slate-500">Keys</span>
          </div>
          <div className="overflow-hidden flex-1">
            {PIANO_KEYS.map((key) => (
              <button
                key={key.pitch}
                onTouchEnd={(e) => { e.preventDefault(); playNote(key.pitch); }}
                onClick={() => playNote(key.pitch)}
                className={cn(
                  'h-8 w-full border-b border-black/20 flex items-center justify-end pr-2 text-[9px] font-black uppercase transition-colors cursor-pointer touch-manipulation shrink-0',
                  key.isBlack ? 'bg-slate-950 text-purple-400' : 'bg-slate-800 text-slate-200'
                )}
              >
                {key.pitch}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto" ref={gridContainerRef}>
          {/* Ruler */}
          <div className="h-8 bg-slate-950 border-b border-white/10 flex sticky top-0 z-10" style={{ width: `${clip.duration * STEP_WIDTH}px` }}>
            {Array.from({ length: clip.duration }).map((_, i) => (
              <div key={i} className={cn('h-full border-r border-white/5 flex items-center justify-center font-mono text-[9px] text-slate-500', i % 4 === 0 && 'text-indigo-400')} style={{ width: STEP_WIDTH }}>
                {i % 4 === 0 ? `${i / 4 + 1}` : `.${i % 4}`}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="relative" style={{ width: `${clip.duration * STEP_WIDTH}px`, height: `${PIANO_KEYS.length * ROW_HEIGHT}px` }}>
            {PIANO_KEYS.map((key, rowIdx) => (
              <div
                key={key.pitch}
                className={cn('h-8 border-b border-white/5 flex absolute left-0 right-0', key.isBlack ? 'bg-black/10' : 'bg-white/[0.01]')}
                style={{ top: rowIdx * ROW_HEIGHT }}
              >
                {Array.from({ length: clip.duration }).map((_, stepIdx) => (
                  <div
                    key={stepIdx}
                    onClick={() => toggleGridCell(key.pitch, stepIdx)}
                    className="h-full border-r border-white/5 cursor-pointer hover:bg-indigo-500/10 active:bg-indigo-500/20 transition-all touch-manipulation"
                    style={{ width: STEP_WIDTH }}
                  />
                ))}
              </div>
            ))}

            {/* Notes */}
            {notes.map((note) => {
              const rowIdx = PIANO_KEYS.findIndex(k => k.pitch === note.pitch);
              if (rowIdx === -1) return null;
              return (
                <div
                  key={note.id}
                  className={cn(
                    'absolute h-[28px] rounded-lg mt-[2px] flex items-center px-2 font-black text-[9px] border shadow-lg cursor-pointer z-10 touch-manipulation',
                    instrumentId === 'piano' && 'bg-gradient-to-r from-amber-600 to-amber-500 border-amber-300 text-slate-950',
                    instrumentId === 'synth' && 'bg-gradient-to-r from-purple-600 to-indigo-500 border-purple-300 text-white',
                    instrumentId === 'guitar' && 'bg-gradient-to-r from-orange-600 to-amber-500 border-orange-300 text-slate-950',
                    instrumentId === 'chiptune' && 'bg-gradient-to-r from-cyan-600 to-emerald-500 border-cyan-300 text-slate-950',
                    instrumentId === 'glockenspiel' && 'bg-gradient-to-r from-pink-600 to-pink-400 border-pink-300 text-white',
                  )}
                  style={{ top: rowIdx * ROW_HEIGHT, left: note.start * STEP_WIDTH, width: note.duration * STEP_WIDTH }}
                  onClick={() => deleteNote(note.id)}
                >
                  <span className="truncate uppercase text-[8px]">{note.pitch}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
};
