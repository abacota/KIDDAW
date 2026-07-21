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
  Play, Square, Undo2, Redo2, Download, Plus, ListRestart,
  Music2, Drum, Piano, SlidersHorizontal, Sparkles, ChevronLeft
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
type AppView = 'song' | 'beats' | 'melody' | 'mix' | 'sounds';

const INSTRUMENT_LIST = [
  { id: 'piano',        emoji: '🎹', name: 'Piano',        color: '#fbbf24' },
  { id: 'synth',        emoji: '🎛️', name: 'Synth',        color: '#a855f7' },
  { id: 'guitar',       emoji: '🎸', name: 'Guitar',       color: '#f97316' },
  { id: 'chiptune',     emoji: '👾', name: 'Chiptune',     color: '#06b6d4' },
  { id: 'glockenspiel', emoji: '🔔', name: 'Glockenspiel', color: '#ec4899' },
];

const TRACK_COLORS = ['#3b82f6','#fbbf24','#a855f7','#f97316','#10b981','#ec4899','#06b6d4','#ef4444'];

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

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  // Core state
  const [tracks, setTracks]           = useState<Track[]>(INITIAL_TRACKS);
  const [clips, setClips]             = useState<Clip[]>(INITIAL_CLIPS);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [editingClip, setEditingClip] = useState<Clip | null>(null);
  const [activeView, setActiveView]   = useState<AppView>('song');

  // Playback
  const [isPlaying, setIsPlaying]           = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [bpm, setBpm]                       = useState(120);
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(false);
  const [isExporting, setIsExporting]       = useState(false);
  const [audioReady, setAudioReady]         = useState(false);
  const [audioHint, setAudioHint]           = useState('');

  // History
  const [undoHistory, setUndoHistory] = useState<{ tracks: Track[]; clips: Clip[] }[]>([]);
  const [redoHistory, setRedoHistory] = useState<{ tracks: Track[]; clips: Clip[] }[]>([]);

  const sequencerIntervalRef = useRef<number | null>(null);

  // ── Audio setup (per track) ────────────────────────────────────────────
  useEffect(() => {
    tracks.forEach(track => {
      setupTrackAudioChannel(track.id, track.type, track.instrumentId);
      updateTrackAudioFX(track.id, 'reverb',     track.fx.reverb);
      updateTrackAudioFX(track.id, 'delay',      track.fx.delay);
      updateTrackAudioFX(track.id, 'bitcrusher', track.fx.bitcrusher);
      updateTrackAudioFX(track.id, 'filter',     track.fx.filter);
      const hasSolo   = tracks.some(t => t.soloed);
      let vol = track.volume;
      if (track.muted)                  vol = -Infinity;
      else if (hasSolo && !track.soloed) vol = -Infinity;
      updateTrackVolume(track.id, vol);
    });
  }, [tracks]);

  // ── Sequencer tick ────────────────────────────────────────────────────
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
        const rel = tickPos - clip.startTime;
        const active = clip.notes.filter(n => n.start === rel);
        const parentTrack = tracks.find(t => t.id === clip.trackId);
        if (parentTrack) {
          active.forEach((n: any) => {
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

  // ── Audio unlock + play toggle ────────────────────────────────────────
  const ensureAudio = async (): Promise<boolean> => {
    try {
      await Tone.start();
      if (Tone.context.state === 'running') {
        setAudioReady(true);
        setAudioHint('');
        return true;
      }
    } catch (e) {
      console.warn('Tone.start failed', e);
    }
    setAudioHint('Tap Play again to unlock audio');
    return false;
  };

  const handleTogglePlayback = async () => {
    // Always attempt to unlock audio on this gesture
    const ok = await ensureAudio();
    if (!ok) return;

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
      const msPerSixteenth = (60 / bpm / 4) * 1000;
      triggerTickSequencer(0);
      sequencerIntervalRef.current = window.setInterval(() => {
        localTick = (localTick + 1) % 128;
        triggerTickSequencer(localTick);
      }, msPerSixteenth);
    }
  };

  useEffect(() => {
    return () => {
      if (sequencerIntervalRef.current) clearInterval(sequencerIntervalRef.current);
    };
  }, [isPlaying, triggerTickSequencer]);

  // ── History ───────────────────────────────────────────────────────────
  const saveToHistory = (t: Track[], c: Clip[]) => {
    setUndoHistory(prev => [...prev.slice(-19), { tracks: t, clips: c }]);
    setRedoHistory([]);
  };
  const handleUndo = () => {
    if (!undoHistory.length) return;
    const prev = undoHistory[undoHistory.length - 1];
    setUndoHistory(h => h.slice(0, -1));
    setRedoHistory(h => [...h, { tracks, clips }]);
    setTracks(prev.tracks); setClips(prev.clips);
  };
  const handleRedo = () => {
    if (!redoHistory.length) return;
    const next = redoHistory[redoHistory.length - 1];
    setRedoHistory(h => h.slice(0, -1));
    setUndoHistory(h => [...h, { tracks, clips }]);
    setTracks(next.tracks); setClips(next.clips);
  };

  // ── Clip helpers ──────────────────────────────────────────────────────
  const updateClipNotes = (clipId: string, notes: Note[] | DrumHit[]) => {
    setClips(prev => prev.map(c => c.id === clipId ? { ...c, notes } : c));
    setEditingClip(prev => prev?.id === clipId ? { ...prev, notes } : prev);
  };

  const openClipEditor = (clip: Clip) => {
    setSelectedClipId(clip.id);
    setEditingClip(clip);
    setActiveView(clip.type === 'drum-machine' ? 'beats' : 'melody');
  };

  const handleAddNewClip = (trackId: string, startTime: number) => {
    saveToHistory(tracks, clips);
    const parentTrack = tracks.find(t => t.id === trackId);
    if (!parentTrack) return;
    const newClip: Clip = {
      id: crypto.randomUUID(), trackId,
      type: parentTrack.type === 'drum-machine' ? 'drum-machine' : 'midi-instrument',
      startTime, duration: 16, notes: []
    };
    setClips(prev => [...prev, newClip]);
    openClipEditor(newClip);
  };

  const handleDeleteClip = (clipId: string) => {
    saveToHistory(tracks, clips);
    setClips(prev => prev.filter(c => c.id !== clipId));
    if (selectedClipId === clipId) { setSelectedClipId(null); setEditingClip(null); }
  };

  // ── Track helpers ─────────────────────────────────────────────────────
  const handleCreateNewTrack = (
    type: 'midi-instrument' | 'drum-machine' = 'midi-instrument',
    instrumentId = 'piano'
  ) => {
    saveToHistory(tracks, clips);
    const colorIdx = tracks.length % TRACK_COLORS.length;
    const names = ['Guitar Pluck','Beep Synth','Flute Glock','Drum Kit 2'];
    setTracks(prev => [...prev, {
      id: crypto.randomUUID(),
      name: names[prev.length % 4],
      type, color: TRACK_COLORS[colorIdx],
      volume: -8, muted: false, soloed: false,
      instrumentId,
      fx: { reverb: 0.2, delay: 0.1, bitcrusher: 0.0, filter: 0.9 }
    }]);
  };

  const handleUpdateTrackFX = (
    trackId: string,
    fxType: 'reverb' | 'delay' | 'bitcrusher' | 'filter',
    value: number
  ) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, fx: { ...t.fx, [fxType]: value } } : t));
  };

  const handleUpdateTrackVolume = (trackId: string, value: number) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, volume: value } : t));
  };

  const handleToggleMute = (trackId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t));
  };

  const handleToggleSolo = (trackId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, soloed: !t.soloed } : t));
  };

  const handleDeleteTrack = (trackId: string) => {
    saveToHistory(tracks, clips);
    setTracks(prev => prev.filter(t => t.id !== trackId));
    setClips(prev => prev.filter(c => c.trackId !== trackId));
  };

  // ── Region drag (Timeline) ────────────────────────────────────────────
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
    const el = e.currentTarget;
    el.style.pointerEvents = 'auto';
    const startX = e.clientX;
    const origStart = matchedClip.startTime;
    const origDur   = matchedClip.duration;
    const STEP = 48;
    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      if (action === 'move') {
        const newStart = Math.max(0, Math.min(128 - matchedClip.duration, origStart + Math.round(dx / STEP)));
        const candidate = { ...matchedClip, startTime: newStart };
        if (!checkClipCollision(clips.filter(c => c.id !== clipId), candidate))
          setClips(prev => prev.map(c => c.id === clipId ? { ...c, startTime: newStart } : c));
      } else {
        const newDur = Math.max(4, snapToGrid(origDur + Math.round(dx / STEP), 4));
        const candidate = { ...matchedClip, duration: newDur };
        if (!checkClipCollision(clips.filter(c => c.id !== clipId), candidate) && matchedClip.startTime + newDur <= 128)
          setClips(prev => prev.map(c => c.id === clipId ? { ...c, duration: newDur } : c));
      }
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.pointerEvents = 'auto';
      el.style.pointerEvents = 'auto';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // ── Export ────────────────────────────────────────────────────────────
  const handleExport = async () => {
    const ok = await ensureAudio();
    if (!ok) return;
    setIsExporting(true);
    const recorder = new Tone.Recorder();
    Tone.getDestination().connect(recorder);
    recorder.start();
    if (!isPlaying) handleTogglePlayback();
    setTimeout(async () => {
      if (isPlaying) handleTogglePlayback();
      const blob = await recorder.stop();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'kiddaw_beat.webm';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setIsExporting(false);
    }, (8 * 4 * (60 / bpm)) * 1000 + 200);
  };

  // ── Derived ───────────────────────────────────────────────────────────
  const editorClip  = editingClip ?? clips.find(c => c.id === selectedClipId) ?? null;
  const editorTrack = editorClip ? tracks.find(t => t.id === editorClip.trackId) : null;

  const NAV_ITEMS: { view: AppView; label: string; icon: React.ReactNode }[] = [
    { view: 'song',   label: 'Song',    icon: <Music2 className="w-5 h-5" /> },
    { view: 'beats',  label: 'Beats',   icon: <Drum className="w-5 h-5" /> },
    { view: 'melody', label: 'Melody',  icon: <Piano className="w-5 h-5" /> },
    { view: 'mix',    label: 'Mix',     icon: <SlidersHorizontal className="w-5 h-5" /> },
    { view: 'sounds', label: 'Sounds',  icon: <Sparkles className="w-5 h-5" /> },
  ];

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-[#08090E] text-white overflow-hidden">

      {/* Beat-flash border */}
      <div className={cn(
        'fixed inset-0 pointer-events-none z-50 transition-all duration-75',
        isPlaying && playbackPosition % 4 === 0
          ? 'border-4 border-sky-400/20 shadow-[inset_0_0_80px_rgba(56,189,248,0.08)]'
          : 'border-4 border-transparent'
      )} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="shrink-0 z-40 flex flex-col gap-2 px-3 pt-3 pb-2
        bg-slate-900/95 border-b border-white/5 backdrop-blur-md">

        {/* Logo + Save */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-pink-500
              flex items-center justify-center text-base shadow">🎧</div>
            <span className="text-sm font-black uppercase tracking-tight
              bg-gradient-to-r from-sky-400 via-indigo-200 to-pink-400 bg-clip-text text-transparent">
              KIDDAW
            </span>
            {/* Audio status */}
            <span className={cn(
              'text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider',
              audioReady
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-700/50 text-slate-500 border border-slate-600/30'
            )}>
              {audioReady ? '🔊 Ready' : '🔇 Tap Play'}
            </span>
            {audioHint && <span className="text-[9px] text-amber-400">{audioHint}</span>}
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className={cn(
              'px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-black text-[10px] uppercase',
              'active:scale-95 touch-manipulation',
              isExporting
                ? 'bg-purple-600 text-white'
                : 'bg-gradient-to-r from-pink-500 to-indigo-500 text-white'
            )}
          >
            {isExporting
              ? <><ListRestart className="w-3 h-3 animate-spin" /> Saving...</>
              : <><Download className="w-3 h-3" /> Save Beat</>}
          </button>
        </div>

        {/* Transport */}
        <div className="flex items-center gap-2">
          {/* Play/Stop — audio unlocks HERE */}
          <button
            onTouchEnd={(e) => { e.preventDefault(); handleTogglePlayback(); }}
            onClick={handleTogglePlayback}
            className={cn(
              'flex-1 min-w-0 py-2.5 rounded-2xl flex items-center justify-center gap-2',
              'font-black uppercase text-sm active:scale-95 touch-manipulation',
              isPlaying ? 'bg-red-500 text-white' : 'bg-sky-500 text-slate-950'
            )}
          >
            {isPlaying
              ? <><Square className="w-4 h-4 fill-white" /> Stop</>
              : <><Play className="w-4 h-4 fill-slate-950" /> Play</>}
          </button>

          {/* Metronome */}
          <button
            onClick={() => setIsMetronomeEnabled(v => !v)}
            className={cn(
              'px-3 py-2.5 rounded-2xl text-[11px] font-black uppercase touch-manipulation',
              isMetronomeEnabled
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/5 text-slate-500 border border-white/5'
            )}
          >
            CLICK
          </button>

          {/* BPM */}
          <div className="flex items-center gap-1 px-2.5 py-1.5
            bg-black/40 border border-white/5 rounded-2xl">
            <span className="text-[10px] text-slate-500 font-bold">BPM</span>
            <input
              type="number" min="60" max="240" value={bpm}
              onChange={e => setBpm(Math.max(60, Math.min(240, Number(e.target.value))))}
              className="w-12 bg-transparent text-center text-white text-sm font-black outline-none"
            />
          </div>

          {/* Undo/Redo */}
          <div className="flex gap-1">
            <button onClick={handleUndo} disabled={!undoHistory.length}
              className="p-2.5 bg-slate-800 border border-white/5 rounded-xl
                text-slate-300 disabled:opacity-30 active:scale-95 touch-manipulation">
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={handleRedo} disabled={!redoHistory.length}
              className="p-2.5 bg-slate-800 border border-white/5 rounded-xl
                text-slate-300 disabled:opacity-30 active:scale-95 touch-manipulation">
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── View content ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.13 }}
          >

            {/* ── SONG VIEW ──────────────────────────────────────────── */}
            {activeView === 'song' && (
              <div className="p-3 pb-6 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">Arrangement</h2>
                  <button
                    onClick={() => handleCreateNewTrack()}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl border border-sky-500/30
                      text-sky-400 font-black text-[11px] bg-sky-500/5 active:scale-95 touch-manipulation"
                  >
                    <Plus className="w-3 h-3" /> Add Track
                  </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/5">
                  <div className="min-w-[600px]">
                    <Timeline
                      tracks={tracks}
                      clips={clips}
                      zoom={48}
                      onRegionDragStart={handleRegionDragStart}
                      onClipDoubleClick={openClipEditor}
                      onClipClick={(clip) => {
                        setSelectedClipId(clip.id);
                        setEditingClip(clip);
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

                {/* Selected clip quick-open */}
                {selectedClipId && (() => {
                  const clip = clips.find(c => c.id === selectedClipId);
                  if (!clip) return null;
                  return (
                    <div className="flex items-center gap-2 p-3 bg-slate-900/80 rounded-2xl border border-white/5">
                      <span className="text-xs text-slate-400 font-bold shrink-0">Clip:</span>
                      <button
                        onClick={() => openClipEditor(clip)}
                        className="px-4 py-2 rounded-xl bg-sky-500 text-slate-950 font-black text-xs
                          uppercase active:scale-95 touch-manipulation"
                      >
                        {clip.type === 'drum-machine' ? '🥁 Edit Beats' : '🎹 Edit Melody'}
                      </button>
                      <button
                        onClick={() => { setSelectedClipId(null); setEditingClip(null); }}
                        className="ml-auto px-3 py-2 rounded-xl bg-white/5 text-slate-400
                          font-black text-xs uppercase active:scale-95 touch-manipulation"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── BEATS VIEW ─────────────────────────────────────────── */}
            {activeView === 'beats' && (
              <div className="p-3 pb-6 flex flex-col gap-3">
                {editorClip && editorClip.type === 'drum-machine' ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActiveView('song')}
                          className="p-2 rounded-xl bg-white/5 text-slate-400
                            active:scale-95 touch-manipulation"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">Beat Editor</h2>
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold">
                        {tracks.find(t => t.id === editorClip.trackId)?.name}
                      </span>
                    </div>
                    <DrumSequencer
                      clip={editorClip}
                      onUpdateClip={updated => updateClipNotes(updated.id, updated.notes as DrumHit[])}
                      onStartUpdate={() => saveToHistory(tracks, clips)}
                    />
                  </>
                ) : (
                  <BeatsPickerView
                    clips={clips}
                    tracks={tracks}
                    onOpenClip={openClipEditor}
                    onCreateDrumClip={handleAddNewClip}
                  />
                )}
              </div>
            )}

            {/* ── MELODY VIEW ────────────────────────────────────────── */}
            {activeView === 'melody' && (
              <div className="p-3 pb-6 flex flex-col gap-3">
                {editorClip && editorClip.type === 'midi-instrument' ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActiveView('song')}
                          className="p-2 rounded-xl bg-white/5 text-slate-400
                            active:scale-95 touch-manipulation"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">Melody Editor</h2>
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold">
                        {editorTrack?.name}
                      </span>
                    </div>
                    <PianoRoll
                      clip={editorClip}
                      onUpdateClip={updated => updateClipNotes(updated.id, updated.notes as Note[])}
                      onStartUpdate={() => saveToHistory(tracks, clips)}
                      instrumentId={(editorTrack?.instrumentId || 'piano') as any}
                    />
                  </>
                ) : (
                  <MelodyPickerView
                    clips={clips}
                    tracks={tracks}
                    onOpenClip={openClipEditor}
                    onCreateMelodyClip={handleAddNewClip}
                  />
                )}
              </div>
            )}

            {/* ── MIX VIEW ───────────────────────────────────────────── */}
            {activeView === 'mix' && (
              <div className="p-3 pb-6 flex flex-col gap-3">
                <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">Mixer</h2>
                {tracks.map(track => (
                  <div key={track.id}
                    className="bg-slate-900/80 rounded-2xl border border-white/5 p-4 flex flex-col gap-3">
                    {/* Track header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: track.color }} />
                        <span className="text-sm font-black text-white">{track.name}</span>
                        <span className="text-[9px] text-slate-500 uppercase">
                          {track.type === 'drum-machine' ? 'drums' : track.instrumentId}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleMute(track.id)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase touch-manipulation',
                            track.muted
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-white/5 text-slate-400 border border-white/5'
                          )}
                        >{track.muted ? 'Muted' : 'Mute'}</button>
                        <button
                          onClick={() => handleToggleSolo(track.id)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase touch-manipulation',
                            track.soloed
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-white/5 text-slate-400 border border-white/5'
                          )}
                        >{track.soloed ? 'Solo ON' : 'Solo'}</button>
                      </div>
                    </div>

                    {/* Volume */}
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-500 uppercase w-16">Volume</span>
                      <input type="range" min="-40" max="0" step="1" value={track.volume}
                        onChange={e => handleUpdateTrackVolume(track.id, Number(e.target.value))}
                        className="flex-1 accent-sky-500" />
                      <span className="text-[10px] font-mono text-slate-400 w-8 text-right">
                        {track.volume}db
                      </span>
                    </div>

                    {/* FX sliders */}
                    {([
                      { key: 'reverb'     as const, label: 'Space',  accent: 'accent-indigo-500' },
                      { key: 'delay'      as const, label: 'Echo',   accent: 'accent-sky-500'    },
                      { key: 'bitcrusher' as const, label: 'Robot',  accent: 'accent-emerald-500'},
                      { key: 'filter'     as const, label: 'Muffle', accent: 'accent-pink-500'   },
                    ] as const).map(fx => (
                      <div key={fx.key} className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-slate-500 uppercase w-16">{fx.label}</span>
                        <input type="range" min="0" max="1" step="0.01"
                          value={track.fx[fx.key]}
                          onChange={e => handleUpdateTrackFX(track.id, fx.key, Number(e.target.value))}
                          className={cn('flex-1', fx.accent)} />
                        <span className="text-[10px] font-mono text-slate-400 w-8 text-right">
                          {Math.round(track.fx[fx.key] * 100)}%
                        </span>
                      </div>
                    ))}

                    <button
                      onClick={() => handleDeleteTrack(track.id)}
                      className="self-end text-[9px] font-black text-red-500/40
                        hover:text-red-400 uppercase tracking-widest touch-manipulation"
                    >
                      Delete Track
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── SOUNDS VIEW ────────────────────────────────────────── */}
            {activeView === 'sounds' && (
              <div className="p-3 pb-6 flex flex-col gap-4">
                <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">Add Instrument</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {INSTRUMENT_LIST.map(inst => (
                    <button
                      key={inst.id}
                      onClick={() => handleCreateNewTrack('midi-instrument', inst.id)}
                      className="flex flex-col items-center gap-2 p-4
                        bg-slate-900/80 rounded-2xl border border-white/5
                        hover:border-white/20 active:scale-95 touch-manipulation transition-all"
                    >
                      <span className="text-3xl">{inst.emoji}</span>
                      <span className="text-xs font-black text-white uppercase">{inst.name}</span>
                      <span className="text-[9px] text-slate-500 font-bold">+ Add Track</span>
                    </button>
                  ))}
                  <button
                    onClick={() => handleCreateNewTrack('drum-machine')}
                    className="flex flex-col items-center gap-2 p-4
                      bg-slate-900/80 rounded-2xl border border-white/5
                      hover:border-white/20 active:scale-95 touch-manipulation transition-all"
                  >
                    <span className="text-3xl">🥁</span>
                    <span className="text-xs font-black text-white uppercase">Drums</span>
                    <span className="text-[9px] text-slate-500 font-bold">+ Add Track</span>
                  </button>
                </div>

                <div>
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3">
                    Your Tracks
                  </h3>
                  {tracks.map(track => (
                    <div key={track.id} className="flex items-center gap-3 py-3 border-b border-white/5">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
                        style={{ background: track.color + '22', border: `1px solid ${track.color}44` }}
                      >
                        {track.type === 'drum-machine'
                          ? '🥁'
                          : INSTRUMENT_LIST.find(i => i.id === track.instrumentId)?.emoji || '🎵'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-black text-white truncate">{track.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {track.type === 'drum-machine' ? 'Drum Machine' : track.instrumentId}
                        </div>
                      </div>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: track.color }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Bottom Navigation ─────────────────────────────────────────────── */}
      <nav className="shrink-0 z-40 flex items-stretch
        bg-slate-900/95 border-t border-white/10 backdrop-blur-md">
        {NAV_ITEMS.map(item => (
          <button
            key={item.view}
            onTouchEnd={(e) => { e.preventDefault(); setActiveView(item.view); }}
            onClick={() => setActiveView(item.view)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center py-3 gap-0.5',
              'text-[10px] font-black uppercase tracking-wider transition-colors',
              'active:bg-white/5 touch-manipulation',
              activeView === item.view
                ? 'text-sky-400 border-t-2 border-sky-400'
                : 'text-slate-500 border-t-2 border-transparent'
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

    </div>
  );
}

// ── Helper sub-views ───────────────────────────────────────────────────────

function BeatsPickerView({
  clips, tracks, onOpenClip, onCreateDrumClip
}: {
  clips: Clip[];
  tracks: Track[];
  onOpenClip: (clip: Clip) => void;
  onCreateDrumClip: (trackId: string, startTime: number) => void;
}) {
  const drumClips  = clips.filter(c => c.type === 'drum-machine');
  const drumTracks = tracks.filter(t => t.type === 'drum-machine');
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">Beat Editor</h2>
      <p className="text-sm text-slate-500">Tap a beat clip to start editing.</p>
      {drumClips.map(clip => {
        const track = tracks.find(t => t.id === clip.trackId);
        return (
          <button key={clip.id} onClick={() => onOpenClip(clip)}
            className="flex items-center gap-3 p-4 bg-slate-900/80 rounded-2xl border border-white/5
              hover:border-sky-500/30 active:scale-95 touch-manipulation transition-all text-left">
            <span className="text-2xl">🥁</span>
            <div className="flex-1">
              <div className="text-sm font-black text-white">{track?.name ?? 'Drums'}</div>
              <div className="text-[10px] text-slate-500">
                {clip.notes.length} hits · {clip.duration / 4} bars
              </div>
            </div>
            <span className="text-sky-400 text-xs font-black">Edit →</span>
          </button>
        );
      })}
      {drumClips.length === 0 && drumTracks.length > 0 && (
        <button
          onClick={() => onCreateDrumClip(drumTracks[0].id, 0)}
          className="flex items-center justify-center gap-2 p-4 bg-sky-500/10 rounded-2xl
            border border-sky-500/30 text-sky-400 font-black text-sm active:scale-95 touch-manipulation"
        >
          <Plus className="w-4 h-4" /> Create Beat Clip
        </button>
      )}
      {drumTracks.length === 0 && (
        <p className="text-xs text-slate-600 italic">
          No drum tracks yet. Add one in the Sounds tab.
        </p>
      )}
    </div>
  );
}

function MelodyPickerView({
  clips, tracks, onOpenClip, onCreateMelodyClip
}: {
  clips: Clip[];
  tracks: Track[];
  onOpenClip: (clip: Clip) => void;
  onCreateMelodyClip: (trackId: string, startTime: number) => void;
}) {
  const melodyClips  = clips.filter(c => c.type === 'midi-instrument');
  const melodyTracks = tracks.filter(t => t.type === 'midi-instrument');
  const EMOJI: Record<string, string> = {
    piano: '🎹', synth: '🎛️', guitar: '🎸', chiptune: '👾', glockenspiel: '🔔'
  };
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">Melody Editor</h2>
      <p className="text-sm text-slate-500">Tap a melody clip to start editing.</p>
      {melodyClips.map(clip => {
        const track = tracks.find(t => t.id === clip.trackId);
        const emoji = EMOJI[track?.instrumentId || 'piano'] || '🎵';
        return (
          <button key={clip.id} onClick={() => onOpenClip(clip)}
            className="flex items-center gap-3 p-4 bg-slate-900/80 rounded-2xl border border-white/5
              hover:border-sky-500/30 active:scale-95 touch-manipulation transition-all text-left">
            <span className="text-2xl">{emoji}</span>
            <div className="flex-1">
              <div className="text-sm font-black text-white">{track?.name ?? 'Melody'}</div>
              <div className="text-[10px] text-slate-500">
                {clip.notes.length} notes · {clip.duration / 4} bars
              </div>
            </div>
            <span className="text-sky-400 text-xs font-black">Edit →</span>
          </button>
        );
      })}
      {melodyClips.length === 0 && melodyTracks.length > 0 && (
        <button
          onClick={() => onCreateMelodyClip(melodyTracks[0].id, 0)}
          className="flex items-center justify-center gap-2 p-4 bg-sky-500/10 rounded-2xl
            border border-sky-500/30 text-sky-400 font-black text-sm active:scale-95 touch-manipulation"
        >
          <Plus className="w-4 h-4" /> Create Melody Clip
        </button>
      )}
      {melodyTracks.length === 0 && (
        <p className="text-xs text-slate-600 italic">
          No melody tracks yet. Add one in the Sounds tab.
        </p>
      )}
    </div>
  );
}
