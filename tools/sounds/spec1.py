# Writes the processing spec for drums, body percussion and piano from what was downloaded.
import json, os, re, sys
dl = sys.argv[1]
def files(folder):
    names = sorted(os.listdir(os.path.join(dl, folder)), key=lambda n: [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", n)])
    return [f"{folder}/{n}" for n in names]

LENGTHS = {"kick": (1.2, 0.15), "snare": (1.2, 0.2), "hihat": (0.6, 0.1), "openhat": (1.8, 0.5), "tom": (1.5, 0.4),
           "lowtom": (2.0, 0.5), "crash": (3.5, 1.2), "ride": (3.0, 1.0)}
spec = {}
for kit, source, license in [("studio", "Virtuosity Drums (Versilian Studios)", "CC0"),
                             ("rock", "MuldjordKit. Drum samples provided by DrumGizmo.org (via FreePats)", "CC BY 4.0")]:
    for sound, (secs, fade) in LENGTHS.items():
        f = files(f"{kit}/{sound}")
        if kit == "studio":
            soft, hard = f[:2], f[2:]
        else:
            soft, hard = f[:2], f[2:]
        spec[f"{sound}.{kit}"] = {"type": "hits", "layers": [soft, hard], "max_seconds": secs, "fade_seconds": fade,
                                  "source": source, "license": license}

BODY = {"clap": 0.6, "snap": 0.5, "stomp": 0.8, "chest": 0.6}
for sound, secs in BODY.items():
    f = files(f"body/{sound}")
    spec[f"{sound}.recorded"] = {"type": "hits", "layers": [f[:2], f[2:]], "max_seconds": secs, "fade_seconds": 0.08,
                                 "source": "sfzinstruments body_percussion", "license": "CC0"}
spec["pat.recorded"] = {"type": "hits", "layers": [["body/pat/pat_soft.mp3", "body/pat/pat_medium.mp3"], ["body/pat/pat_hard.mp3"]],
                        "max_seconds": 0.5, "fade_seconds": 0.08, "source": "Pipira_Piraco on Freesound (sounds 860386-860388)", "license": "CC0"}

PC = {"C": 0, "Ds": 3, "Fs": 6, "A": 9}
notes = {}
for n in os.listdir(os.path.join(dl, "piano")):
    m = re.match(r"([A-Z][s]?)(\d)\.mp3$", n)
    midi = 12 * (int(m.group(2)) + 1) + PC[m.group(1)]
    if 33 <= midi <= 96:
        notes[str(midi)] = f"piano/{n}"
spec["piano.salamander"] = {"type": "notes", "notes": dict(sorted(notes.items(), key=lambda kv: int(kv[0]))),
                            "max_seconds": 5.0, "fade_seconds": 1.2, "tail_db": -60, "release": 1.0,
                            "source": "Salamander Grand Piano V3 by Alexander Holm", "license": "CC BY 3.0"}
json.dump(spec, open(sys.argv[2], "w"), indent=1)
print(len(spec), "sound sets;", len(notes), "piano notes")
