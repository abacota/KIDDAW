export function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

export function snapToGrid(value: number, resolution: number): number {
  return Math.round(value / resolution) * resolution;
}

export function checkClipCollision(
  clips: { id: string; trackId: string; startTime: number; duration: number }[],
  candidate: { id: string; trackId: string; startTime: number; duration: number }
): boolean {
  return clips.some(c => {
    if (c.id === candidate.id || c.trackId !== candidate.trackId) return false;
    const cEnd = c.startTime + c.duration;
    const candEnd = candidate.startTime + candidate.duration;
    return candidate.startTime < cEnd && candEnd > c.startTime;
  });
}
