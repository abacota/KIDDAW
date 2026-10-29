/**
 * Draws a beat as standard notation with abcjs (https://github.com/paulrosen/abcjs, MIT).
 * abcjs is fairly large, so it loads the first time notation is shown, not with the page.
 */

import { useEffect, useRef, useState } from 'react';
import { beatToAbc } from '../song/notation';
import type { Song } from '../song/song';

type Abcjs = typeof import('abcjs');
let loading: Promise<Abcjs> | null = null;
const loadAbcjs = () => (loading ??= import('abcjs').then(m => (m.default ?? m) as Abcjs));

export function StaffView({ song }: { song: Song }) {
  const target = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadAbcjs()
      .then(abcjs => {
        if (!alive || !target.current) return;
        abcjs.renderAbc(target.current, beatToAbc(song), {
          responsive: 'resize',
          add_classes: true,
          paddingtop: 0,
          paddingbottom: 0,
          paddingleft: 0,
          paddingright: 0,
        });
        setReady(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [song]);

  return (
    <div className="mt-4 rounded-2xl border-2 border-slate-100 bg-white p-3">
      {failed && <p className="text-sm font-bold text-rose-500">The notes couldn't load. Check the internet connection.</p>}
      {!ready && !failed && <p className="text-sm text-slate-400">Loading notes...</p>}
      <div ref={target} aria-label="Your beat in standard notation" />
    </div>
  );
}
