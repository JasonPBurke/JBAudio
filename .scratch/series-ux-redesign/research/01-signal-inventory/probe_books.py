#!/usr/bin/env python3
"""Ticket 01 signal inventory: probe every book unit's tags + sidecars -> JSONL."""
import json, os, subprocess, sys

AUDIO_EXT = {".m4b", ".mp3", ".m4a", ".aac", ".ogg", ".opus", ".flac", ".wav"}
SIDECAR_EXT = {".cue", ".nfo", ".opf", ".jpg", ".jpeg", ".png", ".pdf", ".epub", ".mobi"}

SOURCES = [
    ("mnt", "/mnt/80DA0377DA03692C/Audiobooks"),
    ("wd", "/media/jason/My Book/Audio Books"),
    ("music", os.path.expanduser("~/Music")),
    ("home", os.path.expanduser("~/AudioBooks")),
]

def probe(path):
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_format", path],
            capture_output=True, text=True, timeout=60)
        return json.loads(out.stdout or "{}").get("format", {})
    except Exception as e:
        return {"_error": str(e)}

def emit(rec, fh):
    fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

def book_record(src, root, dirpath, audio_files, fh, per_file=False):
    """One record per book folder; probe first audio file (sorted).
    per_file=True emits one record per audio file instead (flat folders of
    single-file books, e.g. TMC)."""
    rel = os.path.relpath(dirpath, root)
    entries = sorted(os.listdir(dirpath))
    sidecars = sorted({os.path.splitext(e)[1].lower() for e in entries
                       if os.path.splitext(e)[1].lower() in SIDECAR_EXT})
    subdirs = [e for e in entries if os.path.isdir(os.path.join(dirpath, e))]
    targets = sorted(audio_files) if per_file else sorted(audio_files)[:1]
    for t in targets:
        f = probe(os.path.join(dirpath, t))
        emit({
            "source": src,
            "rel_dir": rel,
            "depth": 0 if rel == "." else rel.count(os.sep) + 1,
            "unit": t if per_file else os.path.basename(dirpath),
            "n_audio": 1 if per_file else len(audio_files),
            "exts": sorted({os.path.splitext(a)[1].lower() for a in audio_files}),
            "sidecars": sidecars,
            "subdirs": subdirs,
            "first_file": t,
            "tags": f.get("tags", {}),
            "duration": f.get("duration"),
            "format_name": f.get("format_name"),
        }, fh)

def main():
    out_path = sys.argv[1]
    with open(out_path, "w") as fh:
        for src, root in SOURCES:
            if not os.path.isdir(root):
                continue
            for dirpath, dirnames, filenames in os.walk(root):
                dirnames.sort()
                audio = [f for f in filenames
                         if os.path.splitext(f)[1].lower() in AUDIO_EXT]
                if not audio:
                    continue
                # Flat folder of single-file books: >1 m4b whose basenames
                # differ in more than a numeric prefix -> one record per file.
                base_set = {os.path.splitext(a)[0].lstrip("0123456789 -_.") for a in audio}
                per_file = (len(audio) > 1 and len(base_set) > 1
                            and all(os.path.splitext(a)[1].lower() == ".m4b" for a in audio)
                            and not dirnames)
                book_record(src, root, dirpath, audio, fh, per_file=per_file)
    print("done ->", out_path)

if __name__ == "__main__":
    main()
