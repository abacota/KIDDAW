import React, { useState } from 'react';
import { motion } from 'motion/react';

interface StudentNameGateProps {
  onSubmit: (name: string) => void;
}

export const StudentNameGate: React.FC<StudentNameGateProps> = ({ onSubmit }) => {
  const [name, setName] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#08090E] p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900/90 border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col gap-6"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-pink-500 flex items-center justify-center text-3xl shadow-lg">
            🎧
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">KIDDAW</h1>
          <p className="text-slate-400 text-sm font-medium">What is your name?</p>
        </div>

        <label className="sr-only" htmlFor="student-name">Your name</label>
        <input
          id="student-name"
          type="text"
          autoFocus
          autoComplete="off"
          maxLength={24}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="Type your name"
          className="w-full min-h-[52px] px-4 rounded-2xl bg-black/40 border-2 border-white/10
            text-white text-lg font-bold text-center outline-none
            focus:border-sky-500 placeholder:text-slate-600"
        />

        <button
          type="button"
          disabled={!name.trim()}
          onClick={submit}
          className="w-full min-h-[52px] rounded-2xl font-black text-base uppercase tracking-wide
            bg-sky-500 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed
            active:scale-95 touch-manipulation transition-transform"
        >
          Start Making Music
        </button>
      </motion.div>
    </div>
  );
};
