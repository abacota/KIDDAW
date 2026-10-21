# Turns downloaded recordings into small, tidy files for KIDDAW.
#
# For every sound in the spec: decode to mono 44.1 kHz, cut the silence before the
# hit, trim the tail where it fades out and fade it smoothly, set the whole sound
# (all its velocity layers together) to the same peak level, and encode as AAC.
#
# Usage: python3 -I process.py spec.json downloads_dir output_dir manifest.json

import array, json, math, os, subprocess, sys, tempfile, wave  # noqa: F401

spec_path, dl_root, out_root, manifest_path = sys.argv[1:5]
spec = json.load(open(spec_path))
tmp = tempfile.mkdtemp(prefix="kiddaw-proc-")
RATE = 44100
PEAK = 10 ** (-1 / 20)  # -1 dBFS


def decode(src):
    dst = os.path.join(tmp, "decoded.wav")
    subprocess.run(["afconvert", "-f", "WAVE", "-d", f"LEI16@{RATE}", "-c", "1", src, dst], check=True)
    # Read the 16-bit samples straight from the data chunk (some files use a header Python's wave module refuses).
    raw = open(dst, "rb").read()
    pos = 12
    while pos + 8 <= len(raw):
        size = int.from_bytes(raw[pos + 4:pos + 8], "little")
        if raw[pos:pos + 4] == b"data":
            body = raw[pos + 8:pos + 8 + size]
            return [x / 32768 for x in array.array("h", body[:len(body) - len(body) % 2])]
        pos += 8 + size + (size & 1)
    raise ValueError(f"no audio in {src}")


def retune(x, semitones):
    """Shifts pitch by resampling: positive semitones raises it."""
    rate = 2 ** (semitones / 12)
    out = []
    i = 0.0
    while i < len(x) - 1:
        j = int(i)
        frac = i - j
        out.append(x[j] * (1 - frac) + x[j + 1] * frac)
        i += rate
    return out


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


def detect_midi(x):
    """Measures a recording's pitch (as a fractional MIDI number) from a steady stretch after the attack."""
    start = min(len(x) // 3, int(0.3 * RATE))
    seg = x[start:start + 8192:2]
    sr = RATE / 2
    window = 2048
    tau_max = min(int(sr / 28), len(seg) - window - 1)
    if tau_max < 20:
        return None
    d = [0.0] * (tau_max + 1)
    for tau in range(1, tau_max + 1):
        total = 0.0
        for j in range(window):
            diff = seg[j] - seg[j + tau]
            total += diff * diff
        d[tau] = total
    cm = [1.0] * (tau_max + 1)
    running = 0.0
    for tau in range(1, tau_max + 1):
        running += d[tau]
        cm[tau] = d[tau] * tau / running if running else 1.0
    best = None
    for tau in range(int(sr / 2500), tau_max):
        if cm[tau] < 0.2 and cm[tau] <= cm[tau + 1]:
            best = tau
            break
    if best is None:
        best = min(range(int(sr / 2500), tau_max), key=lambda t: cm[t])
    a, b, c = cm[best - 1], cm[best], cm[best + 1]
    denom = a - 2 * b + c
    period = best + (0.5 * (a - c) / denom if denom else 0)
    return 69 + 12 * math.log2(sr / period / 440)


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
        clips = {}
        for midi, f in s["notes"].items():
            raw = decode(os.path.join(dl_root, f))
            key = int(midi)
            if s.get("detect_pitch"):
                # Libraries disagree about octave names, so trust the measured pitch for the octave
                # whenever its note name agrees with the file's.
                found = detect_midi(raw)
                if found is None or round(found) % 12 != key % 12:
                    print(f"  {set_id} {f}: named {key}, measured {found and round(found, 2)}; left out")
                    continue
                key = round(found)
                off = (found - key) * 100
                if abs(off) > 10:
                    # Retune notes that are noticeably out of tune, so chords sound clean.
                    raw = retune(raw, -off / 100)
                    if abs(off) > 25:
                        print(f"  {set_id} {f}: was {off:+.0f} cents out of tune; retuned")
            if key in clips:
                print(f"  {set_id} {f}: two files measured as note {key}; kept the first")
                continue
            clips[key] = tidy(raw, **opts)
        clips = {str(k): v for k, v in sorted(clips.items())}
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
    print(f"{set_id}: {size // 1024} KB", flush=True)
    json.dump(manifest, open(manifest_path, "w"), indent=1, sort_keys=True)

json.dump(manifest, open(manifest_path, "w"), indent=1, sort_keys=True)
