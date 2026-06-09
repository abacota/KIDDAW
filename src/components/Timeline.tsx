import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Clip, Track } from '../types';
import { cn, snapToGrid, checkClipCollision } from '../lib/utils';
import { Music, Mic, Volume2, Trash2, Wand2, Plus, VolumeX, Eye } from 'lucide-react';

interface TimelineProps {
  tracks: Track[];
  clips: Clip[];
  zoom: number; // multiplier for pixel size ticks (approx 10 to 100)
  onRegionDragStart: (
    e: React.MouseEvent<HTMLDivElement>, 
    clipId: string, 
    action: 'move' | 'resize',
    onStartUpdate: () => void
  ) => void;
  onClipDoubleClick: (clip: Clip) => void;
  onClipClick: (clip: Clip) => void;
  onAddClip: (trackId: string, startTime: number) => void;
  onRecord: (trackId: string) => void;
  onUpdateClip: (clip: Clip) => void;
  onStartUpdate: () => void;
  onDeleteClip: (clipId: string) => void;
  onDeleteTrack: (trackId: string) => void;
  onUpdateTrackFX: (trackId: string, fxType: 'reverb' | 'delay' | 'bitcrusher' | 'filter', value: number) => void;
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  selectedClipId: string | null;
  playbackPosition: number; // in sixteenth ticks
}

