#!/usr/bin/env python3
"""Pull tag regions for device book units and probe with host MediaInfoLib."""
import json, os, shlex, struct, subprocess, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mi_probe import probe
from frag_util import build_fragment

SER = "29131FDH3009SZ"
TMP = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(TMP, "device_frags")
os.makedirs(WORK, exist_ok=True)
AUDIO = {".m4b", ".mp3", ".m4a", ".aac", ".ogg", ".opus", ".flac", ".wav"}
MB = 1024 * 1024

def adb_range(path, out, skip_mb=None, count_mb=None, bs="1M"):
    q = shlex.quote(path)
    dd = f"dd if={q} bs={bs}"
    if count_mb is not None:
        dd += f" count={count_mb}"
    if skip_mb is not None:
        dd += f" skip={skip_mb}"
    dd += " 2>/dev/null"
    with open(out, "wb") as fh:
        r = subprocess.run(["adb", "-s", SER, "exec-out", dd], stdout=fh, timeout=600)
    return r.returncode == 0 and os.path.getsize(out) > 0

def probe_device_file(path, size, tag):
    """Pull enough of the file to read tags; return (general, method)."""
    ext = os.path.splitext(path)[1].lower()
    frag = os.path.join(WORK, f"frag_{tag}{ext}")
    if size <= 32 * MB:
        if adb_range(path, frag):
            return probe(frag), "whole"
        return {"_error": "pull failed"}, "whole"
    if ext == ".mp3":
        if adb_range(path, frag, count_mb=4):
            g = probe(frag)
            return g, "head4"
        return {"_error": "pull failed"}, "head4"
    # big mp4-family: head 64K + tail 24MB -> reconstruct; fallback head 16MB
    headf, tailf = frag + ".head", frag + ".tail"
    ok_h = adb_range(path, headf, count_mb=1, bs="64K")  # 64K head
    skip = max(0, size // MB - 24)
    ok_t = adb_range(path, tailf, skip_mb=skip, count_mb=25)
    if ok_h and ok_t:
        head = open(headf, "rb").read()
        tail = open(tailf, "rb").read()
        fragment = build_fragment(head, tail)
        if fragment:
            open(frag, "wb").write(fragment)
            g = probe(frag)
            if g.get("Album") or g.get("Track") or g.get("Title"):
                return g, "tail-moov"
    if adb_range(path, frag, count_mb=16):
        return probe(frag), "head16"
    return {"_error": "all methods failed"}, "none"

def main():
    dir_audio = defaultdict(list)
    for l in open(os.path.join(TMP, "device_files.txt")):
        l = l.rstrip("\n")
        if "|" not in l:
            continue
        s, p = l.split("|", 1)
        if os.path.splitext(p)[1].lower() in AUDIO:
            dir_audio[os.path.dirname(p)].append((os.path.basename(p), int(s)))

    out = open(os.path.join(TMP, "device_general.jsonl"), "w")
    dirs = sorted(dir_audio)
    for i, d in enumerate(dirs):
        entries = sorted(dir_audio[d])
        picks = [entries[0]]
        # second-file probe for multi-m4b dirs: distinguishes chapter-split
        # from flat collection by comparing Album tags
        m4bs = [e for e in entries if e[0].lower().endswith(".m4b")]
        if len(m4bs) > 1 and entries[0] in m4bs:
            picks.append(m4bs[1])
        for j, (name, size) in enumerate(picks):
            path = d + "/" + name
            g, method = probe_device_file(path, size, f"{i}_{j}")
            out.write(json.dumps({
                "dir": d, "file": name, "size": size, "n_audio": len(entries),
                "n_m4b": len(m4bs), "pick": j, "method": method, "general": g,
            }, ensure_ascii=False) + "\n")
            out.flush()
        if i % 20 == 0:
            print(f"{i}/{len(dirs)}", flush=True)
    out.close()
    # cleanup fragments
    for f in os.listdir(WORK):
        os.unlink(os.path.join(WORK, f))
    print("done")

if __name__ == "__main__":
    main()
