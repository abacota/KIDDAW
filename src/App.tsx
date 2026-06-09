import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as Tone from 'tone';
import { Track, Clip, Note, DrumHit } from './types';
import { Timeline } from './components/Timeline';
import { PianoRoll } from './components/PianoRoll';
import { DrumSequencer } from './components/DrumSequencer';
import {
  cn,
  checkClipCollision,
  snapToGrid
} from './lib/utils';
import {
  setupTrackAudioChannel,
  updateTrackAudioFX,
  updateTrackVolume,
  triggerTrackNote,
  triggerDrumSound
} from './lib/audio';
import {
  Music,
  Play,
  Square,
  Undo2,
  Redo2,
  Download,
  Plus,
  Volume2,
  ListRestart,
  Sparkles,
  PartyPopper,
  Flame,
  VolumeX,
  Volume1
} from 'lucide-react';

const INITIAL_TRACKS: Track[] = [
  {
    id: 'track_drums',
    name: 'Drum Beats',
    type: 'drum-machine',
    color: '#3b82f6', // Indigo Blue
    volume: -6,
    muted: false,
    soloed: false,
    fx: { reverb: 0.1, delay: 0.05, bitcrusher: 0.0, filter: 0.95 }
  },
  {
    id: 'track_melody',
    name: 'Main Piano',
    type: 'midi-instrument',
    color: '#fbbf24', // Yellow Gold
    volume: -10,
    muted: false,
    soloed: false,
    instrumentId: 'piano',
    fx: { reverb: 0.3, delay: 0.15, bitcrusher: 0.0, filter: 0.85 }
  },
  {
    id: 'track_bass',
    name: 'Fat Synth',
    type: 'midi-instrument',
    color: '#a855f7', // Purple
    volume: -12,
    muted: false,
    soloed: false,
    instrumentId: 'synth',
    fx: { reverb: 0.1, delay: 0.0, bitcrusher: 0.1, filter: 0.6 }
  }
];

