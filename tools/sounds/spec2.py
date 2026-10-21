# Processing spec for orchestra and band instruments, from what was downloaded.
import json, os, sys
dl = sys.argv[1]
VSCO = ("VSCO 2 Community Edition (Versilian Studios)", "CC0")
INSTRUMENTS = {
    "violin": ("violin", VSCO, "sustained"),
    "cello": ("cello", VSCO, "sustained"),
    "flute": ("flute", VSCO, "sustained"),
    "clarinet": ("clarinet", VSCO, "sustained"),
    "trumpet": ("trumpet", VSCO, "sustained"),
    "horn": ("horn", VSCO, "sustained"),
    "trombone": ("trombone", VSCO, "sustained"),
    "recorder": ("recorder", ("VCSL, Versilian Community Sample Library (Versilian Studios)", "CC0"), "sustained"),
    "guitar": ("nylon", ("FreePats Spanish Classical Guitar", "CC0"), "plucked"),
    "steelguitar": ("steel", ("Martin HD28 guitar by Jeff Learman (Discord SFZ GM Bank)", "CC0"), "plucked"),
    "ebass": ("ebass", ("FreePats Electric Bass YR", "CC0"), "plucked"),
    "doublebass": ("doublebass", ("D. Smolken double bass (via sfzinstruments)", "CC0"), "plucked"),
}
SHAPE = {
    "sustained": {"max_seconds": 4.0, "fade_seconds": 0.4, "release": 0.35, "tail_db": -54},
    "plucked": {"max_seconds": 4.0, "fade_seconds": 1.0, "release": 0.5, "tail_db": -54},
}
spec = {}
for sound, (folder, (source, license), shape) in INSTRUMENTS.items():
    files = sorted(os.listdir(os.path.join(dl, folder)), key=lambda n: int(n.split(".")[0]))
    notes = {n.split(".")[0]: f"{folder}/{n}" for n in files}
    spec[f"{sound}.recorded"] = {"type": "notes", "notes": notes, "detect_pitch": True, "source": source, "license": license,
                                 **SHAPE[shape]}
json.dump(spec, open(sys.argv[2], "w"), indent=1)
print(len(spec), "instruments")
