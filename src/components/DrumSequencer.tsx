import React, { useMemo } from 'react';
import { Clip, DrumHit } from '../types';
import { triggerDrumSound } from '../lib/audio';
import { Music, Speaker, Play, Layers } from 'lucide-react';
import { cn } from '../lib/utils';

const DRUM_LANES = [
  { pitch: 'G1', name: 'Tom Strike', color: 'bg-purple-500 border-purple-400 text-purple-200' },    // Purple
  { pitch: 'F1', name: 'Hand Clap', color: 'bg-pink-500 border-pink-400 text-pink-200' },   // Magenta / Pink
  { pitch: 'E1', name: 'Hi-Hat Tic', color: 'bg-yellow-500 border-[#ca8a04] text-yellow-100' }, // Yellow
  { pitch: 'D1', name: 'Snare Crack', color: 'bg-cyan-500 border-cyan-400 text-cyan-100' },  // Cyan
  { pitch: 'C1', name: 'Kick Boom', color: 'bg-red-500 border-red-400 text-red-200' }    // Red (Foundation)
];

interface DrumSequencerProps {
  clip: Clip;
  onUpdateClip: (clip: Clip) => void;
  onStartUpdate: () => void;
}

export const DrumSequencer: React.FC<DrumSequencerProps> = ({
  clip,
  onUpdateClip,
  onStartUpdate
}) => {
  const TICK_WIDTH = 48; // Tick width in pixels match piano roll step width
  const durationInSixteenths = clip.duration;

  // Render trigger cells
  const drumHits = useMemo(() => {
    return (clip.notes as DrumHit[]) || [];
  }, [clip.notes]);

  const toggleDrumStep = (pitch: string, step: number) => {
    onStartUpdate();

    const existingHitIdx = drumHits.findIndex(h => h.pitch === pitch && h.start === step);

    if (existingHitIdx !== -1) {
      // Remove
      const newHits = drumHits.filter((_, i) => i !== existingHitIdx);
      onUpdateClip({ ...clip, notes: newHits });
    } else {
      // Trigger live audition sound
      triggerDrumSound(pitch);

      // Add hit
      const newHit: DrumHit = {
        id: crypto.randomUUID(),
        pitch,
        start: step,
        duration: 1
      };
      onUpdateClip({ ...clip, notes: [...drumHits, newHit] });
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/45 border border-white/5 rounded-3xl overflow-hidden font-sans select-none shadow-2xl">
      
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-950/20 to-slate-900 border-b border-indigo-500/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center text-indigo-400 text-xl font-bold">
            🥁
          </div>
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-[#818cf8]">Drum Synthesizer</span>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white uppercase">
                Kid-Friendly Drum Sequencer
              </h2>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-black">
                100% Real Time
              </span>
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-medium">
          <span className="italic">Click colorful blocks to toggle drum beats!</span>
        </div>
      </div>

      {/* Main Drum Lane Grid */}
      <div className="flex-1 overflow-auto custom-scrollbar relative flex flex-col bg-slate-950/70 h-full w-full min-h-0">
        <div className="flex flex-col h-full w-full" style={{ minWidth: `${(durationInSixteenths * TICK_WIDTH) + 120}px` }}>
          
          {DRUM_LANES.map((lane) => {
            const laneHits = drumHits.filter(h => h.pitch === lane.pitch);

            return (
              <div 
                key={lane.pitch} 
                className="flex w-full border-b border-white/5 group flex-1 min-h-[56px] transition-colors duration-200" 
              >
                {/* 1. Lane Sticky Label */}
                <div 
                  onClick={() => triggerDrumSound(lane.pitch)}
                  className="sticky left-0 w-32 shrink-0 z-20 flex items-center justify-between px-3.5 bg-slate-900 border-r border-[#0A0A0A] hover:bg-slate-800 active:scale-98 transition-all cursor-pointer select-none"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-black tracking-wide text-white uppercase">
                      {lane.name.split(' ')[0]}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                      {lane.name.split(' ')[1] || 'Sound'}
                    </span>
                  </div>
                  {/* Micro indicator color badge */}
                  <div className={cn("w-3 h-3 rounded-full border shadow-md", lane.color)} />
                </div>

                {/* 2. Step Buttons */}
                <div className="flex-1 flex bg-slate-950/30">
                  {Array.from({ length: durationInSixteenths }).map((_, stepIdx) => {
                    const isTrig = laneHits.some(h => h.start === stepIdx);
                    // Determine beat highlight border or background
                    const isBeatStart = stepIdx % 4 === 0;

                    return (
                      <div
                        key={stepIdx}
                        onClick={() => toggleDrumStep(lane.pitch, stepIdx)}
                        className={cn(
                          "h-full border-r border-white/5 cursor-pointer flex items-center justify-center transition-all p-1 relative",
                          isBeatStart ? "bg-white/[0.02]" : "hover:bg-white/[0.04]"
                        )}
                        style={{ width: `${TICK_WIDTH}px` }}
                      >
                        {/* Highlighting bar boundaries */}
                        {isBeatStart && (
                          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-slate-700/40 pointer-events-none" />
                        )}

                        {/* Interactive Beat Block */}
                        <div 
                          className={cn(
                            "w-full h-full rounded-lg transition-all duration-150 transform flex flex-col justify-between items-center py-1 border shadow-inner",
                            isTrig 
                              ? `${lane.color} scale-100 rotate-1 brightness-110 shadow-lg` 
                              : "bg-[#14151b] border-white/[0.02] hover:bg-[#1a1c24] hover:scale-[1.02] scale-95"
                          )}
                        >
                          <span className={cn(
                            "text-[8px] font-mono select-none tracking-tighter font-extrabold",
                            isTrig ? "text-white opacity-90" : "text-slate-600 opacity-30"
                          )}>
                            {stepIdx + 1}
                          </span>
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full transition-all",
                            isTrig ? "bg-white/80 animate-ping" : "bg-white/5"
                          )} />
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })}

        </div>
      </div>

    </div>
  );
};
