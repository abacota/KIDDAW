import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clip, Note } from '../types';
import { cn, snapToGrid } from '../lib/utils';
import { playLiveInstrumentNote } from '../lib/audio';
import { Sparkles, Sliders, Music, Zap, Layers, Flame } from 'lucide-react';

const PIANO_KEYS = [
  { pitch: 'B5', isBlack: false, label: 'B5' },
  { pitch: 'A#5', isBlack: true, label: 'A#5' },
  { pitch: 'A5', isBlack: false, label: 'A5' },
  { pitch: 'G#5', isBlack: true, label: 'G#5' },
  { pitch: 'G5', isBlack: false, label: 'G5' },
  { pitch: 'F#5', isBlack: true, label: 'F#5' },
  { pitch: 'F5', isBlack: false, label: 'F5' },
  { pitch: 'E5', isBlack: false, label: 'E5' },
  { pitch: 'D#5', isBlack: true, label: 'D#5' },
  { pitch: 'D5', isBlack: false, label: 'D5' },
  { pitch: 'C#5', isBlack: true, label: 'C#5' },
  { pitch: 'C5', isBlack: false, label: 'C5' },
  { pitch: 'B4', isBlack: false, label: 'B4' },
  { pitch: 'A#4', isBlack: true, label: 'A#4' },
  { pitch: 'A4', isBlack: false, label: 'A4' },
  { pitch: 'G#4', isBlack: true, label: 'G#4' },
  { pitch: 'G4', isBlack: false, label: 'G4' },
  { pitch: 'F#4', isBlack: true, label: 'F#4' },
  { pitch: 'F4', isBlack: false, label: 'F4' },
  { pitch: 'E4', isBlack: false, label: 'E4' },
  { pitch: 'D#4', isBlack: true, label: 'D#4' },
  { pitch: 'D4', isBlack: false, label: 'D4' },
  { pitch: 'C#4', isBlack: true, label: 'C#4' },
  { pitch: 'C4', isBlack: false, label: 'C4 (Middle C)' }
];

// Beginner interactive playing layouts
const INTERACTIVE_NOTES = [
  { note: 'C4', color: '#ef4444', label: 'Do' },
  { note: 'D4', color: '#f97316', label: 'Re' },
  { note: 'E4', color: '#eab308', label: 'Mi' },
  { note: 'F4', color: '#22c55e', label: 'Fa' },
  { note: 'G4', color: '#06b6d4', label: 'Sol' },
  { note: 'A4', color: '#3b82f6', label: 'La' },
  { note: 'B4', color: '#8b5cf6', label: 'Ti' },
  { note: 'C5', color: '#ec4899', label: 'Do⁺' }
];

interface PianoRollProps {
  clip: Clip;
  onUpdateClip: (clip: Clip) => void;
  onStartUpdate: () => void;
  instrumentId: 'piano' | 'synth' | 'guitar' | 'chiptune' | 'glockenspiel';
}

