import type { Track, Clip, PersistedProject } from '../types';

const VERSION = '1.0';
const KEY_PROJECT = 'kiddaw_project';
const KEY_VERSION = 'kiddaw_version';
const KEY_STUDENT = 'kiddaw_student_name';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getStudentName(): string | null {
  try { return localStorage.getItem(KEY_STUDENT); }
  catch { return null; }
}

export function setStudentName(name: string): void {
  try { localStorage.setItem(KEY_STUDENT, name.trim()); }
  catch (e) { console.warn('Could not save student name', e); }
}

export function clearStudentName(): void {
  try { localStorage.removeItem(KEY_STUDENT); } catch { /* ignore */ }
}

export function loadProject(): PersistedProject | null {
  try {
    const ver = localStorage.getItem(KEY_VERSION);
    if (ver !== VERSION) return null;
    const data = safeParse<PersistedProject>(localStorage.getItem(KEY_PROJECT));
    if (!data || !Array.isArray(data.tracks) || !Array.isArray(data.clips)) return null;
    return data;
  } catch { return null; }
}

export function saveProject(data: {
  studentName: string;
  tracks: Track[];
  clips: Clip[];
  bpm: number;
}): void {
  try {
    const payload: PersistedProject = {
      version: VERSION,
      studentName: data.studentName,
      tracks: data.tracks,
      clips: data.clips,
      bpm: data.bpm,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY_VERSION, VERSION);
    localStorage.setItem(KEY_PROJECT, JSON.stringify(payload));
  } catch (e) { console.warn('Could not save project', e); }
}

export function clearAllData(): void {
  try {
    localStorage.removeItem(KEY_PROJECT);
    localStorage.removeItem(KEY_VERSION);
    localStorage.removeItem(KEY_STUDENT);
  } catch { /* ignore */ }
}
