# KIDDAW

A free music studio for K-5 that runs in the browser on school Chromebooks, organized by the elements of music.
See [PLAN.md](PLAN.md) for what it is, who it's for, and the phases.

## Where things are

| Folder | What's in it |
|---|---|
| `settings/ladders.txt` | The ladders and levels. Plain text; edit it without code. |
| `settings/levels.txt` | How many beats and sounds each level gets. Plain text too. |
| `src/song` | What a song is, and song links |
| `src/engine` | The sound engine and the instruments |
| `src/saving` | My songs, and song links in web addresses |
| `src/settings` | Reads the ladders file |
| `src/tools` | The screens |

## Running it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000.

## The automatic check

```bash
npm run check
```

It runs the type check, the tests, a full build, and the word check (no "ti" + "-ti" anywhere students can see).
It runs on every save to GitHub, and Vercel runs it before every deploy, so a broken version never reaches students.
