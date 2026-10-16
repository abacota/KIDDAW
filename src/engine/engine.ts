/**
 * The sound engine: plays a song on Tone.js's clock.
 *
 * Screens never make sound or keep time. They hand the engine a song and press
 * play; the engine does the rest. Every sixteenth note the clock wakes up, looks
 * at the latest song, and schedules exactly what falls in that sixteenth, so
 * changes are heard right away and screen redraws can't disturb the beat.
 *
 * The engine also does the engineering students never see: each layer gets its
 * own channel, a little shared room sound, and a compressor and limiter on the
 * whole song so stacked layers don't distort.
 */

import * as Tone from 'tone';
import { TICKS_PER_BEAT, type Song } from '../song/song';
import { buildTimeline, eventsByWindow, songTickAt, WINDOW, type PlayEvent, type Timeline } from './timeline';
import { createVoice, type Voice } from './voices';

export type Status = 'stopped' | 'playing' | 'paused';

export interface EngineState {
  status: Status;
}

export interface TimingStats {
  /** Sixteenth notes the clock reached too late to play on time. Should stay 0. */
  late: number;
  /** The smallest head start the clock had, in milliseconds. Bigger is safer. */
  closestMs: number;
}

interface Track {
  sound: string;
  voice: Voice;
  channel: Tone.Channel;
}

/** Tone.js counts 192 ticks per beat; songs count 48. */
const CLOCK_TICKS_PER_SONG_TICK = 192 / TICKS_PER_BEAT;
const ROOM_SEND_DB = -18;
const MASTER_GAIN_DB = 4;

/** Layer volume 0-100 to decibels, on a curve that sounds even to the ear. */
export function volumeToDb(volume: number): number {
  return volume <= 0 ? -80 : 40 * Math.log10(volume / 100);
}

class Engine {
  private song: Song | null = null;
  private timeline: Timeline = { events: [], sections: [], length: 0 };
  private windows = new Map<number, PlayEvent[]>();
  private tracks = new Map<string, Track>();
  private previewVoices = new Map<string, Voice>();
  private master: Tone.Gain | null = null;
  /** The audio context the engine was built in. It keeps using this one clock, even while a song is being rendered offline. */
  private context: Tone.BaseContext | null = null;
  private repeatId: number | null = null;
  private from = 0;
  private loop: { start: number; end: number } | null = null;
  private ending = false;
  private state: EngineState = { status: 'stopped' };
  private listeners = new Set<() => void>();
  private stats: TimingStats = { late: 0, closestMs: Infinity };

