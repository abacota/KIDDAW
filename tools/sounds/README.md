# Sound processing scripts

These turn free sample libraries into the small files in `public/sounds`, and write
`src/engine/sample-sets.json`. They need only macOS's built-in `afconvert` and Python.

1. `picklist.py` lists which files to download (drums, body percussion, piano).
2. `fetch.py list.tsv downloads/` downloads them.
3. `spec1.py downloads/ spec.json` describes how to process each sound.
4. `process.py spec.json downloads/ public/sounds src/engine/sample-sets.json` trims, levels and converts.

Afterwards, re-measure levels (see LEVEL_DB in `src/engine/voices.ts`) and update CREDITS.md.
