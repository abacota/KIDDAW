import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as Tone from 'tone';
import { Track, Clip, Note, DrumHit } from './types';
import { Timeline } from './components/Timeline';
import { PianoRoll } from './components/PianoRoll';
import { DrumSequencer } from './components/DrumSequencer';
import { cn, checkClipCollision, snapToGrid } from './lib/utils';
import {
  setupTrackAudioChannel,
  updateTrackAudioFX,
  updateTrackVolume,
  triggerTrackNote,
  triggerDrumSound
} from './lib/audio';
import {
  Play, Square, Undo2, Redo2, Download, Plus, ListRestart
} from 'lucide-react';

const INITIAL_TRACKS: Track[] = [
  {
    id: 'track_drums', name: 'Drum Beats', type: 'drum-machine', color: '#3b82f6',
    volume: -6, muted: false, soloed: false,
    fx: { reverb: 0.1, delay: 0.05, bitcrusher: 0.0, filter: 0.95 }
  },
  {
    id: 'track_melody', name: 'Main Piano', type: 'midi-instrument', color: '#fbbf24',
    volume: -10, muted: false, soloed: false, instrumentId: 'piano',
    fx: { reverb: 0.3, delay: 0.15, bitcrusher: 0.0, filter: 0.85 }
  },
  {
    id: 'track_bass', name: 'Fat Synth', type: 'midi-instrument', color: '#a855f7',
    volume: -12, muted: false, soloed: false, instrumentId: 'synth',
    fx: { reverb: 0.1, delay: 0.0, bitcrusher: 0.1, filter: 0.6 }
  }
];

const INITIAL_CLIPS: Clip[] = [
  {
    id: 'clip_drums_1', trackId: 'track_drums', type: 'drum-machine', startTime: 0, duration: 16,
    notes: [
      { id: 'd1', pitch: 'C1', start: 0, duration: 1 },
      { id: 'd2', pitch: 'E1', start: 2, duration: 1 },
      { id: 'd3', pitch: 'D1', start: 4, duration: 1 },
      { id: 'd4', pitch: 'E1', start: 6, duration: 1 },
      { id: 'd5', pitch: 'C1', start: 8, duration: 1 },
      { id: 'd6', pitch: 'E1', start: 10, duration: 1 },
      { id: 'd7', pitch: 'D1', start: 12, duration: 1 },
      { id: 'd8', pitch: 'E1', start: 14, duration: 1 }
    ]
  },
  {
    id: 'clip_melody_1', trackId: 'track_melody', type: 'midi-instrument', startTime: 0, duration: 16,
    notes: [
      { id: 'm1', pitch: 'C4', start: 0, duration: 2 },
      { id: 'm2', pitch: 'E4', start: 4, duration: 2 },
      { id: 'm3', pitch: 'G4', start: 8, duration: 2 },
      { id: 'm4', pitch: 'C5', start: 12, duration: 4 }
    ]
  }
];

