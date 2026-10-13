import { useEffect, useState, useSyncExternalStore } from 'react';
import { engine, type EngineState } from '../engine/engine';

/** The engine's state (stopped, playing, paused), kept up to date in a screen. */
export function useEngineState(): EngineState {
  return useSyncExternalStore(engine.subscribe, engine.getState);
}

/** Where the music is, in song ticks, redrawn every frame while it plays. */
export function usePlayhead(playing: boolean): number {
  const [tick, setTick] = useState(() => engine.position());
  useEffect(() => {
    if (!playing) {
      setTick(engine.position());
      return;
    }
    let frame = requestAnimationFrame(function draw() {
      setTick(engine.position());
      frame = requestAnimationFrame(draw);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  return tick;
}