const INITIAL_CLIPS: Clip[] = [
  {
    id: 'clip_drums_1',
    trackId: 'track_drums',
    type: 'drum-machine',
    startTime: 0,
    duration: 16, // 4 beats / 1 bar
    notes: [
      { id: 'd1', pitch: 'C1', start: 0, duration: 1 }, // Kick
      { id: 'd2', pitch: 'E1', start: 2, duration: 1 }, // Hihat
      { id: 'd3', pitch: 'D1', start: 4, duration: 1 }, // Snare
      { id: 'd4', pitch: 'E1', start: 6, duration: 1 },
      { id: 'd5', pitch: 'C1', start: 8, duration: 1 },
      { id: 'd6', pitch: 'E1', start: 10, duration: 1 },
      { id: 'd7', pitch: 'D1', start: 12, duration: 1 },
      { id: 'd8', pitch: 'E1', start: 14, duration: 1 }
    ]
  },
  {
    id: 'clip_melody_1',
    trackId: 'track_melody',
    type: 'midi-instrument',
    startTime: 0,
    duration: 16,
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
  const [playbackPosition, setPlaybackPosition] = useState(0); // Tick 0 to 127 (8 bars)
  const [bpm, setBpm] = useState(120);
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Undo/Redo History States
  const [undoHistory, setUndoHistory] = useState<{ tracks: Track[]; clips: Clip[] }[]>([]);
  const [redoHistory, setRedoHistory] = useState<{ tracks: Track[]; clips: Clip[] }[]>([]);

  // Ref locks
  const sequencerIntervalRef = useRef<number | null>(null);
  const playheadIntervalRef = useRef<number | null>(null);
  const recorderRef = useRef<Tone.Recorder | null>(null);

  // Save state snapshot for linear undo calculations
  const saveToHistory = (currentTracks: Track[], currentClips: Clip[]) => {
    // Limit to 20 states max
    setUndoHistory(prev => [...prev.slice(-19), { tracks: currentTracks, clips: currentClips }]);
    setRedoHistory([]); // clear redos
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

  // Synchronize track connections and FX parameters
  useEffect(() => {
    tracks.forEach(track => {
      // Setup or recover the Tone.js object channels matching this track
      setupTrackAudioChannel(track.id, track.type, track.instrumentId);
      
      // Update its custom FX attributes
      updateTrackAudioFX(track.id, 'reverb', track.fx.reverb);
      updateTrackAudioFX(track.id, 'delay', track.fx.delay);
      updateTrackAudioFX(track.id, 'bitcrusher', track.fx.bitcrusher);
      updateTrackAudioFX(track.id, 'filter', track.fx.filter);

      // Handle muting, soloing & gain level calculations
      // If there is any track with Solo active, muted tracks should reflect that
      const hasSoloActive = tracks.some(t => t.soloed);
      let targetVol = track.volume;
      if (track.muted) {
        targetVol = -Infinity;
      } else if (hasSoloActive && !track.soloed) {
        targetVol = -Infinity; // silent due to other soloed
      }
      updateTrackVolume(track.id, targetVol);
    });
  }, [tracks]);

  // Audio Sequencer Playback Tick System
  const triggerTickSequencer = useCallback((tickPos: number) => {
    // Quantize play ticks
    setPlaybackPosition(tickPos);

    // Metronome tick clicks
    if (isMetronomeEnabled && tickPos % 4 === 0) {
      const isDownbeat = tickPos % 16 === 0;
      const freq = isDownbeat ? 1000 : 600;
      const osc = new Tone.Oscillator(freq, "triangle").toDestination();
      osc.volume.value = -12;
      osc.start().stop("+16n");
    }

    // Playback active clips notes scheduled exactly at this beat index
    clips.forEach(clip => {
      if (tickPos >= clip.startTime && tickPos < (clip.startTime + clip.duration)) {
        const relativeTick = tickPos - clip.startTime;
        
        // Find notes/drum triggers that start at this tick
        const activeNotes = clip.notes.filter(n => n.start === relativeTick);
        const parentTrack = tracks.find(t => t.id === clip.trackId);
        
        if (parentTrack) {
          activeNotes.forEach((n: any) => {
            if (parentTrack.type === 'drum-machine') {
              triggerDrumSound(n.pitch);
            } else {
              // Convert 16th duration ticks to seconds real-time span
              const tickDurationSecs = n.duration * (60 / bpm / 4);
              triggerTrackNote(parentTrack.id, n.pitch, tickDurationSecs);
            }
          });
        }
      }
    });

  }, [clips, tracks, isMetronomeEnabled, bpm]);

  // Handle Play/Stop trigger toggles
  const handleTogglePlayback = async () => {
    await Tone.start();

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
      // Sixteenth notes time interval duration calculation based on BPM:
      // Interval = (60 / BPM / 4) * 1000 ms
      const sixteenthLengthMs = (60 / bpm / 4) * 1000;
      
      triggerTickSequencer(0); // Instant play
      
      sequencerIntervalRef.current = window.setInterval(() => {
        localTick = (localTick + 1) % 128; // loop back after 8 bars (128 sixteenths max)
        triggerTickSequencer(localTick);
      }, sixteenthLengthMs);
    }
  };

  // Clean play loops on unmount
  useEffect(() => {
    return () => {
      if (sequencerIntervalRef.current) clearInterval(sequencerIntervalRef.current);
    };
  }, [isPlaying, triggerTickSequencer]);

  // Selected Clip Helper computed state
  const selectedClip = clips.find(c => c.id === selectedClipId);

  // Update notes of inside any clip
  const updateClipNotes = (clipId: string, notes: Note[] | DrumHit[]) => {
    setClips(prev => prev.map(c => c.id === clipId ? { ...c, notes } : c));
  };

  // 🛡️ Bulletproof Region Drag Shield Controller
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

    // Apply Drag Shield: Make sure mouseup/movement cannot click underlying elements
    document.body.style.pointerEvents = 'none';
    const targetElement = e.currentTarget;
    targetElement.style.pointerEvents = 'auto'; // allow dragging handle itself

    const startX = e.clientX;
    const originalStartTime = matchedClip.startTime;
    const originalDuration = matchedClip.duration;
    
    // Zoom sensitivity scale factor calculation
    // A step is dynamic zoom pixels wide
    const STEP_SIZE = 48; // timeline tick width average

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      
      if (action === 'move') {
        const gridOffset = Math.round(deltaX / STEP_SIZE);
        // Clean snap translation
        let newStart = Math.max(0, originalStartTime + gridOffset);
        // Bound to play loop scope (max 8 bars - clip duration)
        newStart = Math.min(128 - matchedClip.duration, newStart);
        
        // Check conflicts
        const candidate = { ...matchedClip, startTime: newStart };
        const otherClips = clips.filter(c => c.id !== clipId);
        const hasCollision = checkClipCollision(otherClips, candidate);

        if (!hasCollision) {
          setClips(prev => prev.map(c => c.id === clipId ? { ...c, startTime: newStart } : c));
        }
      } else {
        // Resize length operation
        const deltaTicks = Math.round(deltaX / STEP_SIZE);
        const newDuration = Math.max(4, snapToGrid(originalDuration + deltaTicks, 4)); // snap to quarter beat lengths (min 1 beat)
        
        const candidate = { ...matchedClip, duration: newDuration };
        const otherClips = clips.filter(c => c.id !== clipId);
        const hasCollision = checkClipCollision(otherClips, candidate);

        if (!hasCollision && (matchedClip.startTime + newDuration <= 128)) {
          setClips(prev => prev.map(c => c.id === clipId ? { ...c, duration: newDuration } : c));
        }
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      
      // Cleanup pointers shield
      document.body.style.pointerEvents = 'auto';
      targetElement.style.pointerEvents = 'auto';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Add a clip on timeline track
  const handleAddNewClip = (trackId: string, startTime: number) => {
    saveToHistory(tracks, clips);
    const parentTrack = tracks.find(t => t.id === trackId);
    if (!parentTrack) return;

    const newClip: Clip = {
      id: crypto.randomUUID(),
      trackId,
      type: parentTrack.type === 'drum-machine' ? 'drum-machine' : 'midi-instrument',
      startTime,
      duration: 16, // default 1 bar
      notes: []
    };

    setClips(prev => [...prev, newClip]);
    setSelectedClipId(newClip.id);
    setActiveEditor(newClip.type === 'drum-machine' ? 'drum-sequencer' : 'piano-roll');
  };

  const handleDeleteClip = (clipId: string) => {
    saveToHistory(tracks, clips);
    setClips(prev => prev.filter(c => c.id !== clipId));
    if (selectedClipId === clipId) {
      setSelectedClipId(null);
    }
  };

  const handleCreateNewTrack = () => {
    saveToHistory(tracks, clips);
    
    // Choose instrument type alternation
    const names = ['Guitar Pluck', 'Beep Synth', 'Flute Glock', 'Custom Piano'];
    const types: ('midi-instrument' | 'drum-machine')[] = ['midi-instrument', 'midi-instrument', 'midi-instrument', 'drum-machine'];
    const insts: ('guitar' | 'chiptune' | 'glockenspiel' | 'piano')[] = ['guitar', 'chiptune', 'glockenspiel', 'piano'];
    const colors = ['#f97316', '#10b981', '#ec4899', '#3b82f6'];

    const index = tracks.length % 4;

    const newTrack: Track = {
      id: crypto.randomUUID(),
      name: names[index],
      type: types[index] === 'drum-machine' ? 'drum-machine' : 'midi-instrument',
      color: colors[index],
      volume: -8,
      muted: false,
      soloed: false,
      instrumentId: insts[index],
      fx: { reverb: 0.2, delay: 0.1, bitcrusher: 0.0, filter: 0.9 }
    };

    setTracks(prev => [...prev, newTrack]);
  };

  const handleUpdateTrackFX = (
    trackId: string, 
    fxType: 'reverb' | 'delay' | 'bitcrusher' | 'filter', 
    value: number
  ) => {
    setTracks(prev => prev.map(t => t.id === trackId ? {
      ...t,
      fx: { ...t.fx, [fxType]: value }
    } : t));
  };

  const handleDeleteTrack = (trackId: string) => {
    saveToHistory(tracks, clips);
    setTracks(prev => prev.filter(t => t.id !== trackId));
    setClips(prev => prev.filter(c => c.trackId !== trackId));
  };

  // Final Bounce: Audio Export (synthesized and combined to browser download)
  const handleExportTrackSong = async () => {
    setIsExporting(true);
    await Tone.start();

    // Create master recording node
    const recorder = new Tone.Recorder();
    Tone.getDestination().connect(recorder);
    
    recorder.start();
    handleTogglePlayback(); // play

    // Wait exactly 8 bars loop (length = 8 * 4 beats * 60/bpm seconds)
    const exportLengthSecs = (8 * 4 * (60 / bpm)) * 1000;

    setTimeout(async () => {
      // Record complete
      handleTogglePlayback(); // stop
      const recordingBlob = await recorder.stop();
      const audioUrl = URL.createObjectURL(recordingBlob);
      
      // Trigger instant automatic anchor download
      const anchorNode = document.createElement('a');
      anchorNode.href = audioUrl;
      anchorNode.download = 'kiddaw_studio_beat.webm';
      document.body.appendChild(anchorNode);
      anchorNode.click();
      document.body.removeChild(anchorNode);

      setIsExporting(false);
    }, exportLengthSecs + 100);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#08090E] text-white p-4 justify-between overflow-hidden relative saturate-110">
      
      {/* 🔮 Visual Metronome Ambient Overlay (Flashes dynamically when playing loop) */}
      <div 
        className={cn(
          "fixed inset-0 pointer-events-none transition-all duration-100 z-50",
          isPlaying && (playbackPosition % 4 === 0) 
            ? "border-8 border-sky-400/20 shadow-[inset_0_0_100px_rgba(56,189,248,0.15)] ring-8 ring-sky-500/10" 
            : "border-8 border-transparent"
        )}
      />

      {/* 🚀 A. Studio Navigation Header Bar */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 py-3 px-6 bg-slate-900/80 border border-white/5 rounded-3xl backdrop-blur-md shadow-2xl relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-[#ec4899] flex items-center justify-center text-white text-xl font-black shadow-lg animate-bounce">
            🎧
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tighter uppercase sm:text-2xl text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-200 to-pink-400">
                KIDDAW LIVE
              </h1>
              <span className="text-[9px] font-black tracking-widest text-[#a855f7] uppercase px-2 py-0.5 bg-[#a855f7]/10 border border-[#a855f7]/20 rounded-full">
                Creative Studio
              </span>
            </div>
            <p className="text-[10px] text-slate-400 tracking-wide font-sans">
              Beginner-friendly visual synthesis station &amp; music workshop
            </p>
          </div>
        </div>

        {/* Studio Controls Panel */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Main Playback Toggles */}
          <div className="flex items-center bg-black/40 border border-white/5 p-1 rounded-2xl shadow-inner">
            <button
              onClick={handleTogglePlayback}
              className={cn(
                "px-5 py-2 rounded-xl flex items-center gap-2 font-black uppercase text-xs transition-all active:scale-95 shadow-md",
                isPlaying 
                  ? "bg-red-500 text-white hover:bg-red-400 shadow-red-500/10" 
                  : "bg-sky-500 text-slate-950 hover:bg-sky-400 hover:scale-101"
              )}
            >
              {isPlaying ? (
                <>
                  <Square className="w-4 h-4 fill-white" />
                  <span>Stop Loop</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Start Loop</span>
                </>
              )}
            </button>

            {/* Metronome toggler */}
            <button
              onClick={() => setIsMetronomeEnabled(!isMetronomeEnabled)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black transition-colors uppercase outline-none",
                isMetronomeEnabled ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"
              )}
              title="Toggle Metronome Clicks"
            >
              Clicks {isMetronomeEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Tempo BPM Changer */}
          <div className="flex items-center gap-2 px-3 py-1 bg-[#151722] border border-white/5 rounded-2xl font-mono text-xs font-bold text-slate-300">
            <span>TEMPO</span>
            <input 
              type="number" min="60" max="240" value={bpm}
              onChange={(e) => setBpm(Math.max(60, Math.min(240, Number(e.target.value))))}
              className="w-14 bg-black/40 border border-white/11 rounded-lg py-1 px-1.5 font-bold text-center text-white text-xs outline-none focus:border-sky-500"
            />
            <span>BPM</span>
          </div>

          {/* Undo / Redo controllers */}
          <div className="flex gap-1">
            <button
              onClick={handleUndo}
              disabled={undoHistory.length === 0}
              className="p-2.5 bg-slate-800 border-2 border-white/5 hover:border-white/10 rounded-xl hover:bg-slate-700 transition-all text-slate-300 disabled:opacity-30 active:scale-95 outline-none font-bold"
              title="Undo Action"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={redoHistory.length === 0}
              className="p-2.5 bg-slate-800 border-2 border-white/5 hover:border-white/10 rounded-xl hover:bg-slate-700 transition-all text-slate-300 disabled:opacity-30 active:scale-95 outline-none font-bold"
              title="Redo Action"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Bouncing Audio button */}
          <button
            onClick={handleExportTrackSong}
            disabled={isExporting}
            className={cn(
              "px-5 py-2.5 rounded-xl flex items-center gap-2 font-black text-xs uppercase shadow-md active:scale-95 transition-all outline-none border border-transparent",
              isExporting 
                ? "bg-purple-600 text-white shadow-purple-500/20" 
                : "bg-gradient-to-r from-[#ec4899] to-[#818cf8] text-white hover:brightness-110 active:brightness-95"
            )}
          >
            {isExporting ? (
              <>
                <ListRestart className="w-4 h-4 animate-spin" />
                <span>Bouncing Audio...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Save Beat (WebM)</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* 🌟 B. Middle Workstations (Timeline Layout) */}
      <section className="flex-1 flex flex-col gap-4 overflow-hidden relative mt-4 h-[420px]" style={{ minHeight: '180px' }}>
        
        {/* Track operations control bar */}
        <div className="flex justify-between items-center px-4 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black uppercase text-slate-400 tracking-space">Arrangement Grid</h3>
            <span className="text-[10px] text-slate-500 italic">&bull; Click lane twice to place loops &bull; Playhead reflects current output bar</span>
          </div>
          <button
            onClick={handleCreateNewTrack}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl border border-[#3b82f6]/30 text-sky-400 hover:text-sky-300 font-extrabold text-[11px] bg-sky-500/5 hover:bg-sky-500/10 active:scale-95 transition-all outline-none"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Instrument Track</span>
          </button>
        </div>

        {/* The Audio Timeline */}
        <Timeline
          tracks={tracks}
          clips={clips}
          zoom={48} // standardized width
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
      </section>

      {/* 🌟 C. Bottom Sequencer Panel Window (Piano roll / Drums sequencer) */}
      <section className="h-[380px] shrink-0 mt-4 overflow-hidden flex flex-col" style={{ minHeight: '340px' }}>
        
        {/* Editor selector header */}
        <div className="flex justify-between items-center py-2 px-4 bg-slate-900 border border-white/5 rounded-t-3xl border-b-0 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 select-glow animate-ping" />
            <span className="text-xs font-black uppercase text-slate-400 tracking-wide">
              Selected Clip Editor
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => selectedClip && setActiveEditor(selectedClip.type === 'drum-machine' ? 'drum-sequencer' : 'piano-roll')}
              className={cn(
                "px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-colors outline-none",
                activeEditor ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-500 hover:bg-slate-700"
              )}
            >
              Active
            </button>
            <button
              onClick={() => setActiveEditor(null)}
              className="text-[10px] font-black text-slate-500 hover:text-slate-300 px-2 py-1 outline-none"
            >
              Collapse Editor ✕
            </button>
          </div>
        </div>

        {/* Render Active Editor component dynamically */}
        <div className="flex-1 overflow-hidden shrink-0 bg-slate-950/20 border-x border-b border-white/5 rounded-b-3xl h-full min-h-0">
          <AnimatePresence mode="wait">
            {activeEditor && selectedClip ? (
              <motion.div
                key={selectedClipId || 'no_ed'}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="h-full flex flex-col justify-between"
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
              <div className="h-full flex flex-col justify-center items-center text-slate-600 font-sans italic gap-2 py-12">
                <span>🎵 Double-click any Clip loop in the Arrangement Grid above to open the Editor! 🎵</span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#4f46e5]/40 mt-1">
                  Piano Roll with Virtual Instruments &bull; 5-Lane Drum Sequencer
                </span>
              </div>
            )}
          </AnimatePresence>
        </div>

      </section>

    </div>
  );
}
