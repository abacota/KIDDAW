# Builds the download list for drums, body percussion and piano: one line per file, "url<TAB>local path".
import re, sys
S = sys.argv[1]
out = []

def add(url, path):
    out.append(f"{url}\t{path}")

VD = "https://raw.githubusercontent.com/sfzinstruments/virtuosity_drums/master/Samples/mid"
studio = {
    "kick": ["kick/mid_kick_snoff_vl2_rr1", "kick/mid_kick_snoff_vl2_rr2", "kick/mid_kick_snoff_vl4_rr1", "kick/mid_kick_snoff_vl4_rr2"],
    "snare": ["snare/mid_snare_center_vl14", "snare/mid_snare_center_vl16", "snare/mid_snare_center_vl31", "snare/mid_snare_center_vl33"],
    "hihat": ["hh/mid_hh_closed_vl2_rr1", "hh/mid_hh_closed_vl2_rr2", "hh/mid_hh_closed_vl4_rr1", "hh/mid_hh_closed_vl4_rr2"],
    "openhat": ["hh/mid_hh_open_vl2_rr1", "hh/mid_hh_open_vl2_rr2", "hh/mid_hh_open_vl4_rr1", "hh/mid_hh_open_vl4_rr2"],
    "tom": ["htom/mid_htom_center_vl6", "htom/mid_htom_center_vl8", "htom/mid_htom_center_vl13", "htom/mid_htom_center_vl15"],
    "lowtom": ["ltom/mid_ltom_center_vl6", "ltom/mid_ltom_center_vl8", "ltom/mid_ltom_center_vl13", "ltom/mid_ltom_center_vl15"],
    "crash": ["crash/mid_crash_crash_vl2_rr1", "crash/mid_crash_crash_vl2_rr2", "crash/mid_crash_crash_vl3_rr1", "crash/mid_crash_crash_vl3_rr2"],
    "ride": ["ride/mid_ride_ride_vl2_rr1", "ride/mid_ride_ride_vl2_rr2", "ride/mid_ride_ride_vl3_rr1", "ride/mid_ride_ride_vl3_rr2"],
}
for sound, files in studio.items():
    for f in files:
        add(f"{VD}/{f}.flac", f"studio/{sound}/{f.split('/')[-1]}.flac")

MK = "https://raw.githubusercontent.com/freepats/muldjordkit/main/samples"
tree = [l.split()[0] for l in open(f"{S}/tree-freepats_muldjordkit.txt")]
rock = {"kick": "KdrumL", "snare": "Snare1", "hihat": "HihatClosed", "openhat": "HihatOpen",
        "tom": "Tom2", "lowtom": "Tom4", "crash": "CrashL", "ride": "RideL"}
for sound, folder in rock.items():
    files = sorted((p for p in tree if p.startswith(f"samples/{folder}/")), key=lambda p: int(re.match(r".*/(\d+)-", p).group(1)))
    n = len(files)
    soft = round(n * 0.45)
    for i in [soft - 1, soft, n - 2, n - 1]:
        name = files[i].split("/")[-1]
        add(f"{MK}/{folder}/{name}", f"rock/{sound}/{name}")

BP = "https://raw.githubusercontent.com/sfzinstruments/body_percussion/main/Samples/body"
body = {
    "clap": ["handclap_vl1_rr1", "handclap_vl1_rr2", "handclap_vl2_rr1", "handclap_vl2_rr2"],
    "snap": ["snap_r_rr1", "snap_r_rr2", "snap_r_rr3", "snap_r_rr4"],
    "stomp": ["stomp_r_vl1_rr1", "stomp_r_vl1_rr2", "stomp_r_vl2_rr1", "stomp_r_vl2_rr2"],
    "chest": ["chestthump_l_vl1_rr1", "chestthump_l_vl1_rr2", "chestthump_l_vl2_rr1", "chestthump_l_vl2_rr2"],
}
for sound, files in body.items():
    for f in files:
        add(f"{BP}/{f}.wav", f"body/{sound}/{f}.wav")

SAL = "https://tonejs.github.io/audio/salamander"
names = ["C", "Ds", "Fs", "A"]
notes = ["A0"] + [f"{n}{o}" for o in range(1, 8) for n in names] + ["C8"]
for n in notes:
    add(f"{SAL}/{n}.mp3", f"piano/{n}.mp3")

print("\n".join(out))
