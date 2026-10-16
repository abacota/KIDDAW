/**
 * Phase 0's only screen: a check page for Adam to open on a student Chromebook.
 * It proves the foundation works there: sound, steady timing, song links and saving.
 * Students never see it; the real studios replace it in Phase 1.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { engine, type TimingStats } from '../engine/engine';
import { buildTimeline, sectionAt } from '../engine/timeline';
import { readSongAddress, songAddress } from '../saving/links';
import { browserStorage, createShelf, type SavedSong } from '../saving/shelf';
import { LADDERS } from '../settings/ladders';
import { demoSong } from '../song/demo';
import type { Song } from '../song/song';
import { usePlayhead, useEngineState } from './useEngine';

const shelf = createShelf(browserStorage());

type Source = 'demo' | 'link' | 'broken-link' | 'saved';

function Card({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="mb-3 text-lg font-bold">
        <span className="mr-2 text-sky-400">{step}.</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Button({ onClick, children, primary }: { onClick: () => void; children: ReactNode; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={
        'rounded-xl px-4 py-2 font-semibold transition active:scale-95 ' +
        (primary ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'bg-slate-800 text-slate-100 hover:bg-slate-700')
      }
    >
      {children}
    </button>
  );
}

function Good({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-sm text-emerald-400">✓ {children}</p>;
}

function Warn({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-sm text-amber-400">{children}</p>;
}

export function FoundationCheck() {
  const [song, setSong] = useState<Song>(demoSong);
  const [source, setSource] = useState<Source>('demo');
  const [loopIndex, setLoopIndex] = useState<number | null>(null);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<SavedSong[]>(() => shelf.list());
  const [saveFailed, setSaveFailed] = useState(false);
  const [timing, setTiming] = useState<TimingStats>(engine.getTimingStats());

  const { status } = useEngineState();
  const tick = usePlayhead(status === 'playing');
  const timeline = useMemo(() => buildTimeline(song), [song]);
  const playingSection = status === 'stopped' ? undefined : sectionAt(timeline, tick);

  useEffect(() => engine.setSong(song), [song]);

  // A song link opens its song, including one pasted into this same tab.
  useEffect(() => {
    const open = async () => {
      const found = await readSongAddress(window.location.hash);
      if (found.kind === 'song') {
        engine.stop();
        setSong(found.song);
        setSource('link');
      } else if (found.kind === 'broken') {
        setSource('broken-link');
      }
    };
    void open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTiming(engine.getTimingStats()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const toggleLoop = (formIndex: number) => {
    const span = timeline.sections[formIndex];
    if (loopIndex === formIndex || !span) {
      setLoopIndex(null);
      engine.setLoop(null);
    } else {
      setLoopIndex(formIndex);
      engine.setLoop({ start: span.start, end: span.start + span.length });
    }
  };

  const toggleMute = (layerId: string) =>
    setSong(s => ({ ...s, layers: s.layers.map(l => (l.id === layerId ? { ...l, muted: !l.muted } : l)) }));

  const makeLink = useCallback(async () => {
    const address = await songAddress(song, window.location.origin + window.location.pathname);
    setLink(address);
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [song]);

  const save = () => {
    const ok = shelf.save(song);
    setSaveFailed(!ok);
    setSaved(shelf.list());
  };

  const open = (id: string) => {
    const loaded = shelf.load(id);
    if (!loaded) return;
    engine.stop();
    setSong(loaded);
    setSource('saved');
  };

  const remove = (id: string) => {
    shelf.remove(id);
    setSaved(shelf.list());
  };

  const progress = timeline.length > 0 ? Math.min(1, tick / timeline.length) : 0;
  const stepCount = LADDERS.ladders.reduce((n, l) => n + l.steps.length, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <header>
        <h1 className="text-3xl font-black tracking-tight">KIDDAW</h1>
        <p className="text-slate-400">
          Foundation check, test version. This page checks that sound, song links and saving work on this Chromebook.
          Students don't see it.
        </p>
      </header>

      <Card step={1} title="Sound">
        <p className="mb-3 text-slate-300">
          {song.name}
          {source === 'link' && <span className="text-emerald-400"> (opened from a song link)</span>}
          {source === 'saved' && <span className="text-sky-400"> (opened from My songs)</span>}
        </p>
        {source === 'broken-link' && <Warn>That song link is broken or cut short, so this is the demo song instead.</Warn>}

        <div className="flex flex-wrap items-center gap-3">
          <Button primary onClick={() => (status === 'playing' ? engine.stop() : void engine.play())}>
            {status === 'playing' ? '■ Stop' : '▶ Play'}
          </Button>
          <div className="flex gap-2">
            {timeline.sections.map(s => (
              <button
                key={s.formIndex}
                onClick={() => toggleLoop(s.formIndex)}
                title="Tap to loop this section"
                className={
                  'h-10 w-10 rounded-lg text-lg font-black transition ' +
                  (playingSection?.formIndex === s.formIndex ? 'bg-amber-400 text-slate-950 ' : 'bg-slate-800 ') +
                  (loopIndex === s.formIndex ? 'ring-2 ring-sky-400' : '')
                }
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full bg-sky-400" style={{ width: `${progress * 100}%` }} />
        </div>
        {status === 'paused' && <Warn>Paused because the tab was hidden. Tap Play to keep going.</Warn>}
        <p className="mt-2 text-sm text-slate-400">
          Tap a section letter to loop it. Tap it again to hear the whole song.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {song.layers.map(l => (
            <button
              key={l.id}
              onClick={() => toggleMute(l.id)}
              className={'rounded-lg px-3 py-1 text-sm ' + (l.muted ? 'bg-slate-800 text-slate-500 line-through' : 'bg-slate-700')}
            >
              {l.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-400">Tap a layer to hear the song without it.</p>

        {timing.late === 0 ? (
          <Good>
            Steady time: no late beats
            {Number.isFinite(timing.closestMs) && ` (closest call ${Math.round(timing.closestMs)} ms ahead)`}
          </Good>
        ) : (
          <Warn>{timing.late} sixteenth notes came in late on this Chromebook.</Warn>
        )}
      </Card>

      <Card step={2} title="Song link">
        <Button onClick={makeLink}>Copy a link to this song</Button>
        {link && (
          <>
            {copied && <Good>Copied. Paste it into a new tab to open this song.</Good>}
            <input
              readOnly
              value={link}
              onFocus={e => e.currentTarget.select()}
              className="mt-2 w-full rounded-lg bg-slate-950 px-3 py-2 font-mono text-xs text-slate-300"
            />
            <p className="mt-1 text-xs text-slate-500">{link.length} letters long</p>
          </>
        )}
      </Card>

      <Card step={3} title="Saving on this Chromebook">
        {!shelf.available && <Warn>This browser won't let KIDDAW save. Is this a guest or private window?</Warn>}
        <Button onClick={save}>Save this song</Button>
        {saveFailed && <Warn>The song couldn't be saved.</Warn>}
        {saved.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {saved.map(s => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-950 px-3 py-2">
                <span>
                  {s.name}
                  <span className="ml-2 text-sm text-slate-500">saved {new Date(s.savedAt).toLocaleString()}</span>
                </span>
                <span className="flex gap-2">
                  <button onClick={() => open(s.id)} className="text-sm text-sky-400">Open</button>
                  <button onClick={() => remove(s.id)} className="text-sm text-slate-500">Remove</button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-400">No songs saved on this Chromebook yet.</p>
        )}
        <p className="mt-3 text-sm text-slate-400">
          To test: save, sign out of the Chromebook, sign back in, and open this page again. The song should still be here.
        </p>
      </Card>

      <Card step={4} title="Ladders file">
        {LADDERS.problems.length === 0 ? (
          <Good>
            {LADDERS.ladders.length} ladders, {stepCount} steps, levels {LADDERS.levels.join(', ')}
          </Good>
        ) : (
          <ul className="list-disc pl-5 text-sm text-amber-400">
            {LADDERS.problems.map(p => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </Card>
    </main>
    </div>
  );
}