export default function App() {
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [clips, setClips] = useState<Clip[]>(INITIAL_CLIPS);
  const [selectedClipId, setSelectedClipId] = useState<string | null>('clip_melody_1');
  const [activeEditor, setActiveEditor] = useState<'piano-roll' | 'drum-sequencer' | null>('piano-roll');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ── Strict audio gate: never auto-true, only set by explicit user tap ──
  const [audioStarted, setAudioStarted] = useState(false);

  const [undoHistory, setUndoHistory] = useState<{ tracks: Track[]; clips: Clip[] }[]>([]);
  const [redoHistory, setRedoHistory] = useState<{ tracks: Track[]; clips: Clip[] }[]>([]);

  const sequencerIntervalRef = useRef<number | null>(null);

  // ── Ref for auto-scrolling to the editor when a clip is tapped ──
  const editorRef = useRef<HTMLDivElement>(null);

  // ── Auto-scroll to editor whenever a clip is selected ──
  useEffect(() => {
    if (selectedClipId && activeEditor && editorRef.current) {
      setTimeout(() => {
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [selectedClipId, activeEditor]);

  const saveToHistory = (currentTracks: Track[], currentClips: Clip[]) => {
    setUndoHistory(prev => [...prev.slice(-19), { tracks: currentTracks, clips: currentClips }]);
    setRedoHistory([]);
  };

  const handleUndo = () => {
    if (undoHistory.length === 0) return;
    const previous = undoHistory[undoHistory.length - 1];
    setUndoHistory(prev => prev.slice(0, -1));
    setRedoHistory(prev => [...prev, { tracks, clips }]);
    setTracks(previous.tracks);
    setClips(previous.clips);
  };

  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    const next = redoHistory[redoHistory.length - 1];
    setRedoHistory(prev => prev.slice(0, -1));
    setUndoHistory(prev => [...prev, { tracks, clips }]);
    setTracks(next.tracks);
    setClips(next.clips);
  };

  useEffect(() => {
    tracks.forEach(track => {
      setupTrackAudioChannel(track.id, track.type, track.instrumentId);
      updateTrackAudioFX(track.id, 'reverb', track.fx.reverb);
      updateTrackAudioFX(track.id, 'delay', track.fx.delay);
      updateTrackAudioFX(track.id, 'bitcrusher', track.fx.bitcrusher);
      updateTrackAudioFX(track.id, 'filter', track.fx.filter);
      const hasSoloActive = tracks.some(t => t.soloed);
      let targetVol = track.volume;
      if (track.muted) targetVol = -Infinity;
      else if (hasSoloActive && !track.soloed) targetVol = -Infinity;
      updateTrackVolume(track.id, targetVol);
    });
  }, [tracks]);

  const triggerTickSequencer = useCallback((tickPos: number) => {
    setPlaybackPosition(tickPos);
    if (isMetronomeEnabled && tickPos % 4 === 0) {
      const freq = tickPos % 16 === 0 ? 1000 : 600;
      const osc = new Tone.Oscillator(freq, 'triangle').toDestination();
      osc.volume.value = -12;
      osc.start().stop('+16n');
    }
    clips.forEach(clip => {
      if (tickPos >= clip.startTime && tickPos < clip.startTime + clip.duration) {
        const relativeTick = tickPos - clip.startTime;
        const activeNotes = clip.notes.filter(n => n.start === relativeTick);
        const parentTrack = tracks.find(t => t.id === clip.trackId);
        if (parentTrack) {
          activeNotes.forEach((n: any) => {
            if (parentTrack.type === 'drum-machine') {
              triggerDrumSound(n.pitch);
            } else {
              triggerTrackNote(parentTrack.id, n.pitch, n.duration * (60 / bpm / 4));
            }
          });
        }
      }
    });
  }, [clips, tracks, isMetronomeEnabled, bpm]);

  // ── Bulletproof iOS audio unlock: called only from explicit user gesture ──
  const handleStartAudio = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await Tone.start();
    setAudioStarted(true);
  };

  const handleTogglePlayback = async () => {
    if (isPlaying) {
      if (sequencerIntervalRef.current) {
        clearInterval(sequencerIntervalRef.current);
        sequencerIntervalRef.current = null;
      }
      setIsPlaying(false);
      setPlaybackPosition(0);
    } else {
      setIsPlaying(true);
      let localTick = 0;
      const sixteenthLengthMs = (60 / bpm / 4) * 1000;
      triggerTickSequencer(0);
      sequencerIntervalRef.current = window.setInterval(() => {
        localTick = (localTick + 1) % 128;
        triggerTickSequencer(localTick);
      }, sixteenthLengthMs);
    }
  };

  useEffect(() => {
    return () => {
      if (sequencerIntervalRef.current) clearInterval(sequencerIntervalRef.current);
    };
  }, [isPlaying, triggerTickSequencer]);

  const selectedClip = clips.find(c => c.id === selectedClipId);

  const updateClipNotes = (clipId: string, notes: Note[] | DrumHit[]) => {
    setClips(prev => prev.map(c => c.id === clipId ? { ...c, notes } : c));
  };

  const handleRegionDragStart = (
    e: React.MouseEvent<HTMLDivElement>,
    clipId: string,
    action: 'move' | 'resize',
    onStartUpdate: () => void
  ) => {
    e.stopPropagation();
    onStartUpdate();
    const matchedClip = clips.find(c => c.id === clipId);
    if (!matchedClip) return;
    document.body.style.pointerEvents = 'none';
    const targetElement = e.currentTarget;
    targetElement.style.pointerEvents = 'auto';
    const startX = e.clientX;
    const originalStartTime = matchedClip.startTime;
    const originalDuration = matchedClip.duration;
    const STEP_SIZE = 48;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      if (action === 'move') {
        const gridOffset = Math.round(deltaX / STEP_SIZE);
        let newStart = Math.max(0, Math.min(128 - matchedClip.duration, originalStartTime + gridOffset));
        const candidate = { ...matchedClip, startTime: newStart };
        if (!checkClipCollision(clips.filter(c => c.id !== clipId), candidate)) {
          setClips(prev => prev.map(c => c.id === clipId ? { ...c, startTime: newStart } : c));
        }
      } else {
        const newDuration = Math.max(4, snapToGrid(originalDuration + Math.round(deltaX / STEP_SIZE), 4));
        const candidate = { ...matchedClip, duration: newDuration };
        if (!checkClipCollision(clips.filter(c => c.id !== clipId), candidate) && matchedClip.startTime + newDuration <= 128) {
          setClips(prev => prev.map(c => c.id === clipId ? { ...c, duration: newDuration } : c));
        }
      }
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.pointerEvents = 'auto';
      targetElement.style.pointerEvents = 'auto';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleAddNewClip = (trackId: string, startTime: number) => {
    saveToHistory(tracks, clips);
    const parentTrack = tracks.find(t => t.id === trackId);
    if (!parentTrack) return;
    const newClip: Clip = {
      id: crypto.randomUUID(),
      trackId,
      type: parentTrack.type === 'drum-machine' ? 'drum-machine' : 'midi-instrument',
      startTime, duration: 16, notes: []
    };
    setClips(prev => [...prev, newClip]);
    setSelectedClipId(newClip.id);
    setActiveEditor(newClip.type === 'drum-machine' ? 'drum-sequencer' : 'piano-roll');
  };

  const handleDeleteClip = (clipId: string) => {
    saveToHistory(tracks, clips);
    setClips(prev => prev.filter(c => c.id !== clipId));
    if (selectedClipId === clipId) setSelectedClipId(null);
  };

  const handleCreateNewTrack = () => {
    saveToHistory(tracks, clips);
    const names = ['Guitar Pluck', 'Beep Synth', 'Flute Glock', 'Custom Piano'];
    const insts: ('guitar' | 'chiptune' | 'glockenspiel' | 'piano')[] = ['guitar', 'chiptune', 'glockenspiel', 'piano'];
    const colors = ['#f97316', '#10b981', '#ec4899', '#3b82f6'];
    const index = tracks.length % 4;
    setTracks(prev => [...prev, {
      id: crypto.randomUUID(), name: names[index], type: 'midi-instrument',
      color: colors[index], volume: -8, muted: false, soloed: false,
      instrumentId: insts[index], fx: { reverb: 0.2, delay: 0.1, bitcrusher: 0.0, filter: 0.9 }
    }]);
  };

  const handleUpdateTrackFX = (trackId: string, fxType: 'reverb' | 'delay' | 'bitcrusher' | 'filter', value: number) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, fx: { ...t.fx, [fxType]: value } } : t));
  };

  const handleDeleteTrack = (trackId: string) => {
    saveToHistory(tracks, clips);
    setTracks(prev => prev.filter(t => t.id !== trackId));
    setClips(prev => prev.filter(c => c.trackId !== trackId));
  };

  const handleExportTrackSong = async () => {
    setIsExporting(true);
    const recorder = new Tone.Recorder();
    Tone.getDestination().connect(recorder);
    recorder.start();
    handleTogglePlayback();
    setTimeout(async () => {
      handleTogglePlayback();
      const blob = await recorder.stop();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'kiddaw_beat.webm';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setIsExporting(false);
    }, (8 * 4 * (60 / bpm)) * 1000 + 100);
  };

  return (
    <>
      {/* ── iOS / Web Audio unlock gate ── */}
      {!audioStarted && (
        <div
          className="fixed inset-0 z-[9999] bg-[#08090E]/95 backdrop-blur-sm flex flex-col items-center justify-center touch-manipulation cursor-pointer"
          onClick={handleStartAudio}
          onTouchEnd={handleStartAudio}
        >
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-10 text-center max-w-xs mx-4 shadow-2xl">
            <div className="text-6xl mb-4">🚀</div>
            <h2 className="text-3xl font-black text-white mb-2">Tap to Start</h2>
            <p className="text-slate-400 text-sm mb-6">Get ready to make some music!</p>
            <button
              className="w-full py-4 rounded-2xl bg-sky-500 text-slate-950 font-black text-base uppercase tracking-widest active:scale-95 transition-transform touch-manipulation"
              onClick={handleStartAudio}
              onTouchEnd={handleStartAudio}
            >
              Let's Go! 🎵
            </button>
          </div>
        </div>
      )}

      {/* ── Main app (blurred until audio unlocked) ── */}
      <div
        className={cn(
          "min-h-screen flex flex-col bg-[#08090E] text-white overscroll-none transition-all duration-300",
          !audioStarted && "blur-sm pointer-events-none select-none"
        )}
      >
        {/* Beat flash overlay */}
        <div className={cn(
          "fixed inset-0 pointer-events-none transition-all duration-100 z-50",
          isPlaying && playbackPosition % 4 === 0
            ? "border-8 border-sky-400/20 shadow-[inset_0_0_100px_rgba(56,189,248,0.15)]"
            : "border-8 border-transparent"
        )} />

        {/* ── Header ── */}
        <header className="sticky top-0 z-40 flex flex-col gap-3 p-3 bg-slate-900/90 border-b border-white/5 backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 shrink-0 rounded-2xl bg-gradient-to-tr from-sky-500 to-[#ec4899] flex items-center justify-center text-lg shadow-lg">🎧</div>
              <h1 className="text-base font-black tracking-tight uppercase text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-200 to-pink-400 leading-none">KIDDAW LIVE</h1>
            </div>
            <button
              onClick={handleExportTrackSong}
              disabled={isExporting}
              className={cn(
                "shrink-0 px-3 py-2 rounded-xl flex items-center gap-1.5 font-black text-[10px] uppercase active:scale-95 transition-all touch-manipulation",
                isExporting ? "bg-purple-600 text-white" : "bg-gradient-to-r from-[#ec4899] to-[#818cf8] text-white"
              )}
            >
              {isExporting
                ? <><ListRestart className="w-3.5 h-3.5 animate-spin" /><span>Saving...</span></>
                : <><Download className="w-3.5 h-3.5" /><span>Save Beat</span></>}
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleTogglePlayback}
              className={cn(
                "flex-1 min-w-[120px] py-3 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-sm active:scale-95 shadow-md touch-manipulation",
                isPlaying ? "bg-red-500 text-white" : "bg-sky-500 text-slate-950"
              )}
            >
              {isPlaying
                ? <><Square className="w-4 h-4 fill-white" /><span>Stop Loop</span></>
                : <><Play className="w-4 h-4 fill-slate-950" /><span>Start Loop</span></>}
            </button>

            <button
              onClick={() => setIsMetronomeEnabled(!isMetronomeEnabled)}
              className={cn(
                "px-3 py-3 rounded-2xl text-xs font-black uppercase touch-manipulation",
                isMetronomeEnabled
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-white/5 text-slate-500 border border-white/5"
              )}
            >
              Clicks {isMetronomeEnabled ? 'ON' : 'OFF'}
            </button>

            <div className="flex items-center gap-1.5 px-3 py-2 bg-black/40 border border-white/5 rounded-2xl font-mono text-xs font-bold text-slate-300">
              <span className="text-slate-500">BPM</span>
              <input
                type="number" min="60" max="240" value={bpm}
                onChange={(e) => setBpm(Math.max(60, Math.min(240, Number(e.target.value))))}
                className="w-12 bg-transparent text-center text-white text-sm font-black outline-none"
              />
            </div>

            <div className="flex gap-1">
              <button onClick={handleUndo} disabled={undoHistory.length === 0}
                className="p-3 bg-slate-800 border border-white/5 rounded-xl text-slate-300 disabled:opacity-30 active:scale-95 touch-manipulation">
                <Undo2 className="w-4 h-4" />
              </button>
              <button onClick={handleRedo} disabled={redoHistory.length === 0}
                className="p-3 bg-slate-800 border border-white/5 rounded-xl text-slate-300 disabled:opacity-30 active:scale-95 touch-manipulation">
                <Redo2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* ── Scrollable content ── */}
        <main className="flex-1 flex flex-col gap-4 p-3 overflow-y-auto overscroll-none pb-8">

          {/* Arrangement Grid */}
          <section className="flex flex-col gap-2">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Arrangement Grid</h3>
              <button
                onClick={handleCreateNewTrack}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-sky-500/30 text-sky-400 font-extrabold text-[11px] bg-sky-500/5 active:scale-95 touch-manipulation"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Instrument Track</span>
              </button>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-white/5">
              <div className="min-w-[600px]">
                <Timeline
                  tracks={tracks}
                  clips={clips}
                  zoom={48}
                  onRegionDragStart={handleRegionDragStart}
                  onClipDoubleClick={(clip) => {
                    setSelectedClipId(clip.id);
                    setActiveEditor(clip.type === 'drum-machine' ? 'drum-sequencer' : 'piano-roll');
                  }}
                  onClipClick={(clip) => {
                    setSelectedClipId(clip.id);
                    setActiveEditor(clip.type === 'drum-machine' ? 'drum-sequencer' : 'piano-roll');
                  }}
                  onAddClip={handleAddNewClip}
                  onRecord={() => {}}
                  onUpdateClip={() => {}}
                  onStartUpdate={() => saveToHistory(tracks, clips)}
                  onDeleteClip={handleDeleteClip}
                  onDeleteTrack={handleDeleteTrack}
                  onUpdateTrackFX={handleUpdateTrackFX}
                  setTracks={setTracks}
                  selectedClipId={selectedClipId}
                  playbackPosition={playbackPosition}
                />
              </div>
            </div>
          </section>

          {/* ── Clip Editor — ref attached for auto-scroll ── */}
          <section ref={editorRef} className="flex flex-col rounded-3xl border border-white/5 overflow-hidden bg-slate-950/20">
            <div className="flex justify-between items-center py-2.5 px-4 bg-slate-900 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping" />
                <span className="text-xs font-black uppercase text-slate-400 tracking-wide">Clip Editor</span>
                {activeEditor && (
                  <span className="text-[9px] px-2 py-0.5 bg-indigo-600 text-white rounded-full font-black uppercase">Active</span>
                )}
              </div>
              <button
                onClick={() => setActiveEditor(null)}
                className="text-[10px] font-black text-slate-500 hover:text-slate-300 px-2 py-1 touch-manipulation"
              >
                Collapse ✕
              </button>
            </div>

            <div className="min-h-[300px] sm:min-h-[360px]">
              <AnimatePresence mode="wait">
                {activeEditor && selectedClip ? (
                  <motion.div
                    key={selectedClipId || 'no_ed'}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="h-full flex flex-col"
                  >
                    {activeEditor === 'piano-roll' ? (
                      <PianoRoll
                        clip={selectedClip}
                        onUpdateClip={(updated) => updateClipNotes(updated.id, updated.notes as Note[])}
                        onStartUpdate={() => saveToHistory(tracks, clips)}
                        instrumentId={(tracks.find(t => t.id === selectedClip.trackId)?.instrumentId || 'piano') as any}
                      />
                    ) : (
                      <DrumSequencer
                        clip={selectedClip}
                        onUpdateClip={(updated) => updateClipNotes(updated.id, updated.notes as DrumHit[])}
                        onStartUpdate={() => saveToHistory(tracks, clips)}
                      />
                    )}
                  </motion.div>
                ) : (
                  <div className="min-h-[300px] flex flex-col justify-center items-center text-slate-600 italic gap-2 p-8 text-center">
                    <span className="text-base">🎵 Tap any clip to open the editor!</span>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-500/40 mt-1">Piano Roll · Drum Sequencer</span>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </section>

        </main>
      </div>
    </>
  );
}