export const Timeline: React.FC<TimelineProps> = ({
  tracks,
  clips,
  zoom,
  onRegionDragStart,
  onClipDoubleClick,
  onClipClick,
  onAddClip,
  onRecord,
  onUpdateClip,
  onStartUpdate,
  onDeleteClip,
  onDeleteTrack,
  onUpdateTrackFX,
  setTracks,
  selectedClipId,
  playbackPosition
}) => {
  const [expandedTrackFx, setExpandedTrackFx] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const TICK_WIDTH = zoom; // dynamic grid division width
  const TOTAL_BARS = 8;
  const SIXTEENTHS_SPAN = TOTAL_BARS * 16; // 128 ticks max

  const handleTrackLaneDoubleClick = (trackId: string, e: React.MouseEvent) => {
    // If the click is directly on the lane container (not on a clip)
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('lane-filler')) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickedTick = Math.floor(clickX / TICK_WIDTH);
      // Snap to closest bar start
      const snappedTick = Math.max(0, snapToGrid(clickedTick, 4));
      onAddClip(trackId, snappedTick);
    }
  };

  // Helper function to clone/duplicate any clip instantaneously via on-clip "+" button click
  const handleClipDuplicateClick = (e: React.MouseEvent, clipToCopy: Clip) => {
    e.stopPropagation();
    onStartUpdate();

    const newStartTime = clipToCopy.startTime + clipToCopy.duration;
    
    // Build cloned candidate
    const newClip: Clip = {
      ...clipToCopy,
      id: crypto.randomUUID(),
      startTime: newStartTime,
      notes: (clipToCopy.notes as any[]).map(n => ({ ...n, id: crypto.randomUUID() }))
    };

    // Prevent collision
    const testClips = clips.filter(c => c.id !== clipToCopy.id);
    const hasCollision = checkClipCollision(testClips, newClip);

    if (!hasCollision) {
      // Direct update
      onAddClip(clipToCopy.trackId, newStartTime);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 border border-white/5 rounded-3xl overflow-hidden mt-2 relative min-h-0 select-none shadow-xl" ref={containerRef}>
      
      {/* Scrollable Tracks Window Area */}
      <div className="flex-1 overflow-auto custom-scrollbar flex relative min-h-0">
        
        {/* Playhead Guide vertical wire */}
        <div 
          className="absolute top-0 bottom-0 w-[3px] bg-sky-400 z-30 pointer-events-none transition-all duration-75 shadow-glow"
          style={{ 
            left: `${224 + (playbackPosition * TICK_WIDTH)}px`,
            opacity: playbackPosition > 0 ? 1 : 0.1
          }}
        />

        {/* Column A: Left Track Headers Panel */}
        <div className="w-56 shrink-0 bg-slate-900 border-r border-[#0A0A0A] flex flex-col sticky left-0 z-40 shadow-2xl">
          {/* Top spacer for timeline ruler */}
          <div className="h-10 bg-slate-950 border-b border-white/10 shrink-0 flex items-center justify-between px-4">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Tracks List</span>
            <div className="flex items-center gap-1.5 font-mono text-[9px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-full font-bold">
              <span>8 Bars Loop</span>
            </div>
          </div>

          {/* Tracks list detail column */}
          <div className="flex-1 flex flex-col">
            {tracks.map((track) => (
              <div 
                key={track.id}
                className="h-36 border-b border-white/5 p-3 flex flex-col justify-between shrink-0 relative bg-slate-900/40 relative group"
              >
                {/* 1. Header Row (Mute, Solo, Wand, Delete) */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg border border-white/5 shrink-0 text-sm font-bold text-slate-950"
                      style={{ backgroundColor: track.color }}
                    >
                      {track.type === 'drum-machine' && '🥁'}
                      {track.type === 'midi-instrument' && '🎹'}
                      {track.type === 'audio' && '🎙️'}
                      {track.type === 'sampler' && '🎤'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-black uppercase text-white tracking-wide truncate w-24">
                        {track.name}
                      </span>
                      <span className="text-[8px] font-black text-[#6366f1] tracking-widest uppercase">
                        {track.instrumentId || track.type.replace('-', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedTrackFx(expandedTrackFx === track.id ? null : track.id);
                      }}
                      className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center transition-colors border",
                        expandedTrackFx === track.id 
                          ? "bg-indigo-600 border-indigo-400 text-white shadow-lg" 
                          : "bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700 hover:text-white"
                      )}
                      title="Magic FX Adjust"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteTrack(track.id); }}
                      className="w-6 h-6 flex items-center justify-center hover:bg-red-500/20 rounded-md transition-all text-slate-500 hover:text-red-400"
                      title="Delete Track"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 2. Direct Compact Mixer (Mutes / Solos / Faders) */}
                <div className="flex flex-col gap-2 mt-2 w-full">
                  <div className="flex gap-1.5">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setTracks(prev => prev.map(t => t.id === track.id ? { ...t, muted: !t.muted } : t));
                      }}
                      className={cn(
                        "flex-1 py-1 rounded-md text-[9px] uppercase tracking-widest font-black transition-all",
                        track.muted 
                          ? "bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)] border border-red-400/20" 
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      )}
                    >
                      Mute
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setTracks(prev => prev.map(t => t.id === track.id ? { ...t, soloed: !t.soloed } : t));
                      }}
                      className={cn(
                        "flex-1 py-1 rounded-md text-[9px] uppercase tracking-widest font-black transition-all",
                        track.soloed 
                          ? "bg-yellow-500 text-slate-900 shadow-[0_0_10px_rgba(234,179,8,0.3)] border border-yellow-400/30" 
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      )}
                    >
                      Solo
                    </button>
                  </div>

                  {/* Volume Slider */}
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-3 h-3 text-slate-400" />
                    <input 
                      type="range" min="-60" max="6" step="1" value={track.volume}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const newVol = parseFloat(e.target.value);
                        setTracks(prev => prev.map(t => t.id === track.id ? { ...t, volume: newVol } : t));
                      }}
                      className="flex-1 h-1 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                    />
                    <span className="text-[8px] font-mono font-bold text-slate-500 w-6 text-right">
                      {track.volume > -50 ? `${Math.round(track.volume)}dB` : '-inf'}
                    </span>
                  </div>
                </div>

                {/* 3. Slide-Down FX Drawer Overlay */}
                {expandedTrackFx === track.id && (
                  <div className="absolute top-[85%] left-2 right-2 bg-slate-800 border border-slate-700 p-2.5 rounded-xl shadow-2xl z-50 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[8px] font-black tracking-widest text-[#a855f7] uppercase mb-0.5">
                      <span>Synthesizer Effects</span>
                      <button onClick={() => setExpandedTrackFx(null)} className="hover:text-white">✕</button>
                    </div>
                    {/* Space (Reverb) */}
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black text-slate-400 w-10 text-right">SPACE</span>
                      <input 
                        type="range" min="0" max="1" step="0.01" 
                        value={track.fx.reverb}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onUpdateTrackFX(track.id, 'reverb', parseFloat(e.target.value))}
                        className="flex-1 h-1 bg-slate-900 rounded-full cursor-pointer accent-purple-400" 
                      />
                    </div>
                    {/* Echo (Delay) */}
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black text-slate-400 w-10 text-right">ECHO</span>
                      <input 
                        type="range" min="0" max="1" step="0.01" 
                        value={track.fx.delay}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onUpdateTrackFX(track.id, 'delay', parseFloat(e.target.value))}
                        className="flex-1 h-1 bg-slate-900 rounded-full cursor-pointer accent-blue-400" 
                      />
                    </div>
                    {/* Robot (Bitcrusher) */}
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black text-slate-400 w-10 text-right">ROBOT</span>
                      <input 
                        type="range" min="0" max="1" step="0.01" 
                        value={track.fx.bitcrusher}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onUpdateTrackFX(track.id, 'bitcrusher', parseFloat(e.target.value))}
                        className="flex-1 h-1 bg-slate-900 rounded-full cursor-pointer accent-green-400" 
                      />
                    </div>
                    {/* Muffle (Filter) */}
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black text-slate-400 w-10 text-right">MUFFLE</span>
                      <input 
                        type="range" min="0.01" max="1" step="0.01" 
                        value={track.fx.filter}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onUpdateTrackFX(track.id, 'filter', parseFloat(e.target.value))}
                        className="flex-1 h-1 bg-slate-900 rounded-full cursor-pointer accent-orange-400" 
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Column B: Right Scrollable Clipboard Grid tracks lanes */}
        <div className="flex-1 flex flex-col relative" style={{ width: `${SIXTEENTHS_SPAN * TICK_WIDTH}px` }}>
          
          {/* Top Row: Timeline Ruler Ticks */}
          <div className="h-10 bg-slate-950 border-b border-white/10 flex shrink-0 sticky top-0 z-20">
            {Array.from({ length: TOTAL_BARS }).map((_, barIdx) => (
              <div 
                key={barIdx} 
                className="h-full border-r-2 border-white/10 flex flex-col justify-between p-1 select-none pointer-events-none"
                style={{ width: `${16 * TICK_WIDTH}px` }}
              >
                <span className="text-[10px] font-black text-[#50607b] tracking-wider font-mono">
                  BAR {barIdx + 1}
                </span>
                <div className="flex gap-4">
                  <span className="text-[8px] text-slate-600 font-bold">1</span>
                  <span className="text-[8px] text-slate-600 font-bold">2</span>
                  <span className="text-[8px] text-slate-600 font-bold">3</span>
                  <span className="text-[8px] text-slate-600 font-bold">4</span>
                </div>
              </div>
            ))}
          </div>

          {/* Grid rows workspace area */}
          <div className="flex-1 flex flex-col relative">
            
            {/* Draw horizontal zebra lane lines */}
            {tracks.map((track) => {
              const trackClips = clips.filter(c => c.trackId === track.id);

              return (
                <div 
                  key={track.id}
                  onDoubleClick={(e) => handleTrackLaneDoubleClick(track.id, e)}
                  className="h-36 border-b border-white/5 flex items-center relative transition-colors duration-200 hover:bg-white/[0.01] lane-filler relative"
                  style={{ width: `${SIXTEENTHS_SPAN * TICK_WIDTH}px` }}
                >
                  
                  {/* Visual Background grid subdivision ticks helper */}
                  {Array.from({ length: SIXTEENTHS_SPAN }).map((_, ticIdx) => (
                    ticIdx % 4 === 0 && (
                      <div 
                        key={ticIdx} 
                        className={cn(
                          "absolute top-0 bottom-0 border-l pointer-events-none",
                          ticIdx % 16 === 0 ? "border-white/10" : "border-white/5"
                        )}
                        style={{ left: `${ticIdx * TICK_WIDTH}px` }}
                      />
                    )
                  ))}

                  {/* Render Placed Clips */}
                  {trackClips.map((clip) => {
                    const isSelected = selectedClipId === clip.id;
                    const clipWidth = clip.duration * TICK_WIDTH;
                    const clipLeft = clip.startTime * TICK_WIDTH;

                    return (
                      <div
                        key={clip.id}
                        onMouseDown={(e) => onRegionDragStart(e, clip.id, 'move', onStartUpdate)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onClipClick(clip);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          onClipDoubleClick(clip);
                        }}
                        className={cn(
                          "absolute h-24 rounded-2xl flex flex-col justify-between p-3 cursor-grab select-none active:cursor-grabbing border-2 shadow-2xl transition-all duration-150 group/clip z-10",
                          isSelected 
                            ? "border-white ring-4 ring-sky-500/20 shadow-sky-500/10 scale-[1.01]" 
                            : "border-transparent text-white"
                        )}
                        style={{ 
                          left: `${clipLeft}px`, 
                          width: `${clipWidth}px`,
                          backgroundColor: track.color + 'bd' // add subtle opacity
                        }}
                      >
                        {/* Header Details */}
                        <div className="flex items-start justify-between">
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-black uppercase text-slate-950 bg-white/70 px-1.5 py-0.5 rounded-full inline-block truncate w-24">
                              {clip.type === 'drum-machine' ? '🔥 Drums' : '🎹 Melody'}
                            </span>
                            <span className="text-[9px] font-mono font-bold mt-1 text-slate-950 truncate">
                              Len: {clip.duration / 4} Beats
                            </span>
                          </div>

                          {/* Quick delete / clone actions overlays */}
                          <div className="flex items-center gap-1 opacity-0 group-hover/clip:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleClipDuplicateClick(e, clip)}
                              className="w-5 h-5 bg-white text-slate-900 rounded-full flex items-center justify-center font-bold hover:scale-110 active:scale-95 transition-all shadow-md mt-0.5 ml-0.5"
                              title="Instant Loop Clone"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteClip(clip.id);
                              }}
                              className="w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md ml-0.5"
                              title="Delete Clip"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Interactive Waveform/Piano Representation inside the bar */}
                        <div className="h-6 bg-black/35 rounded-xl p-1.5 flex items-center justify-around overflow-hidden border border-white/5">
                          {clip.type === 'drum-machine' ? (
                            // Render rhythmic dots representation
                            <div className="flex gap-1.5">
                              {clip.notes.slice(0, 10).map((n: any) => (
                                <div key={n.id} className="w-2 h-2 rounded-full bg-indigo-300 shadow-md" />
                              ))}
                            </div>
                          ) : (
                            // Render piano roll bars preview representation
                            <div className="flex gap-1 items-end h-full">
                              {clip.notes.slice(0, 12).map((n: any, idx) => (
                                <div 
                                  key={n.id} 
                                  className="w-1.5 bg-amber-300 rounded-full shadow-md"
                                  style={{ height: `${20 + (idx * 5) % 80}%` }}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Drag Handle edge for resizing */}
                        <div 
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            onRegionDragStart(e, clip.id, 'resize', onStartUpdate);
                          }}
                          className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize bg-white/20 hover:bg-white/40 rounded-r-2xl transition-colors shrink-0" 
                          title="Drag to Stretch Clip"
                        />
                      </div>
                    );
                  })}

                </div>
              );
            })}

          </div>

        </div>

      </div>

    </div>
  );
};
