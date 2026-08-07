/**
 * The series-detection scoring corpus: 298 book units probed from the owner's
 * real 350-title library, plus hand-authored labels for them.
 *
 * Both files are checked in verbatim from the research harness
 * (`.scratch/series-ux-redesign/research/02-detection-cascade/`) so that the
 * spec's measured numbers are assertions that fail on regression rather than
 * claims in a ticket.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO CAVEATS. Read them before citing anything measured against this fixture.
 *
 * 1. THE GROUND TRUTH IS AUTHORED, NOT DERIVED. The labels come from human
 *    knowledge of these books plus every available signal — that is the whole
 *    point, since it is the advantage a curator has and the machine lacks. It
 *    is therefore NOT valid to cite folder-rule accuracy against this file as
 *    proof that folders are trustworthy IN GENERAL, only that they agree with
 *    truth HERE. Units where reasonable curators would disagree (the Ender
 *    hierarchy, split books, the Demon Accords Compendium) carry `ambiguous`.
 *
 * 2. COVERAGE FIGURES ARE LOWER BOUNDS. The device probe took at most two
 *    files per directory, so roughly 35 single-file books sitting in flat
 *    multi-book folders are missing from the corpus entirely. Accuracy figures
 *    — purity, naming, numbering — are unaffected, because they are measured
 *    only on what was probed. ASSERT ACCURACY; NEVER ASSERT COVERAGE.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { DetectionUnit } from '@/helpers/seriesDetection';
import units from './seriesCorpus.units.json';
import groundTruth from './seriesCorpus.groundTruth.json';

/** A corpus unit carries the probe's extra fields; detection ignores them. */
export type CorpusUnit = DetectionUnit & {
  dir: string;
  title: string | null;
  track_no: string | null;
  subtitle: string | null;
  asin: string | null;
  nrt: string | null;
};

export type GroundTruth = {
  /** The series this book really belongs to, or null for a standalone. */
  series: string | null;
  /** The edition, where one library holds two recordings of one series. */
  edition: string | null;
  number: string | null;
  /** True when the series has more than one book present in the corpus. */
  multi: boolean;
  /** True where reasonable curators would label this differently. */
  ambiguous: boolean;
  note: string | null;
};

export const corpusUnits = units as CorpusUnit[];

export const corpusGroundTruth = groundTruth as Record<string, GroundTruth>;

/**
 * Ground truth is keyed by `rel`, disambiguated by album or filename when the
 * directory holds more than one book — a flat folder gives several units the
 * same `rel`, so `rel` alone is not unique.
 */
export const truthKey = (u: CorpusUnit): string =>
  u.flat ? `${u.rel} :: ${u.album || u.file}` : u.rel;

export const truthFor = (u: CorpusUnit): GroundTruth =>
  corpusGroundTruth[truthKey(u)] ?? {
    series: null,
    edition: null,
    number: null,
    multi: false,
    ambiguous: false,
    note: null,
  };
