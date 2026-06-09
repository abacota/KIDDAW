import * as Tone from 'tone';

class AudioEngine {
  private static instance: AudioEngine;
  private tracks: Map<string, { 
    source: any; 
    channel: Tone.Channel;
    effects: {
      reverb: Tone.Reverb;
      delay: Tone.FeedbackDelay;
      bitcrusher: Tone.BitCrusher;
      filter: Tone.Filter;
    }
  }> = new Map();
  private recorder: Tone.Recorder = new Tone.Recorder();

  private constructor() {}

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public async start() {
    await Tone.start();
    Tone.Transport.bpm.value = 100;
  }

  public createTrack(id: string, type: string, samplerUrl?: string) {
    let source: any;
    const channel = new Tone.Channel().toDestination();

    // Initialize Effects
    const reverb = new Tone.Reverb({ decay: 4, wet: 0 }).connect(channel);
    const delay = new Tone.FeedbackDelay({ delayTime: "4n", feedback: 0.4, wet: 0 }).connect(reverb);
    const bitcrusher = new Tone.BitCrusher(4).connect(delay);
    bitcrusher.wet.value = 0;
    const filter = new Tone.Filter({ frequency: 20000, type: "lowpass" }).connect(bitcrusher);

    if (type === 'sampler' && samplerUrl) {
      source = new Tone.Sampler({
        urls: { C4: samplerUrl },
        release: 1
      });
    } else if (type === 'drum-machine') {
      source = new Tone.Sampler({
        urls: {
          C1: "https://tonejs.github.io/audio/drum-samples/CR78/kick.mp3",
          D1: "https://tonejs.github.io/audio/drum-samples/CR78/snare.mp3",
          E1: "https://tonejs.github.io/audio/drum-samples/CR78/hihat.mp3",
          F1: "https://tonejs.github.io/audio/drum-samples/CR78/clap.mp3",
          G1: "https://tonejs.github.io/audio/drum-samples/CR78/tom1.mp3"
        }
      });
    } else if (type === 'midi-instrument') {
      source = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fmtriangle' },
        envelope: { 
          attack: 0.01, 
          decay: 0.2, 
          sustain: 0.1, 
          release: 0.5 
        }
      });
    } else if (type === 'audio') {
      source = new Tone.GrainPlayer();
    } else {
      source = new Tone.Player();
    }

    source.connect(filter);
    this.tracks.set(id, { source, channel, effects: { reverb, delay, bitcrusher, filter } });
    return { source, channel };
  }

  public setEffect(id: string, effect: 'reverb' | 'delay' | 'bitcrusher' | 'filter', value: number) {
    const track = this.tracks.get(id);
    if (track) {
      const fx = track.effects[effect];
      if (effect === 'filter') {
        // Map 0-1 to 200Hz - 20000Hz
        (fx as Tone.Filter).frequency.value = 200 + (value * 19800);
      } else if (effect === 'bitcrusher') {
        // Map 0-1 to 0-1 wet, and bits 8-2
        (fx as Tone.BitCrusher).wet.value = value > 0 ? 1 : 0;
        (fx as Tone.BitCrusher).bits.value = 8 - Math.floor(value * 6);
      } else {
        (fx as any).wet.value = value;
      }
    }
  }

  public removeTrack(id: string) {
    const track = this.tracks.get(id);
    if (track) {
      track.source.dispose();
      track.channel.dispose();
      this.tracks.delete(id);
    }
  }

  public getTrack(id: string) {
    return this.tracks.get(id);
  }

  public setVolume(id: string, volume: number) {
    const track = this.tracks.get(id);
    if (track) {
      track.channel.volume.value = Tone.gainToDb(volume);
    }
  }

  public setMute(id: string, muted: boolean) {
    const track = this.tracks.get(id);
    if (track) {
      track.channel.mute = muted;
    }
  }

  public triggerNote(trackId: string, note: string, duration: string | number, time?: number) {
    const track = this.tracks.get(trackId);
    if (track && track.source.triggerAttackRelease) {
      track.source.triggerAttackRelease(note, duration, time);
    }
  }

  public triggerDrum(trackId: string, pitch: string, time?: number) {
    const track = this.tracks.get(trackId);
    if (track && track.source.triggerAttackRelease) {
      track.source.triggerAttackRelease(pitch, '16n', time);
    }
  }
}

export const engine = AudioEngine.getInstance();
