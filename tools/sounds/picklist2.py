# Download list for orchestra and band instruments: "url<TAB>local path", about 10 notes each.
import json, os, re, sys
from urllib.parse import quote
S = sys.argv[1]
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}

def midi_of(name):
    """Note name like A#3, Bb1, db3 to a number, reading the octave as written (checked by ear-free pitch detection later)."""
    m = re.match(r"([A-Ga-g])([#b]?)(-?\d)$", name)
    pc = NOTE[m.group(1).upper()] + {"#": 1, "b": -1, "": 0}[m.group(2)]
    return 12 * (int(m.group(3)) + 1) + pc

def spread(items, most=11):
    """Keeps notes spread across the range: drops neighbors closer than needed to stay under `most`."""
    items = sorted(items)
    if len(items) <= most:
        return items
    step = (len(items) - 1) / (most - 1)
    return [items[round(i * step)] for i in range(most)]

def tree(name):
    d = json.load(open(os.path.join(S, name)))
    return [t["path"] for t in d["tree"] if t.get("type") == "blob"]

out = []
def add(repo_raw, path, dest):
    out.append(f"{repo_raw}/{quote(path)}\t{dest}")

VSCO = "https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master"
vsco = tree("vsco_tree.json")
picks = {
    "violin": ("Strings/Solo Violin/Arco Vib/", r"_ArcoVib_([A-G]#?\d)_f\.wav$"),
    "cello": ("Strings/Cello Section/susvib/", r"susvib_([A-G]#?\d)_v3_1\.wav$"),
    "flute": ("Woodwinds/Flute/susvib/", r"_susvib_([A-G]#?\d)_v1_1\.wav$"),
    "clarinet": ("Woodwinds/Clarinet/susLong/", r"_susLong_([A-G]#?\d)_v2_rr1_sum\.wav$"),
    "trumpet": ("Brass/Trumpet/sus/", r"_sus_([A-G]#?\d)_v3_rr1\.wav$"),
    "horn": ("Brass/F Horn/sus/", r"_sus_([A-G]#?\d)_v2_1\.wav$"),
    "trombone": ("Brass/Tenor Trombone/sus/", r"_sus_([A-G]#?\d)_v2_1\.wav$"),
}
for inst, (folder, pattern) in picks.items():
    found = [(midi_of(re.search(pattern, p).group(1)), p) for p in vsco if p.startswith(folder) and re.search(pattern, p)]
    for midi, p in spread(found):
        add(VSCO, p, f"{inst}/{midi}.wav")

VCSL = "https://raw.githubusercontent.com/sgossner/VCSL/master"
rec = [(midi_of(re.search(r"_Sus_([A-G]#?\d)_rr1", p).group(1)), p) for p in tree("vcsl_tree.json")
       if "Baroque Soprano Recorder" in p and re.search(r"_Sus_([A-G]#?\d)_rr1_Main\.wav$", p)]
for midi, p in spread(rec):
    add(VCSL, p, f"recorder/{midi}.wav")

DB = "https://raw.githubusercontent.com/sfzinstruments/dsmolken.double-bass/master"
pz = [(midi_of(re.search(r"pizz_([a-g]b?\d)_ma\.wav$", p).group(1)), p) for p in open(os.path.join(S, "tree-dsmolken.txt")).read().split()
      if re.search(r"^pizz/pizz_([a-g]b?\d)_ma\.wav$", p)]
for midi, p in spread(pz):
    add(DB, p, f"doublebass/{midi}.wav")

SG = "https://raw.githubusercontent.com/freepats/spanish-classical-guitar/main"
sg = [(midi_of(re.search(r"samples/([A-G]#?\d)\.flac$", p).group(1)), p) for p in open(os.path.join(S, "tree-spanish.txt")).read().split("\n")
      if re.search(r"^samples/[A-G]#?\d\.flac$", p)]
for midi, p in spread(sg, 12):
    add(SG, p, f"nylon/{midi}.flac")

GM = "https://raw.githubusercontent.com/sfzinstruments/Discord-SFZ-GM-Bank/master"
for p in open(os.path.join(S, "tree-martin.txt")).read().split("\n"):
    m = re.search(r"MartinGM2_(\d{3})_", p)
    if m:
        add(GM, p, f"steel/{int(m.group(1))}.wav")

EB = "https://raw.githubusercontent.com/freepats/electric-bass-YR/main"
for name, midi in [("E", 28), ("G", 31), ("A#", 34), ("C#", 37), ("D#", 39)]:
    add(EB, f"samples/finger/{name}.flac", f"ebass/{midi}.flac")

print("\n".join(out))
