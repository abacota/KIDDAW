# Sound processing scripts

These turn free sample libraries into the small files in `public/sounds`, and write
`src/engine/sample-sets.json`. They need only macOS's built-in `afconvert` and Python.

1. `picklist.py` (drums, body percussion, piano) and `picklist2.py` (orchestra and band) list which
   files to download. They read file listings of each library saved from GitHub.
2. `fetch.py list.tsv downloads/` downloads them.
3. `spec1.py` and `spec2.py downloads/ spec.json` describe how to process each sound.
4. `process.py spec.json downloads/ public/sounds src/engine/sample-sets.json` trims, levels and converts.
   For pitched instruments it measures each note's real pitch (libraries name octaves differently),
   retunes notes more than a tenth of a semitone off, and leaves out a note whose pitch doesn't match
   its name.

Afterwards, re-measure levels (see LEVEL_DB in `src/engine/voices.ts`) and update CREDITS.md.
