// Part of the automatic check: makes sure no word Adam has ruled out reaches students.
// Scans the built app (everything students download) and the settings files.
// "ti-ti" is never used; Adam's syllables are ta, ta-ti, ta-ah, ta-ka-ti-ki.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RULED_OUT = [{ pattern: /\bti-ti\b/i, instead: 'ta-ti' }];
const FOLDERS = ['dist', 'settings'];

function files(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

let problems = 0;
for (const folder of FOLDERS) {
  for (const file of files(folder)) {
    if (!/\.(html|js|css|txt|json)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const { pattern, instead } of RULED_OUT) {
      const match = text.match(new RegExp(`.{0,40}${pattern.source}.{0,40}`, 'i'));
      if (match) {
        problems++;
        console.error(`${file} uses a ruled-out word (use ${instead}): ...${match[0]}...`);
      }
    }
  }
}

if (problems > 0) process.exit(1);
console.log('Word check passed.');
