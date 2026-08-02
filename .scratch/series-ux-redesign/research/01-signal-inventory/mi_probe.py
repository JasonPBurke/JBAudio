#!/usr/bin/env python3
"""Probe files with the host-built MediaInfoLib v25.10 (same source as the
app's turbomodule), mirroring NativeMediaInfoModule.kt's options:
Internet=No, Cover_Data="", Output=JSON. Emits JSONL: path -> General track."""
import ctypes, json, sys

LIB = "/home/jason/.claude/jobs/d3f8d556/tmp/mi-host/mediainfo/libmediainfo.so"
mi = ctypes.CDLL(LIB)
mi.MediaInfo_New.restype = ctypes.c_void_p
mi.MediaInfo_Option.restype = ctypes.c_wchar_p
mi.MediaInfo_Option.argtypes = [ctypes.c_void_p, ctypes.c_wchar_p, ctypes.c_wchar_p]
mi.MediaInfo_Open.restype = ctypes.c_size_t
mi.MediaInfo_Open.argtypes = [ctypes.c_void_p, ctypes.c_wchar_p]
mi.MediaInfo_Inform.restype = ctypes.c_wchar_p
mi.MediaInfo_Inform.argtypes = [ctypes.c_void_p, ctypes.c_size_t]
mi.MediaInfo_Close.argtypes = [ctypes.c_void_p]
mi.MediaInfo_Delete.argtypes = [ctypes.c_void_p]

def probe(path):
    h = mi.MediaInfo_New()
    try:
        mi.MediaInfo_Option(h, "Internet", "No")
        mi.MediaInfo_Option(h, "Cover_Data", "")
        mi.MediaInfo_Option(h, "Output", "JSON")
        if not mi.MediaInfo_Open(h, path):
            return {"_error": "open failed"}
        raw = mi.MediaInfo_Inform(h, 0)
        mi.MediaInfo_Close(h)
        try:
            doc = json.loads(raw)
        except Exception as e:
            return {"_error": f"bad json: {e}", "_raw": (raw or "")[:500]}
        tracks = doc.get("media", {}).get("track", [])
        gen = next((t for t in tracks if t.get("@type") == "General"), {})
        return gen
    finally:
        mi.MediaInfo_Delete(h)

if __name__ == "__main__":
    out = open(sys.argv[2], "w")
    for line in open(sys.argv[1]):
        path = line.rstrip("\n")
        if not path:
            continue
        g = probe(path)
        out.write(json.dumps({"path": path, "general": g}, ensure_ascii=False) + "\n")
    print("done")
