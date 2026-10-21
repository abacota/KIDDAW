# Turns downloaded recordings into small, tidy files for KIDDAW.
#
# For every sound in the spec: decode to mono 44.1 kHz, cut the silence before the
# hit, trim the tail where it fades out and fade it smoothly, set the whole sound
# (all its velocity layers together) to the same peak level, and encode as AAC.
#
# Usage: python3 -I process.py spec.json downloads_dir output_dir manifest.json

import array, json, math, os, subprocess, sys, tempfile, wave

spec_path, dl_root, out_root, manifest_path = sys.argv[1:5]
spec = json.load(open(spec_path))
tmp = tempfile.mkdtemp(prefix="kiddaw-proc-")
RATE = 44100
PEAK = 10 ** (-1 / 20)  # -1 dBFS


def decode(src):
    dst = os.path.join(tmp, "decoded.wav")
    subprocess.run(["afconvert", "-f", "WAVE", "-d", f"LEI16@{RATE}", "-c", "1", src, dst], check=True)
    with wave.open(dst) as w:
        data = array.array("h", w.readframes(w.getnframes()))
    return [x / 32768 for x in data]


def tidy(x, max_seconds, tail_db, fade_seconds):
    peak = max((abs(v) for v in x), default=0) or 1e-9
    onset_level = peak * 10 ** (-40 / 20)
    onset = next((i for i, v in enumerate(x) if abs(v) > onset_level), 0)
    start = max(0, onset - int(0.002 * RATE))
    block = int(0.01 * RATE)
    tail_level = peak * 10 ** (tail_db / 20)
    end = start
    for i in range(start, len(x), block):
        if max(abs(v) for v in x[i:i + block]) > tail_level:
            end = i + block
    end = min(len(x), end, start + int(max_seconds * RATE))
    y = x[start:end]
    fade = min(int(fade_seconds * RATE), len(y) // 3)
    for i in range(fade):
        y[len(y) - fade + i] *= 0.5 * (1 + math.cos(math.pi * i / fade))
    return y


def encode(samples, gain, dst, bitrate):
    wav = os.path.join(tmp, "tidy.wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(array.array("h", (max(-32767, min(32767, int(v * gain * 32767))) for v in samples)).tobytes())
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", str(bitrate), wav, dst], check=True)


manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
for set_id, s in spec.items():
    opts = dict(max_seconds=s.get("max_seconds", 2.0), tail_db=s.get("tail_db", -54), fade_seconds=s.get("fade_seconds", 0.05))
    bitrate = s.get("bitrate", 96000)
    if s["type"] == "hits":
        layers = [[tidy(decode(os.path.join(dl_root, f)), **opts) for f in layer] for layer in s["layers"]]
        loudest = max(max(abs(v) for v in clip) for layer in layers for clip in layer)
        entry_layers = []
        for li, layer in enumerate(layers):
            files = []
            for ci, clip in enumerate(layer):
                name = f"{set_id}/v{li + 1}-{ci + 1}.m4a"
                encode(clip, PEAK / loudest, os.path.join(out_root, name), bitrate)
                files.append(name)
            entry_layers.append(files)
        manifest[set_id] = {"type": "hits", "layers": entry_layers, "source": s["source"], "license": s["license"]}
    else:
        clips = {midi: tidy(decode(os.path.join(dl_root, f)), **opts) for midi, f in s["notes"].items()}
        loudest = max(max(abs(v) for v in c) for c in clips.values())
        notes = {}
        for midi, clip in clips.items():
            name = f"{set_id}/{midi}.m4a"
            encode(clip, PEAK / loudest, os.path.join(out_root, name), bitrate)
            notes[midi] = name
        manifest[set_id] = {"type": "notes", "notes": notes, "release": s.get("release", 0.8),
                            "source": s["source"], "license": s["license"]}
    size = sum(os.path.getsize(os.path.join(out_root, f)) for f in
               ([f for l in manifest[set_id].get("layers", []) for f in l] + list(manifest[set_id].get("notes", {}).values())))
    print(f"{set_id}: {size // 1024} KB")

json.dump(manifest, open(manifest_path, "w"), indent=1, sort_keys=True)
