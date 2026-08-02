# 02 — Detection cascade: offline scoring harness

Throwaway research code for wayfinder ticket
[02](../../issues/02-detection-cascade.md). Pure Node, no RN, no DB, no device.

```
node final_report.js      # the headline table (also saved as RESULTS.txt)
node score.js             # per-tier scoring + full failure taxonomy
node score2.js            # V1 vs V2 vs portable-only, plus the edition probe
python3 dump_units.py     # regenerate units.json from 01's device_general.jsonl
python3 ground_truth.py   # regenerate ground_truth.json
```

| file | what it is |
|---|---|
| `dump_units.py` | collapses 01's `device_general.jsonl` into **298 book units** (same flat-dir rule as 01's `final_tab.py`) |
| `units.json` | the scoring corpus — one row per book unit, real library |
| `ground_truth.py` / `ground_truth.json` | **hand-authored** labels: 298 units, 246 in a series, **236 in a multi-book series across 38 series** |
| `cascade.js` | the candidate detector — pure, three stages (portable extraction → folder self-validation → reconcile) |
| `refine.js` | post-pass: split-book guard, display-name election, `&`/`and` key merge |
| `score.js` / `score2.js` / `final_report.js` | scoring + failure taxonomy |

## Ground truth is authored, not derived

Labels come from human knowledge of these books plus every available signal.
That is deliberate — it is the advantage a curator has and the machine lacks.
**It is therefore invalid to cite folder-rule accuracy against this file as proof
that folders are trustworthy in general**, only that they agree with truth *here*.
Units where reasonable curators would disagree (Ender hierarchy, split books,
the Demon Accords Compendium) carry `ambiguous: true`.

## Headline

| | folders permitted | portable only |
|---|---|---|
| coverage of in-series units | **79.2%** (187/236) | **54.2%** (128/236) |
| grouping purity, edition-blind | **98.4%** | **100%** |
| grouping purity, edition-aware | 77.9% | 92.4% |
| display name correct | 94.2% | 93.9% |
| canonical number correct | 96.6% | 100% |
| standalones swept into a series | **0** | **0** |

The gap between edition-blind and edition-aware purity is **entirely** the two
Discworld editions merging into one 80-unit group. Nothing else mixes.
