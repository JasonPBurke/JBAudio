#!/usr/bin/env python3
"""Collapse device_general.jsonl into book units (same rule as 01's final_tab.py)."""
import json, os, sys
from collections import defaultdict
sys.stdout.reconfigure(errors="replace")
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "01-signal-inventory", "device_general.jsonl")

def sig(g):
    ex = g.get("extra", {}) or {}
    return {
        "album": g.get("Album"), "artist": g.get("Performer"),
        "album_artist": g.get("Album_Performer"), "composer": g.get("Composer"),
        "grouping": g.get("Grouping"), "title": g.get("Track") or g.get("Title"),
        "track_no": g.get("Track_Position"),
        "series": ex.get("SERIES") or ex.get("series"),
        "part": ex.get("PART") or ex.get("part"),
        "subtitle": ex.get("SUBTITLE"),
        "asin": ex.get("AUDIBLE_ASIN") or ex.get("asin") or ex.get("CDEK"),
        "nrt": ex.get("nrt") or ex.get("NARRATEDBY"),
    }

dev = defaultdict(dict)
for l in open(SRC):
    r = json.loads(l); dev[r["dir"]][r["pick"]] = r

units = []
for d, picks in sorted(dev.items()):
    r0 = picks[0]; s0 = sig(r0["general"])
    if 1 in picks:
        s1 = sig(picks[1]["general"])
        if s0.get("album") and s1.get("album") and s0["album"] != s1["album"]:
            units.append({"dir": d, "file": r0["file"], "flat": True, **s0})
            units.append({"dir": d, "file": picks[1]["file"], "flat": True, **s1})
            continue
    units.append({"dir": d, "file": r0["file"], "flat": False, **s0})

for u in units:
    u["rel"] = u["dir"].split("/Audiobooks/", 1)[-1]
print(json.dumps(units, ensure_ascii=False, indent=0), file=open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "units.json"), "w"))
print(f"units: {len(units)}")
