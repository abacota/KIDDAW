import React, { useMemo } from 'react';
import { Clip, DrumHit } from '../types';
import { triggerDrumSound } from '../lib/audio';
import { cn } from '../lib/utils';

const DRUM_LANES = [
  { pitch: 'G1', name: 'Tom Strike',  color: 'bg-purple-500 border-purple-400 text-purple-200' },
  { pitch: 'F1', name: 'Hand Clap',   color: 'bg-pink-500   border-pink-400   text-pink-200'   },
  { pitch: 'E1', name: 'Hi-Hat Tic',  color: 'bg-yellow-500 border-yellow-600  text-yellow-100' },
  { pitch: 'D1', name: 'Snare Crack', color: 'bg-cyan-500   border-cyan-400    text-cyan-100'   },
  { pitch: 'C1', name: 'Kick Boom',   color: 'bg-red-500    border-red-400     text-red-200'    },
];

interface DrumSequencerProps {
  clip: Clip;
  onUpdateClip: (clip: Clip) => void;
  onStartUpdate: () => void;
  playbackPosition?: number;
  trackId?: string;
}

export const DrumSequencer: React.FC<DrumSequencerProps> = ({
  clip, onUpdateClip, onStartUpdate, playbackPosition = -1, trackId,
}) => {
  const TICK_WIDTH = 48;
  const durationInSixteenths = clip.duration;
  const drumHits = useMemo(() => (clip.notes as DrumHit[]) || [], [clip.notes]);

  const relPlayhead =
    playbackPosition >= clip.startTime && playbackPosition < clip.startTime + clip.duration
      ? playbackPosition - clip.startTime : -1;

  const toggleDrumStep = (pitch: string, step: number) => {
    onStartUpdate();
    const idx = drumHits.findIndex(h => h.pitch === pitch && h.start === step);
    if (idx !== -1) {
      onUpdateClip({ ...clip, notes: drumHits.filter((_, i) => i !== idx) });
    } else {
      triggerDrumSound(pitch, undefined, trackId);
      onUpdateClip({ ...clip, notes: [...drumHits, { id: crypto.randomUUID(), pitch, start: step, duration: 1 } as DrumHit] });
    }
  };

  const clearAll = () => {
    if (!drumHits.length) return;
    onStartUpdate();
    onUpdateClip({ ...clip, notes: [] });
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/45 border border-white/5 rounded-3xl overflow-hidden select-none shadow-2xl">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-950/20 to-slate-900 border-b border-indigo-500/10 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center text-indigo-400 text-xl shrink-0">🥁</div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400">Drum Sequencer</span>
            <h2 className="text-base font-black tracking-tight text-white uppercase truncate">Tap blocks to make beats</h2>
          </div>
        </div>
        <button type="button" onClick={clearAll}
          className="min-h-[44px] px-4 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-black uppercase active:scale-95 touch-manipulation shrink-0">
          Clear All
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto relative flex flex-col bg-slate-950/70 min-h-0">
        <div className="flex flex-col w-full relative" style={{ minWidth: `${durationInSixteenths * TICK_WIDTH + 128}px` }}>

          {relPlayhead >= 0 && (
            <div className="absolute top-0 bottom-0 w-0.5 bg-sky-400 z-30 pointer-events-none shadow-[0_0_8px_rgba(56,189,248,0.8)]"
              style={{ left: `${128 + relPlayhead * TICK_WIDTH + TICK_WIDTH / 2}px` }} />
          )}

          {DRUM_LANES.map(lane => {
            const laneHits = drumHits.filter(h => h.pitch === lane.pitch);
            return (
              <div key={lane.pitch} className="flex w-full border-b border-white/5" style={{ minHeight: 56 }}>
                {/* Lane label / audition button */}
                <button type="button" onClick={() => triggerDrumSound(lane.pitch, undefined, trackId)}
                  className="sticky left-0 w-32 shrink-0 z-20 flex items-center justify-between px-3.5 bg-slate-900 border-r border-black hover:bg-slate-800 active:scale-[0.98] transition-all cursor-pointer touch-manipulation min-h-[56px]">
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-black tracking-wide text-white uppercase">{lane.name.split(' ')[0]}</span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">{lane.name.split(' ')[1]}</span>
                  </div>
                  <div className={cn('w-3 h-3 rounded-full border shadow-md', lane.color)} />
                </button>

                {/* Steps */}
                <div className="flex-1 flex bg-slate-950/30">
                  {Array.from({ length: durationInSixteenths }).map((_, stepIdx) => {
                    const isTrig   = laneHits.some(h => h.start === stepIdx);
                    const isBeat   = stepIdx % 4 === 0;
                    const isPlay   = relPlayhead === stepIdx;
                    return (
                      <div key={stepIdx} onClick={() => toggleDrumStep(lane.pitch, stepIdx)}
                        className={cn('h-full border-r border-white/5 cursor-pointer flex items-center justify-center p-1 relative touch-manipulation',
                          isBeat ? 'bg-white/[0.02]' : 'hover:bg-white/[0.04]', isPlay && 'bg-sky-500/10')}
                        style={{ width: TICK_WIDTH, minHeight: 56 }}>
                        {isBeat && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-slate-700/40 pointer-events-none" />}
                        <div className={cn(
                          'w-full h-full min-h-[44px] rounded-lg transition-all duration-150 flex flex-col justify-between items-center py-1 border',
                          isTrig ? `${lane.color} scale-100 brightness-110 shadow-lg` : 'bg-[#14151b] border-white/[0.02] hover:bg-[#1a1c24] scale-95'
                        )}>
                          <span className={cn('text-[8px] font-mono font-extrabold', isTrig ? 'text-white/90' : 'text-slate-600/30')}>{stepIdx + 1}</span>
                          <div className={cn('w-1.5 h-1.5 rounded-full', isTrig ? 'bg-white/80' : 'bg-white/5')} />
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