export const PianoRoll: React.FC<PianoRollProps> = ({
  clip,
  onUpdateClip,
  onStartUpdate,
  instrumentId
}) => {
  const [activeFret, setActiveFret] = useState<number | null>(null);
  const [activeMallet, setActiveMallet] = useState<string | null>(null);
  const [synthCutoff, setSynthCutoff] = useState(50);
  const [synthResonance, setSynthResonance] = useState(30);

  const gridContainerRef = useRef<HTMLDivElement>(null);

  const STEP_WIDTH = 48; // Width in px for 1 sixteenth note
  const ROW_HEIGHT = 32; // Height in px for 1 pitch row

  const durationInSixteenths = clip.duration;

  // Active notes mapping
  const notes = useMemo(() => {
    return (clip.notes as Note[]) || [];
  }, [clip.notes]);

  // Handle drawing a note
  const toggleGridCell = (pitch: string, step: number) => {
    onStartUpdate();
    
    // Check if there is already a note at this pitch and step
    const existingIndex = notes.findIndex(n => n.pitch === pitch && n.start <= step && (n.start + n.duration) > step);

    if (existingIndex !== -1) {
      // Remove it
      const newNotes = notes.filter((_, idx) => idx !== existingIndex);
      onUpdateClip({ ...clip, notes: newNotes });
    } else {
      // Preview live sound on click
      playLiveInstrumentNote(pitch, instrumentId);
      
      // Add a fresh note (default length: 2 sixteenths)
      const newNote: Note = {
        id: crypto.randomUUID(),
        pitch,
        start: step,
        duration: 2,
        velocity: 0.8
      };
      
      onUpdateClip({ ...clip, notes: [...notes, newNote] });
    }
  };

  const deleteNote = (noteId: string) => {
    onStartUpdate();
    onUpdateClip({
      ...clip,
      notes: notes.filter(n => n.id !== noteId)
    });
  };

  const handleInteractiveKeyClick = (pitch: string) => {
    playLiveInstrumentNote(pitch, instrumentId);

    // Record note dynamically into clip at first available slot if desired or play live
    // Simple live play for interactive feedback
    if (gridContainerRef.current) {
      // Optional: highlight a ripple or flash!
    }
  };

  // Dragging states for note resize
  const [resizingNote, setResizingNote] = useState<{ id: string; startWidth: number; startX: number } | null>(null);

  const startNoteResize = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingNote({
      id: note.id,
      startWidth: note.duration * STEP_WIDTH,
      startX: e.clientX
    });
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingNote) {
        const deltaX = moveEvent.clientX - e.clientX;
        const newWidth = Math.max(STEP_WIDTH, note.duration * STEP_WIDTH + deltaX);
        const newDuration = Math.max(1, Math.round(newWidth / STEP_WIDTH));
        
        onUpdateClip({
          ...clip,
          notes: notes.map(n => n.id === note.id ? { ...n, duration: newDuration } : n)
        });
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setResizingNote(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/40 border border-white/5 rounded-3xl overflow-hidden font-sans select-none">
      
      {/* 1. Header with Visual Instrument Representation */}
      <div className={cn(
        "p-4 flex items-center justify-between border-b transition-all duration-500",
        instrumentId === 'piano' && "bg-gradient-to-r from-amber-950/20 to-slate-900 border-amber-505/10",
        instrumentId === 'synth' && "bg-gradient-to-r from-purple-950/20 to-slate-900 border-purple-500/10",
        instrumentId === 'guitar' && "bg-gradient-to-r from-orange-950/20 to-slate-900 border-orange-500/10",
        instrumentId === 'chiptune' && "bg-gradient-to-r from-cyan-950/20 to-slate-900 border-cyan-500/10",
        instrumentId === 'glockenspiel' && "bg-gradient-to-r from-pink-950/20 to-slate-900 border-pink-500/10"
      )}>
        <div className="flex items-center gap-3">
          {/* Visual Badge of Selected Instrument */}
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner border",
            instrumentId === 'piano' && "bg-amber-800/20 text-amber-300 border-amber-500/20",
            instrumentId === 'synth' && "bg-purple-800/20 text-purple-300 border-purple-500/20",
            instrumentId === 'guitar' && "bg-orange-800/20 text-orange-300 border-orange-500/20",
            instrumentId === 'chiptune' && "bg-cyan-800/20 text-cyan-300 border-cyan-500/20",
            instrumentId === 'glockenspiel' && "bg-pink-800/20 text-pink-300 border-pink-500/20"
          )}>
            {instrumentId === 'piano' && '🎹'}
            {instrumentId === 'synth' && '🎛️'}
            {instrumentId === 'guitar' && '🎸'}
            {instrumentId === 'chiptune' && '👾'}
            {instrumentId === 'glockenspiel' && '🔔'}
          </div>
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Virtual Instrument</span>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-white uppercase sm:text-xl">
                {instrumentId === 'piano' && 'Vintage Wooden Piano'}
                {instrumentId === 'synth' && 'Neon Bubble Synth'}
                {instrumentId === 'guitar' && 'Cozy Acoustic Plucker'}
                {instrumentId === 'chiptune' && 'Pixel Chiptune Arcade'}
                {instrumentId === 'glockenspiel' && 'Magic Toy Glockenspiel'}
              </h2>
              <span className="text-xs font-mono text-slate-400 font-bold px-2 py-0.5 bg-black/40 rounded-full">
                Beginner Friendly
              </span>
            </div>
          </div>
        </div>

        {/* Informative details */}
        <div className="hidden md:flex items-center gap-4 text-xs">
          <span className="text-slate-400 font-sans italic">
            Double click cell to add note &bull; Click again to erase
          </span>
        </div>
      </div>

      {/* 2. Interactive Tactile Instrument Interface (Top Level Playing Field) */}
      <div className="p-3 bg-black/40 border-b border-white/5 relative shrink-0">
        <AnimatePresence mode="wait">
          
          {/* PIANO INTERFACE */}
          {instrumentId === 'piano' && (
            <motion.div 
              key="piano_joy"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex justify-center flex-wrap p-3 bg-slate-900 border-b-8 border-amber-900 rounded-2xl relative shadow-2xl saturate-125"
            >
              <div className="absolute top-1 left-4 right-4 flex justify-between text-[10px] font-black tracking-widest text-[#d97706]/40 uppercase pointer-events-none select-none">
                <span>Ivory Grand Concert Model</span>
                <span>KIDDAW Polyphony</span>
              </div>
              <div className="flex gap-1.5 mt-4">
                {INTERACTIVE_NOTES.map((k) => (
                  <button
                    key={k.note}
                    onClick={() => handleInteractiveKeyClick(k.note)}
                    className="w-14 h-32 bg-gradient-to-b from-white to-slate-200 hover:to-white text-slate-900 rounded-b-xl flex flex-col justify-end items-center pb-3 font-black text-xs shadow-xl active:scale-95 transition-all outline-none border-t border-slate-300 relative group"
                  >
                    {/* Key top shadows */}
                    <div className="absolute top-0 inset-x-0 h-1 bg-black/10 rounded-t-xl group-hover:h-0 transition-all" />
                    {/* Black key overlap markers */}
                    {['C4', 'D4', 'F4', 'G4', 'A4'].includes(k.note) && (
                      <div className="absolute top-0 right-0 w-3 h-16 bg-black rounded-bl-md shadow-md transform translate-x-1.5 z-10" />
                    )}
                    <span className="text-slate-400 text-[10px] font-black">{k.note}</span>
                    <span className="text-indigo-600 uppercase text-xs tracking-tighter">{k.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* RETRO SYNTH INTERFACE */}
          {instrumentId === 'synth' && (
            <motion.div 
              key="synth_joy"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-[#120024] border-t-4 border-purple-500 rounded-2xl flex flex-col md:flex-row items-center gap-6 shadow-2xl relative"
            >
              {/* Retro Control Panel */}
              <div className="flex gap-4 p-3 bg-black/50 border border-purple-500/20 rounded-xl w-full md:w-auto self-stretch justify-around">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider mb-2">Cutoff</span>
                  <input 
                    type="range" min="10" max="100" value={synthCutoff}
                    onChange={(e) => setSynthCutoff(Number(e.target.value))}
                    className="w-20 h-1 accent-purple-500"
                  />
                  <span className="text-[10px] font-mono text-purple-200 mt-1">{synthCutoff}%</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider mb-2">Reso</span>
                  <input 
                    type="range" min="5" max="95" value={synthResonance}
                    onChange={(e) => setSynthResonance(Number(e.target.value))}
                    className="w-20 h-1 accent-purple-500"
                  />
                  <span className="text-[10px] font-mono text-purple-200 mt-1">{synthResonance}%</span>
                </div>
              </div>

              {/* Glowing Keypad Row */}
              <div className="flex flex-1 gap-2 overflow-x-auto w-full py-1">
                {INTERACTIVE_NOTES.map((k) => (
                  <button
                    key={k.note}
                    onClick={() => handleInteractiveKeyClick(k.note)}
                    className="flex-1 min-w-[50px] h-20 bg-gradient-to-br from-purple-900 to-indigo-950 border-2 border-purple-400/30 hover:border-purple-400 rounded-xl flex flex-col items-center justify-center hover:bg-purple-800 transition-all text-xs font-black shadow-lg shadow-purple-500/5 active:scale-95 text-purple-200"
                    style={{
                      boxShadow: `0 0 15px rgba(168, 85, 247, 0.1)`
                    }}
                  >
                    <span className="text-[10px] text-purple-400 font-bold">{k.note}</span>
                    <span className="text-white text-[13px] font-mono uppercase mt-2">{k.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ACOUSTIC GUITAR INTERFACE */}
          {instrumentId === 'guitar' && (
            <motion.div 
              key="guitar_joy"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-[#23120b] border-2 border-[#542d18] rounded-2xl shadow-2xl relative flex flex-col md:flex-row items-center justify-between"
            >
              {/* Mahogany Wood Grain & Strings */}
              <div className="flex-1 w-full max-w-lg flex flex-col gap-3.5 relative py-4 bg-gradient-to-r from-amber-900/40 via-amber-950/20 to-black/60 rounded-xl border border-amber-900/30 px-3 overflow-hidden">
                {/* Visual Fret Lines */}
                <div className="absolute inset-y-0 left-12 border-l border-amber-750/50 pointer-events-none" />
                <div className="absolute inset-y-0 left-28 border-l border-amber-700/50 pointer-events-none" />
                <div className="absolute inset-y-0 left-44 border-l border-amber-700/50 pointer-events-none" />
                <div className="absolute inset-y-0 left-64 border-l border-amber-700/50 pointer-events-none" />
                
                {/* Interactive Guitar Strings! */}
                {Array.from({ length: 6 }).map((_, stringIdx) => {
                  const relativeNotes = ['E4', 'G4', 'A4', 'C5', 'D5', 'E5'];
                  const stringNote = relativeNotes[stringIdx] || 'C4';
                  const thickness = 1 + (stringIdx * 0.5);

                  return (
                    <div 
                      key={stringIdx} 
                      onClick={() => {
                        handleInteractiveKeyClick(stringNote);
                        setActiveFret(stringIdx);
                        setTimeout(() => setActiveFret(null), 150);
                      }}
                      className="group flex items-center justify-between h-5 relative cursor-pointer"
                    >
                      <span className="text-[9px] font-black text-amber-500 font-mono w-4">{stringNote}</span>
                      
                      {/* String Visual Line */}
                      <div 
                        className={cn(
                          "absolute left-6 right-6 bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400 shadow-md group-hover:brightness-150 transition-all",
                          activeFret === stringIdx ? "animate-bounce h-1 brightness-200" : ""
                        )}
                        style={{ height: `${thickness}px` }} 
                      />
                      
                      {/* Right Peg label */}
                      <div className="w-12 h-4 bg-amber-950 hover:bg-orange-950 border border-amber-900/30 rounded-full flex items-center justify-center z-10 relative">
                        <span className="text-[8px] font-bold text-orange-200">PLUCK</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hidden md:block w-36 px-4 py-8 bg-gradient-to-br from-[#1c0d08] to-black rounded-xl border border-amber-900/10 text-center shrink-0">
                <span className="text-xl">🎸</span>
                <p className="text-[10px] font-bold text-amber-500/70 uppercase tracking-widest mt-2">Pluck Strings</p>
                <p className="text-[8px] text-slate-400 mt-1 capitalize">Click lines to strum standard chords</p>
              </div>
            </motion.div>
          )}

          {/* CHIPTUNE INTERFACE */}
          {instrumentId === 'chiptune' && (
            <motion.div 
              key="chip_joy"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-[#0a1811] border-2 border-emerald-500/30 rounded-2xl flex flex-col items-center gap-4 shadow-2xl relative select-none"
            >
              <div className="flex items-center gap-1.5 font-mono text-[9px] text-emerald-400 tracking-widest uppercase">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Pixel Chiptune Controller Ready</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 w-full">
                {INTERACTIVE_NOTES.map((k) => (
                  <button
                    key={k.note}
                    onClick={() => handleInteractiveKeyClick(k.note)}
                    className="h-16 rounded-xl border-b-4 border-emerald-800 bg-[#0f2115] hover:bg-emerald-900 border-2 border-emerald-500/40 text-emerald-400 hover:text-emerald-300 font-mono text-xs font-black uppercase flex flex-col justify-center items-center gap-2 active:scale-95 active:border-b transition-all"
                  >
                    <span className="text-xs uppercase">{k.label}</span>
                    <span className="text-[8px] font-bold opacity-50 px-1 py-0.5 bg-black/40 rounded-md">{k.note}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* GLOCKENSPIEL INTERFACE */}
          {instrumentId === 'glockenspiel' && (
            <motion.div 
              key="bell_joy"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-[#1a0f19] border-t-4 border-pink-500 rounded-2xl shadow-2xl relative"
            >
              <div className="flex justify-center items-end gap-1.5 h-36 border-b-4 border-pink-900/30 px-4">
                {INTERACTIVE_NOTES.map((k, index) => {
                  // Make keys taper down in height like a real Glockenspiel!
                  const heightPercentage = 100 - (index * 6); // C4 is tall, C5 is shorter

                  return (
                    <button
                      key={k.note}
                      onClick={() => {
                        handleInteractiveKeyClick(k.note);
                        setActiveMallet(k.note);
                        setTimeout(() => setActiveMallet(null), 150);
                      }}
                      className={cn(
                        "w-12 bg-gradient-to-b border-2 text-white font-black text-xs hover:brightness-125 hover:-translate-y-1 rounded-t-lg shadow-xl outline-none flex flex-col justify-between items-center py-2 transition-all cursor-pointer",
                        activeMallet === k.note ? "translate-y-2 scale-95 brightness-150 rotate-1" : ""
                      )}
                      style={{
                        height: `${heightPercentage}%`,
                        backgroundColor: k.color + '20', // transparent color
                        borderColor: k.color,
                        boxShadow: `inset 0 0 10px ${k.color}30, 0 8px 12px rgba(0,0,0,0.4)`
                      }}
                    >
                      {/* Metal rivet markers top/bottom */}
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-300 border border-slate-500 shadow-inner" />
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-100 uppercase">{k.label}</span>
                        <span className="text-[8px] opacity-60 font-mono mt-0.5">{k.note}</span>
                      </div>
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-300 border border-slate-500 shadow-inner" />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. MIDI Notes Sequencer Table */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Side: Keys labels (Ruler Column) */}
        <div className="w-20 shrink-0 bg-slate-900 border-r border-white/10 z-20 overflow-hidden flex flex-col">
          {/* Header spacer */}
          <div className="h-8 bg-slate-950 border-b border-white/10 shrink-0 flex items-center justify-center">
            <span className="text-[8px] font-black uppercase text-slate-500 tracking-tighter">Keys</span>
          </div>
          
          {/* Pitch labels list */}
          <div className="flex-1 overflow-hidden" style={{ height: `calc(100% - 32px)` }}>
            {PIANO_KEYS.map((key) => (
              <div 
                key={key.pitch}
                onClick={() => playLiveInstrumentNote(key.pitch, instrumentId)}
                className={cn(
                  "h-8 border-b border-black/20 flex items-center justify-end pr-2.5 text-[9px] font-black uppercase transition-colors cursor-pointer shrink-0",
                  key.isBlack 
                    ? "bg-slate-950 text-purple-400 hover:bg-slate-900" 
                    : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                )}
              >
                <span>{key.label}</span>
                {key.isBlack && <div className="w-2 h-2 rounded-full bg-purple-500 ml-1 shadow-glow" />}
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Scrollable Sequencer Cells */}
        <div className="flex-1 overflow-auto custom-scrollbar relative flex flex-col bg-slate-950/70" ref={gridContainerRef}>
          {/* Grid ruler */}
          <div className="h-8 bg-slate-950 border-b border-white/10 flex sticky top-0 z-10 shrink-0" style={{ width: `${durationInSixteenths * STEP_WIDTH}px` }}>
            {Array.from({ length: durationInSixteenths }).map((_, stepIdx) => (
              <div 
                key={stepIdx}
                className={cn(
                  "h-full border-r border-white/5 flex items-center justify-center font-mono text-[9px] font-bold text-slate-500 select-none pointer-events-none",
                  stepIdx % 4 === 0 ? "text-indigo-400" : ""
                )}
                style={{ width: `${STEP_WIDTH}px` }}
              >
                {stepIdx % 4 === 0 ? `${(stepIdx / 4) + 1}` : `.${stepIdx % 4}`}
              </div>
            ))}
          </div>

          {/* Grid rows mapping */}
          <div className="relative flex-1 shrink-0" style={{ width: `${durationInSixteenths * STEP_WIDTH}px`, height: `${PIANO_KEYS.length * ROW_HEIGHT}px` }}>
            
            {/* Draw Pitch Grid Rows */}
            {PIANO_KEYS.map((key, rowIdx) => (
              <div 
                key={key.pitch}
                className={cn(
                  "h-8 border-b border-white/5 flex relative absolute left-0 right-0",
                  key.isBlack ? "bg-black/10" : "bg-white/[0.01]"
                )}
                style={{ top: `${rowIdx * ROW_HEIGHT}px` }}
              >
                {/* Visual grid cell ticks */}
                {Array.from({ length: durationInSixteenths }).map((_, stepIdx) => (
                  <div 
                    key={stepIdx}
                    onDoubleClick={() => toggleGridCell(key.pitch, stepIdx)}
                    className={cn(
                      "h-full border-r border-white/5 cursor-pointer hover:bg-indigo-500/10 active:bg-indigo-500/20 transition-all",
                      stepIdx % 4 === 0 ? "border-r-slate-700/50" : ""
                    )}
                    style={{ width: `${STEP_WIDTH}px` }}
                  />
                ))}
              </div>
            ))}

            {/* Render Placed Notes */}
            {notes.map((note) => {
              const matchedKeyIdx = PIANO_KEYS.findIndex(pk => pk.pitch === note.pitch);
              if (matchedKeyIdx === -1) return null;

              const noteTop = matchedKeyIdx * ROW_HEIGHT;
              const noteLeft = note.start * STEP_WIDTH;
              const noteWidth = note.duration * STEP_WIDTH;

              return (
                <div
                  key={note.id}
                  className={cn(
                    "absolute h-[28px] rounded-lg mt-[2px] flex items-center justify-between px-2 font-black text-[9px] tracking-tight border shadow-lg cursor-pointer group select-none transition-shadow z-10",
                    instrumentId === 'piano' && "bg-gradient-to-r from-amber-600 to-amber-500 border-amber-300 text-slate-950",
                    instrumentId === 'synth' && "bg-gradient-to-r from-purple-600 to-indigo-500 border-purple-300 text-white shadow-purple-500/10",
                    instrumentId === 'guitar' && "bg-gradient-to-r from-orange-600 to-amber-500 border-orange-300 text-slate-950",
                    instrumentId === 'chiptune' && "bg-gradient-to-r from-cyan-600 to-emerald-500 border-cyan-300 text-slate-950",
                    instrumentId === 'glockenspiel' && "bg-gradient-to-r from-pink-600 to-pink-400 border-pink-300 text-white"
                  )}
                  style={{
                    top: `${noteTop}px`,
                    left: `${noteLeft}px`,
                    width: `${noteWidth}px`
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    deleteNote(note.id);
                  }}
                >
                  <span className="truncate pr-1 uppercase text-[8px] font-black">
                    {note.pitch}
                  </span>
                  
                  {/* Small resize slider visual */}
                  <div 
                    onMouseDown={(e) => startNoteResize(e, note)}
                    className="w-1.5 h-full bg-black/20 hover:bg-black/40 rounded-r-lg cursor-ew-resize absolute right-0 top-0 bottom-0 transition-colors shrink-0" 
                    title="Drag to resize note length"
                  />
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
