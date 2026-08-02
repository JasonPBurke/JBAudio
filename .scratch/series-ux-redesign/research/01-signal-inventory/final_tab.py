#!/usr/bin/env python3
"""Final signal-frequency tabulation: device (primary) + local stores."""
import json, os, re, sys
from collections import Counter, defaultdict
sys.stdout.reconfigure(errors="replace")

TMP = os.path.dirname(os.path.abspath(__file__))

def mi_sig(g):
    """Extract the signal set from a MediaInfo General track."""
    ex = g.get("extra", {})
    return {
        "album": g.get("Album"),
        "artist": g.get("Performer"),
        "album_artist": g.get("Album_Performer"),
        "narrator_composer": g.get("Composer"),
        "grouping": g.get("Grouping"),
        "title": g.get("Track") or g.get("Title"),
        "track_no": g.get("Track_Position"),
        "track_total": g.get("Track_Position_Total"),
        "disc": g.get("Part_Position") or g.get("Part"),
        "content_type": g.get("ContentType"),
        "series": ex.get("SERIES") or ex.get("series"),
        "part": ex.get("PART") or ex.get("part"),
        "subtitle": ex.get("SUBTITLE"),
        "asin": ex.get("AUDIBLE_ASIN") or ex.get("asin") or ex.get("CDEK"),
        "narrator_nrt": ex.get("nrt"),
        "album_sort": g.get("Album_Sort"),
        "extra_keys": sorted(ex.keys()),
        "err": g.get("_error"),
    }

if __name__ != "__main__":
    import sys as _s
    _s.exit  # imported for mi_sig/KEYS only; skip the analysis below
    raise SystemExit  # unreachable guard marker

# ---- device: collapse to book units (handle pick-1 second probes) ----
dev = defaultdict(dict)
for l in open(os.path.join(TMP, "device_general.jsonl")):
    r = json.loads(l)
    dev[r["dir"]][r["pick"]] = r

units = []      # (label, sigs, meta)
flat_dirs = []  # dirs holding multiple distinct books
for d, picks in sorted(dev.items()):
    r0 = picks[0]
    s0 = mi_sig(r0["general"])
    if 1 in picks:
        s1 = mi_sig(picks[1]["general"])
        a0, a1 = s0.get("album"), s1.get("album")
        if a0 and a1 and a0 != a1:
            flat_dirs.append((d, a0, a1))
            units.append((d + " :: " + r0["file"], s0, r0))
            units.append((d + " :: " + picks[1]["file"], s1, picks[1]))
            continue
    units.append((d, s0, r0))

print(f"device book units: {len(units)}  (flat multi-book dirs: {len(flat_dirs)})")
for d, a0, a1 in flat_dirs:
    print(f"  FLAT: {d.split('/Audiobooks/')[-1][:60]}  [{str(a0)[:30]} | {str(a1)[:30]}]")

# ---- presence frequencies ----
KEYS = ["album", "artist", "album_artist", "narrator_composer", "grouping",
        "title", "track_no", "track_total", "disc", "content_type", "series",
        "part", "subtitle", "asin", "narrator_nrt", "album_sort"]
pres = Counter(); fails = 0
for label, s, r in units:
    if s.get("err"): fails += 1; continue
    for k in KEYS:
        if s.get(k) not in (None, ""):
            pres[k] += 1
n = len(units) - fails
print(f"\nprobe failures: {fails}")
print(f"\n=== presence over {n} successfully probed device book units ===")
for k in KEYS:
    print(f"  {pres[k]:4d} /{n}  {k}")

# ---- album parseability: does album contain series+number? ----
PATS = [
    ("albm: 'Series NN[.:- ]Title' prefix", re.compile(r"^(.{3,40}?)\s*#?(\d+(?:\.\d+)?)\s*[:\-–]\s*\S")),
    ("albm: '[Series N.M]' bracket", re.compile(r"^\[(.{3,40}?)\s+(\d+(?:\.\d+)?)\]")),
    ("albm: '(#N)' or '(N)' suffix", re.compile(r"\((?:#|Book )?(\d+(?:\.\d+)?)\)\s*$")),
    ("albm: ', Book N' suffix", re.compile(r",\s*Book\s+(\d+(?:\.\d+)?)", re.I)),
]
album_pat = Counter(); album_none = []
for label, s, r in units:
    a = s.get("album")
    if not a: continue
    hit = None
    for name, rx in PATS:
        if rx.search(a): hit = name; break
    if hit: album_pat[hit] += 1
    else: album_none.append(a)
print(f"\n=== album series+number parseability (n with album = {pres['album']}) ===")
tot = 0
for name, _ in PATS:
    print(f"  {album_pat[name]:4d}  {name}"); tot += album_pat[name]
print(f"  {len(album_none):4d}  album bare (no number pattern)")
print("  bare examples:", [a[:45] for a in album_none[:8]])

# ---- grouping / series values seen ----
gvals = Counter(); svals = Counter()
for label, s, r in units:
    if s.get("grouping"): gvals[s["grouping"]] += 1
    if s.get("series"): svals[s["series"]] += 1
print("\ngrouping values:", dict(gvals.most_common(12)))
print("extra.SERIES values:", dict(svals.most_common(12)))

# ---- extra-bag key census ----
ek = Counter()
for label, s, r in units:
    for k in s.get("extra_keys", []): ek[k] += 1
print("\nextra-bag keys:", dict(ek.most_common(20)))

# ---- probe method census ----
mc = Counter(r["method"] for _, _, r in units)
print("method census:", dict(mc))