  constructor() {
    if (typeof document !== 'undefined') {
      // A hidden tab can't keep time reliably, so the music pauses until the student comes back.
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state.status === 'playing') this.pause();
      });
    }
  }

  // ── For screens ────────────────────────────────────────────────────────

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): EngineState => this.state;

  getTimingStats(): TimingStats {
    return { ...this.stats };
  }

  /** Hand the engine the latest song. Safe to call on every change, even while playing. */
  setSong(song: Song): void {
    this.song = song;
    this.timeline = buildTimeline(song);
    this.windows = eventsByWindow(this.timeline.events);
    if (this.context) {
      this.syncTracks();
      this.context.transport.bpm.value = song.tempo;
    }
  }

  /** Loop part of the song (in ticks), or pass null to play the song once and stop. */
  setLoop(loop: { start: number; end: number } | null): void {
    this.loop = loop;
  }

  /**
   * Start or resume. Call it straight from a tap or click: browsers only allow
   * sound to start from something the student did.
   */
  async play(fromTick = 0): Promise<void> {
    await Tone.start();
    if (!this.song) return;
    if (this.state.status === 'playing') return;
    const context = this.buildMaster();
    this.syncTracks();
    const transport = context.transport;
    transport.bpm.value = this.song.tempo;
    if (this.state.status !== 'paused') {
      this.from = fromTick;
      this.ending = false;
    }
    if (this.repeatId === null) {
      this.repeatId = transport.scheduleRepeat(this.onClock, `${WINDOW * CLOCK_TICKS_PER_SONG_TICK}i`, 0);
    }
    transport.start();
    this.setStatus('playing');
  }

  /**
   * Plays a sound right now, outside the song: tapping a row's name, or hearing
   * a beat just placed while the music is stopped. hits are [tick, length] from now.
   * Like play(), call it straight from a tap or click.
   */
  async preview(soundId: string, hits: [number, number][] = [[0, TICKS_PER_BEAT]], pitch = 60): Promise<void> {
    await Tone.start();
    const context = this.buildMaster();
    let voice = this.previewVoices.get(soundId);
    if (!voice) {
      voice = createVoice(soundId);
      voice.output.connect(this.master!);
      this.previewVoices.set(soundId, voice);
    }
    const secondsPerTick = 60 / (this.song?.tempo ?? 100) / TICKS_PER_BEAT;
    const now = context.immediate() + 0.02;
    for (const [tick, length] of hits) {
      voice.play(now + tick * secondsPerTick, pitch, length * secondsPerTick, 0.8);
    }
  }

  pause(): void {
    if (this.state.status !== 'playing' || !this.context) return;
    this.context.transport.pause();
    this.tracks.forEach(t => t.voice.stopAll());
    this.setStatus('paused');
  }

  stop(): void {
    if (this.state.status === 'stopped' || !this.context) return;
    this.context.transport.stop();
    this.tracks.forEach(t => t.voice.stopAll());
    this.setStatus('stopped');
  }

  /** Where the music is right now, in song ticks. For drawing the playhead. */
  position(): number {
    if (this.state.status === 'stopped' || !this.context) return this.from;
    const { transport } = this.context;
    const clock = transport.getTicksAtTime(this.context.immediate()) / CLOCK_TICKS_PER_SONG_TICK;
    return songTickAt(clock, this.from, this.loop);
  }

  // ── Inside the engine ──────────────────────────────────────────────────

  private setStatus(status: Status): void {
    this.state = { status };
    this.listeners.forEach(l => l());
  }

  /** Runs every sixteenth note, a little ahead of time, with the exact audio time of that sixteenth. */
  private onClock = (time: number): void => {
    const context = this.context;
    if (!context) return;
    const headStart = time - context.immediate();
    this.stats.closestMs = Math.min(this.stats.closestMs, headStart * 1000);
    if (headStart < 0) this.stats.late++;

    const clock = context.transport.getTicksAtTime(time) / CLOCK_TICKS_PER_SONG_TICK;
    const tick = songTickAt(clock, this.from, this.loop);
    if (!this.loop && tick >= this.timeline.length) {
      if (!this.ending) {
        this.ending = true;
        context.draw.schedule(() => this.stop(), time);
      }
      return;
    }

    const window = Math.round(tick / WINDOW);
    const events = this.windows.get(window);
    if (!events) return;
    const secondsPerTick = 60 / context.transport.bpm.value / TICKS_PER_BEAT;
    for (const event of events) {
      const track = this.tracks.get(event.layerId);
      if (!track) continue;
      const at = time + (event.tick - window * WINDOW) * secondsPerTick;
      try {
        track.voice.play(at, event.pitch, event.length * secondsPerTick, event.velocity);
      } catch (err) {
        console.warn('A note could not play', err);
      }
    }
  };

  private buildMaster(): Tone.BaseContext {
    if (this.context) return this.context;
    const context = Tone.getContext();
    // Bring the song up to a good level for small Chromebook speakers. The
    // compressor and limiter only touch the loudest moments (many layers at ff),
    // so piano stays soft and a crescendo still grows.
    const input = new Tone.Gain(Tone.dbToGain(MASTER_GAIN_DB));
    const compressor = new Tone.Compressor({ threshold: -6, ratio: 4, attack: 0.003, release: 0.15 });
    const limiter = new Tone.Limiter(-1);
    input.chain(compressor, limiter, Tone.getDestination());

    const room = new Tone.Reverb({ decay: 1.8, preDelay: 0.01, wet: 1 });
    const roomBus = new Tone.Channel();
    roomBus.receive('room');
    roomBus.chain(room, input);
    this.master = input;
    this.context = context;
    return context;
  }

  /** Makes the engine's channels match the song's layers. */
  private syncTracks(): void {
    const song = this.song;
    const master = this.master;
    if (!song || !master) return;

    const wanted = new Set(song.layers.map(l => l.id));
    for (const [id, track] of this.tracks) {
      if (!wanted.has(id)) {
        track.voice.dispose();
        track.channel.dispose();
        this.tracks.delete(id);
      }
    }

    for (const layer of song.layers) {
      let track = this.tracks.get(layer.id);
      if (!track) {
        const channel = new Tone.Channel().connect(master);
        channel.send('room', ROOM_SEND_DB);
        track = { sound: '', voice: createVoice(layer.sound), channel };
        track.voice.output.connect(channel);
        track.sound = layer.sound;
        this.tracks.set(layer.id, track);
      } else if (track.sound !== layer.sound) {
        track.voice.dispose();
        track.voice = createVoice(layer.sound);
        track.voice.output.connect(track.channel);
        track.sound = layer.sound;
      }
      track.channel.volume.rampTo(volumeToDb(layer.volume), 0.05);
      track.channel.pan.rampTo(layer.pan / 100, 0.05);
      track.channel.mute = layer.muted;
      track.channel.solo = layer.solo;
    }
  }
}

export const engine = new Engine();
