/**
 * Which screen a link opens:
 *   /k-1, /2-3, /4-5, /studio   Beat Lab at that level (the links students use)
 *   /check                      the foundation check page
 *   /                           Adam's page of level links
 */

import { useState } from 'react';
import { LEVELS, levelFromPath } from '../settings/levels';
import { BeatLab } from './BeatLab';
import { FoundationCheck } from './FoundationCheck';

export function App() {
  const path = window.location.pathname;
  if (path.replace(/\/+$/, '') === '/check') return <FoundationCheck />;
  const level = levelFromPath(path);
  if (level) return <BeatLab level={level} />;
  return <TeacherHome />;
}

function TeacherHome() {
  const [copied, setCopied] = useState('');
  const problems = LEVELS.problems;

  const copy = async (link: string) => {
    const address = `${window.location.origin}/${link}`;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(link);
    } catch {
      setCopied('');
    }
  };

  return (
    <div className="min-h-screen bg-amber-50 text-slate-900">
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
        <header>
          <h1 className="text-4xl font-black tracking-tight">KIDDAW</h1>
          <p className="mt-1 text-slate-600">
            One link per level. Put them on your Clever teacher page so students tap an icon instead of typing.
          </p>
        </header>

        {problems.length > 0 && (
          <ul className="list-disc rounded-2xl bg-rose-50 p-4 pl-8 text-sm text-rose-700">
            {problems.map(p => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        <ul className="space-y-3">
          {LEVELS.levels.map(level => (
            <li key={level.link} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <span className="w-20 text-2xl font-black">{level.name}</span>
              <span className="flex-1 text-sm text-slate-500">
                {level.beats} beats, up to {level.maxSounds} sounds · {level.figures.join(', ')}
              </span>
              <a href={`/${level.link}`} className="rounded-xl bg-amber-400 px-4 py-2 font-bold hover:bg-amber-300">
                Open
              </a>
              <button onClick={() => copy(level.link)} className="rounded-xl bg-slate-100 px-4 py-2 font-bold hover:bg-slate-200">
                {copied === level.link ? 'Copied' : 'Copy link'}
              </button>
            </li>
          ))}
        </ul>

        <p className="text-sm text-slate-500">
          <a href="/check" className="underline">Foundation check</a>: test sound, song links and saving on a Chromebook.
        </p>
      </main>
    </div>
  );
}
