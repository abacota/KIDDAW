/**
 * Stick notation for one rhythm figure, the way it's written on the board:
 * stems for sounds, beams joining ti's and ki's, a squiggle for rest.
 */

import { FIGURE_INFO, type Figure } from '../song/rhythm';

/** Which stems a second beam joins, for figures with sixteenths. */
const SECOND_BEAMS: Partial<Record<Figure, [number, number]>> = {
  'ta-ka-ti-ki': [0, 3],
  'ta-ti-ki': [1, 2],
  'ta-ka-ti': [0, 1],
};

export function Sticks({ figure, showSyllables = true, className = '' }: { figure: Figure; showSyllables?: boolean; className?: string }) {
  const info = FIGURE_INFO[figure];
  const width = info.beats === 2 ? 120 : 60;
  const height = showSyllables ? 64 : 46;
  const top = 6;
  const bottom = 40;

  if (figure === 'rest') {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className={className} aria-label="rest">
        <path
          d="M 27 8 L 35 18 L 28 26 L 35 34 Q 26 30 28 40"
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const count = info.sounds.length;
  const pad = 14;
  const xs = count === 1 ? [figure === 'ta-ah' ? 40 : width / 2] : info.sounds.map((_, i) => pad + (i * (width - 2 * pad)) / (count - 1));
  const second = SECOND_BEAMS[figure];
  const syllableXs = figure === 'ta-ah' ? [xs[0], 90] : xs;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} aria-label={figure}>
      {xs.map(x => (
        <line key={x} x1={x} y1={top} x2={x} y2={bottom} stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
      ))}
      {count > 1 && <line x1={xs[0]} y1={top} x2={xs[count - 1]} y2={top} stroke="currentColor" strokeWidth={5} />}
      {second && <line x1={xs[second[0]]} y1={top + 8} x2={xs[second[1]]} y2={top + 8} stroke="currentColor" strokeWidth={5} />}
      {figure === 'ta-ah' && (
        <ellipse cx={xs[0] - 7} cy={bottom} rx={9} ry={6.5} fill="none" stroke="currentColor" strokeWidth={3.5} transform={`rotate(-20 ${xs[0] - 7} ${bottom})`} />
      )}
      {showSyllables &&
        info.syllables.map((s, i) => (
          <text key={i} x={syllableXs[i]} y={height - 3} textAnchor="middle" fontSize={15} fontWeight={800} fill="currentColor">
            {s}
          </text>
        ))}
    </svg>
  );
}
