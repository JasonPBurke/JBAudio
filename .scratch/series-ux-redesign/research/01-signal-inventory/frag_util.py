#!/usr/bin/env python3
"""Reconstruct a parseable ftyp+moov fragment from head+tail byte pulls."""
import struct

def find_moov(buf):
    """Return offset of a plausible moov box start in buf, else -1.
    A box header is [4-byte BE size][4CC]; moov must end within buf."""
    i = 0
    while True:
        j = buf.find(b"moov", i)
        if j < 4:
            return -1 if j == -1 else _next(buf, j)
        size = struct.unpack(">I", buf[j - 4:j])[0]
        if 8 <= size <= len(buf) - (j - 4):
            return j - 4
        i = j + 4

def _next(buf, j):
    return -1

def extract_ftyp(head):
    """Return the ftyp box bytes from the head pull."""
    if head[4:8] != b"ftyp":
        return None
    size = struct.unpack(">I", head[0:4])[0]
    if not (8 <= size <= len(head)):
        return None
    return head[:size]

def build_fragment(head, tail):
    """ftyp from head + moov from tail -> minimal parseable mp4, or None."""
    ftyp = extract_ftyp(head)
    if ftyp is None:
        return None
    off = find_moov(tail)
    if off < 0:
        return None
    return ftyp + tail[off:]

if __name__ == "__main__":
    import sys, os
    src = sys.argv[1]
    tail_n = int(sys.argv[2]) if len(sys.argv) > 2 else 24 * 1024 * 1024
    size = os.path.getsize(src)
    with open(src, "rb") as f:
        head = f.read(64 * 1024)
        f.seek(max(0, size - tail_n))
        tail = f.read()
    frag = build_fragment(head, tail)
    if frag is None:
        print("FAIL: no fragment")
        sys.exit(1)
    out = sys.argv[3] if len(sys.argv) > 3 else "frag_test.m4b"
    open(out, "wb").write(frag)
    print(f"fragment {len(frag)} bytes -> {out}")
