# Downloads every "url<TAB>path" line of a list into a folder, a few at a time. Skips files already there.
import os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
listfile, root = sys.argv[1], sys.argv[2]

def get(line):
    url, rel = line.rstrip("\n").split("\t")
    dest = os.path.join(root, rel)
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return None
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "kiddaw-sample-fetch"})
            with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f:
                f.write(r.read())
            return None
        except Exception as e:
            err = e
    return f"FAILED {rel}: {err}"

lines = [l for l in open(listfile) if l.strip()]
with ThreadPoolExecutor(6) as pool:
    for result in pool.map(get, lines):
        if result:
            print(result)
print("done", len(lines))
