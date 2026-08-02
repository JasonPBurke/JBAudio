#!/usr/bin/env python3
"""Hand-authored ground truth for the 02 detection-cascade scoring corpus.

AUTHORED, NOT DERIVED. Labels come from human knowledge of these books plus every
available signal (folder, album, tags). That is deliberate: the ground truth is
what a curator knows, which is exactly the advantage the machine lacks. It is
therefore NOT valid to cite folder-rule accuracy against this file as proof that
folders are trustworthy in general -- only that they agree with truth HERE.

Fields per unit:
  series   -- canonical series name, or None for a standalone
  number   -- canonical number within that series, or None if genuinely unknown
              (None numbers are excluded from number-accuracy scoring)
  edition  -- distinct recording of the same series, or None
  multi    -- True if this library owns >1 unit of the series (groupable at all)
  ambiguous-- True where reasonable curators would disagree (hierarchy, split books)
"""
import json, os, re, sys
sys.stdout.reconfigure(errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
units = json.load(open(os.path.join(HERE, "units.json")))

def key(u):
    return u["rel"] + (" :: " + (u["album"] or u["file"]) if u["flat"] else "")

T = {}   # key -> dict
def put(k, series=None, number=None, edition=None, ambiguous=False, note=None):
    T[k] = {"series": series, "number": number, "edition": edition,
            "ambiguous": ambiguous, "note": note}

ROMAN = {"I":1,"II":2,"III":3,"IV":4,"V":5,"VI":6,"VII":7,"lll":3}

DRESDEN = {
 "Storm Front":"1","Fool Moon":"2","Grave Peril":"3","Summer Knight":"4",
 "Death Masks":"5","Blood Rites":"6","Dead Beat":"7","Proven Guilty":"8",
 "White Night":"9","Small Favor":"10","Turn Coat":"11","Changes":"12",
 "Side Jobs":"12.5","Ghost Story":"13","Cold Days":"14","Skin Game":"15",
 "Brief Cases":"15.5","Peace Talks":"16","Battle Ground":"17","The Law":"17.5",
 "Twelve Months":"18","Heroic Hearts":None,   # multi-author anthology, not a numbered entry
}
BROMELIAD = {"Truckers":"1","Diggers":"2","Wings":"3"}
DRENAI = {"Legend":"1","The King Beyond the Gate":"2","Waylander":"3",
          "Quest for Lost Heroes":"4","Waylander II":"5"}
ENDER = {  # (folder-basename fragment) -> (sub-series, number)
 "1 - Ender's Game":("Ender Saga","1"),
 "2 - Speaker for the Dead":("Ender Saga","2"),
 "3 - Xenocide":("Ender Saga","3"),
 "04 Children of the Mind":("Ender Saga","4"),
 "Ender in Exile":("Ender Saga",None),
 "A war of gifts":("Ender Saga",None),
 "First Meetings (polish boy)":("Ender Saga",None),
 "5 - Ender's Shadow":("Shadow Saga","1"),
 "6 - Shadow of the Hegemon":("Shadow Saga","2"),
 "7 - Shadow Puppets":("Shadow Saga","3"),
 "8 - Shadow of the Giant":("Shadow Saga","4"),
 "9 - Shadows in Flight":("Shadow Saga","5"),
 "10 The Last Shadow":("Shadow Saga","6"),
 "01 Earth Unaware":("Formic Wars","1"),
 "2 Earth Afire":("Formic Wars","2"),
 "3 Earth Awakens":("Formic Wars","3"),
 "4 The Swarm":("Formic Wars","4"),
 "5 The Hive":("Formic Wars","5"),
 "Children of the Fleet":("Fleet School",None),
 "Ender short stories":(None,None),
 "IGMS Anthology":(None,None),
}

for u in units:
    k = key(u); rel = u["rel"]; alb = u["album"] or ""; base = rel.split("/")[-1]

    # ---------- Terry Pratchett ----------
    if rel.startswith("Terry Pratchett/Discworld/"):
        m = re.search(r"Discworld\s*(\d+)", base)
        put(k, "Discworld", m.group(1).lstrip("0") if m else None, "classic"); continue
    if rel.startswith("Terry Pratchett/Discworld (2022)/"):
        m = re.match(r"\((\d+)\)", base)
        put(k, "Discworld", m.group(1) if m else None, "2022"); continue
    if rel.startswith("Terry Pratchett/The Science of Discworld"):
        m = re.search(r"Discworld\s+([IVX]+)", base)
        put(k, "The Science of Discworld", str(ROMAN.get(m.group(1))) if m else None); continue
    if rel.startswith("Terry Pratchett/The Long Earth/"):
        m = re.search(r"Long Earth (\d+)", base)
        put(k, "The Long Earth", m.group(1).lstrip("0") if m else None); continue
    if rel.startswith("Terry Pratchett/Bromeliad/"):
        put(k, "Bromeliad", BROMELIAD.get(base)); continue
    if rel.startswith("Terry Pratchett/"):
        put(k); continue   # Nation, Strata, Carpet People x2, Blink, Folklore

    # ---------- Jim Butcher ----------
    if rel.startswith("Jim Butcher/Dresden Files/"):
        put(k, "The Dresden Files", DRESDEN.get(base, "MISSING")); continue

    # ---------- Orson Scott Card ----------
    if rel.startswith("Orson Scott Card/Enders Game"):
        hit = next((v for frag, v in ENDER.items() if rel.endswith(frag)), None)
        if hit is None: put(k, None, None, None, True, "unmatched Ender unit"); continue
        put(k, hit[0], hit[1], None, True, "Ender universe: sub-series vs umbrella is genuinely ambiguous"); continue

    # ---------- John Conroe ----------
    if rel.startswith("John Conroe/Demon Accords Series/"):
        if base.startswith("Volume"):
            put(k, "Demon Accords Compendium", re.search(r"Volume (\d+)", base).group(1).lstrip("0"),
                None, True, "short-story compendium; sibling sub-series or same series?"); continue
        m = re.search(r"Book (\d+(?:\.\d+)?)", base)
        n = m.group(1).lstrip("0") if m else None
        if n and n.startswith("."): n = "0"+n
        split = "Part 1" in alb or "Part 2" in alb
        put(k, "Demon Accords", n, None, split, "split book (Part 1/2)" if split else None); continue

    # ---------- Brandon Sanderson ----------
    if re.match(r"^Brandon Sanderson/[1-6]\.", rel):
        put(k, "Mistborn", rel.split("/")[1][0]); continue
    if rel.startswith("Brandon Sanderson/Warbreaker"):
        put(k, None, None, None, False, "split book: two units of ONE book; Grouping says 'Warbreaker 1/2'"); continue
    if rel.startswith("Brandon Sanderson/"):
        put(k); continue

    # ---------- Joe Abercrombie ----------
    if rel.startswith("Joe Abercrombie/First Law World/01 - The First Law/"):
        put(k, "The First Law", base.split(" - ")[0].lstrip("0")); continue
    if rel.startswith("Joe Abercrombie/First Law World/02 - The Age of Madness/"):
        put(k, "The Age of Madness", base.split(" - ")[0].lstrip("0")); continue
    if rel.startswith("Joe Abercrombie/"):
        put(k, "The Devils", "1", None, False, "singleton: one owned book of a series"); continue

    # ---------- China Mieville ----------
    if rel.startswith("China Mieville/"):
        BAS = {"2000 - Perdido Street Station":"1","2002 - The Scar":"2","2004 - Iron Council":"3"}
        if base in BAS: put(k, "Bas-Lag", BAS[base], None, False, "DARK: no signal anywhere names Bas-Lag"); continue
        put(k); continue

    # ---------- everything else, by explicit prefix ----------
    RULES = [
      ("Dan Simmons/The Hyperion Cantos", "Hyperion Cantos",
       {"Hyperion":"1","The Fall of Hyperion (Bevine)":"2","Endymion (Bevine) 643mb":"3","The Rise of Endymion (Bevine)":"4"}),
      ("David Gemmell/Drenai Series", "Drenai", None),
      ("Dennis E. Taylor/Bobiverse", "Bobiverse", None),
      ("Jonathan Stroud/Lockwood and Co. Series", "Lockwood & Co.", None),
      ("Scott Lynch/Gentlemen Bastards", "Gentlemen Bastards", None),
      ("Robert Jackson Bennett/Founders Trilogy", "Founders Trilogy", None),
      ("Blake Crouch/Crouch, Blake - Wayward Pines", "Wayward Pines", None),
      ("Tad Williams/Memory, Sorrow & Thorn", "Memory, Sorrow & Thorn", None),
      ("Steven King/The Dark Tower", "The Dark Tower", None),
    ]
    matched = False
    for prefix, series, table in RULES:
        if not rel.startswith(prefix): continue
        matched = True
        if series == "Hyperion Cantos":
            put(k, series, table.get(base)); break
        if series == "Drenai":
            n = next((v for kk,v in DRENAI.items() if kk in base and not (kk=="Waylander" and "II" in base)), None)
            if "Waylander II" in base: n = "5"
            put(k, series, n); break
        if series == "Bobiverse":
            m = re.search(r"Bobiverse (\d+)", alb); put(k, series, m.group(1).lstrip("0") if m else None); break
        if series == "Lockwood & Co.":
            m = re.search(r"Book (\d+)", rel); put(k, series, m.group(1) if m else None); break
        if series == "Gentlemen Bastards":
            put(k, series, base.split(" ")[0].lstrip("0")); break
        if series == "Founders Trilogy":
            put(k, series, base.split(" ")[0]); break
        if series == "Wayward Pines":
            m = re.search(r": (\d+) ", alb); put(k, series, m.group(1) if m else None); break
        if series == "Memory, Sorrow & Thorn":
            put(k, series, base.split(" ")[0].lstrip("0"), None, "Green Angel" in base,
                "split book: To Green Angel Tower Siege+Storm are one novel" if "Green Angel" in base else None); break
        if series == "The Dark Tower":
            if "LITTLE SISTERS" in base.upper(): put(k, series, "0.5", None, False, "album names the LEGENDS anthology, not the book"); break
            m = re.search(r"Dark Tower ([IVXl]+)", base)
            put(k, series, str(ROMAN.get(m.group(1))) if m and m.group(1) in ROMAN else None); break
    if matched: continue

    # ---------- flat/top-level singles and pairs ----------
    EXPLICIT = {
      "Ben Aronovitch": ("Rivers of London", {"Rivers of London (Midnight Riot)":"1","Moon Over Soho":"2","The Masquerades of Spring":None}),
      "Hugh Howey":     ("Silo", {"Dust: The Silo Saga, Book 3":"3","Shift: The Silo Saga, Book 2":"2"}),
      "Martha Wells":   ("The Murderbot Diaries", {"All Systems Red":"1","Martha Wells - The Murderbot Diaries 07 - System Collapse":"7"}),
      "Pierce Brown":   ("Red Rising", {"Red Rising (Unabridged)":"1","Golden Son (Unabridged)":"2"}),
      "Richard Osman":  ("Thursday Murder Club", {"TMC 01 Thursday Murder Club":"1","TMC 02 The Man Who Died Twice":"2"}),
      "Patrick Rothfuss":("The Kingkiller Chronicle", {"Kingkiller Chronicle 01 The Name of the Wind":"1","Kingkiller Chronicle 02 The Wise Man's Fear":"2"}),
      "Travis Baldree": ("Legends & Lattes", {"Legends and Lattes":"1","Bookshops & Bonedust (Unabridged)":None}),
      "TJ Klune":       ("Cerulean Chronicles", {"Cerulean Chronicles 01 - The House in the Cerulean Sea":"1","Cerulean Chronicles 02 - Somewhere Beyond the Sea":"2"}),
      "Edgar Rice Burroughs": ("Barsoom", {"Princess of Mars, A":"1","The Gods of Mars":"2"}),
      "Christopher Buehlman": ("Blacktongue", {"The Blacktongue Thief":"1","The Daughters' War (Unabridged)":"2"}),
      "James Islington": ("Hierarchy", {"The Will of the Many (Unabridged)":"1","The Strength of the Few":"2"}),
    }
    top = rel.split("/")[0]
    if top in EXPLICIT:
        series, table = EXPLICIT[top]
        if alb in table: put(k, series, table[alb]); continue
        put(k); continue

    if top == "Josiah Bancroft":
        BAB = {"Senlin Ascends (Unabridged)":"1","Arm of the Sphinx (Unabridged)":"2","The Fall of Babel":"4"}
        if alb in BAB: put(k, "The Books of Babel", BAB[alb], None, False, "owned 1,2,4 -- real gap at 3"); continue
        put(k, "The Hexologists", "2", None, False, "singleton: only book 2 owned"); continue
    if top == "Matt Dinniman":
        put(k, "Dungeon Crawler Carl", "2" if "Carl's Doomsday" in alb else None, None, True,
            "DCC entry; canonical number unverified for shorts"); continue
    if top == "Robert Jackson Bennett":
        put(k, "Shadow of the Leviathan", "1" if "Tainted Cup" in alb else None); continue

    SINGLETON = {"G.S. Denning":("Warlock Holmes","1"), "Drew Hayes":("Fred the Vampire Accountant","1"),
                 "Douglas Adams":("The Hitchhiker's Guide to the Galaxy","1"), "Peter Clines":("Threshold","1"),
                 "George R.R. Martin":("Dunk & Egg",None), "Ringworld":("Known Space",None),
                 "Christopher Moore":("Grim Reaper",None)}
    if top in SINGLETON and (alb or "").strip():
        s, n = SINGLETON[top]
        # only the actual series book, not the author's other standalones
        if top == "Douglas Adams" and "Hitchhiker" not in alb: put(k); continue
        if top == "Christopher Moore" and "Dirty Job" not in alb: put(k); continue
        put(k, s, n, None, False, "singleton: one owned book of a known series"); continue

    put(k)

# ---- mark multi: series with >1 owned unit in the same edition ----
from collections import Counter
cnt = Counter((v["series"], v["edition"]) for v in T.values() if v["series"])
for v in T.values():
    v["multi"] = bool(v["series"]) and cnt[(v["series"], v["edition"])] > 1

missing = [k for k,v in T.items() if v.get("number") == "MISSING"]
assert not missing, f"unlabelled Dresden units: {missing}"
assert len(T) == len(units), f"{len(T)} labels for {len(units)} units"

json.dump(T, open(os.path.join(HERE, "ground_truth.json"), "w"), ensure_ascii=False, indent=1, sort_keys=True)
ns = sum(1 for v in T.values() if v["series"])
nm = sum(1 for v in T.values() if v["multi"])
print(f"labelled {len(T)} units: {ns} in a series, {nm} in a MULTI-book series, {len(T)-ns} standalone")
print(f"distinct (series, edition) pairs: {len(cnt)};  multi-book: {sum(1 for c in cnt.values() if c>1)}")
for (s,e),c in sorted(cnt.items(), key=lambda x:-x[1]):
    if c>1: print(f"  {c:3d}  {s}" + (f"  [{e}]" if e else ""))
