/**
 * THROWAWAY — Series UX redesign prototype harness, ticket 14. See ./README.md.
 *
 * "Three placements of the series line, switchable from a floating pill, on the
 * REAL `titleDetails` route."
 *
 * Ticket 10 settled the CONTENT (name + canonical number, taps through to the
 * series detail sheet, renders a LIST because multi-membership is real,
 * `Add to series…` always in the overflow, no book-first remove). This file
 * settles only WHERE it goes, which is the one thing you cannot reason about on
 * paper: `titleDetails` is a full screen with a mesh-gradient hero, a large
 * cover and a long description, and the question is whether a series line fits
 * without pushing the play button below the fold.
 *
 * WHY THESE THREE. The screen already has three established *species* of row,
 * and a series is genuinely ambiguous between them:
 *
 *   byline  — identity, like Author/Narrator. Series is WHO this book is part of.
 *   chip    — a tag, like a genre. Series is one of this book's labels.
 *   card    — a fact, like Duration/Released/Chapters. Series is metadata.
 *
 * So the variants disagree about what a series IS, not about padding. Each also
 * fails the multi-membership case differently, which is the point: bylines
 * stack, chips wrap for free, and a card in a fixed 3-across row cannot hold
 * two at all without lying ("+1").
 *
 * Reachable data: `useSeriesSource()` is the same hook the library screen and
 * the detail sheet inject through, so this works on the real DB AND on the
 * synthetic presets. `Stress ×15` deliberately contains three series sharing
 * the same books — that is how the 2-and-3-membership case is reachable on an
 * 8-book emulator without inventing anything.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, Layers } from 'lucide-react-native';

import { colors, fontSize } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';
import { useSeriesSource } from './useSeriesSource';
import { useProtoStore, SERIES_LINE_VARIANTS, SeriesLineVariant } from './protoStore';
import type { ProtoSeries } from './syntheticSeries';

const DETAIL_ROUTE = '/seriesDetail';

/** One membership of one book. `number` is null whenever nothing detected it. */
type Membership = {
  seriesId: string;
  name: string;
  /** Ticket 07's canonical number — the PUBLISHED number, blank when unknown. */
  number: number | null;
  /** 0-based position, only used to show what the badge would say if it fell
   *  back to position — it must not, per 07. Kept for the log line. */
  position: number;
  total: number;
  /** 06's `series.origin`. Absent on real-DB rows (schema v32) — read as
   *  'detected', which is what the detector will write. */
  origin: 'detected' | 'user';
};

/**
 * Every series this book belongs to.
 *
 * Multi-membership is real and shipping TODAY — *Guards! Guards!* is Discworld 8
 * and Night Watch 1 simultaneously (verified on device by ticket 07) — so this
 * returns an array and every variant has to render a list, not a value.
 */
function useMemberships(bookId: string | undefined): Membership[] {
  const series = useSeriesSource();
  return useMemo(() => {
    if (!bookId) return [];
    const out: Membership[] = [];
    for (const s of series) {
      // `bookId`, NOT `id` — the app's `Book` has no `id` field, and this is the
      // same param `titleDetails` was routed with, so no re-resolution is needed.
      const idx = s.books.findIndex((b) => b.bookId === bookId);
      if (idx === -1) continue;
      // `canonicalNumbers` exists only on synthetic rows (schema v33 is
      // unbuilt), and is index-aligned with `books`. Cast rather than widen:
      // the library screen's filters pass objects through by reference, so the
      // field survives even though the shared types erase it.
      const nums = (s as ProtoSeries).canonicalNumbers;
      const origin = (s as ProtoSeries).origin ?? 'detected';
      out.push({
        seriesId: s.id,
        name: s.name,
        number: nums?.[idx] ?? null,
        position: idx,
        total: s.books.length,
        origin,
      });
    }
    return out;
  }, [series, bookId]);
}

const openSeries = (seriesId: string) =>
  router.push({ pathname: DETAIL_ROUTE, params: { id: seriesId } });

/**
 * Ticket 07's badge text. The number is the PUBLISHED one and is blank when
 * unknown — 07 ruled "blank beats misleading", and position is already carried
 * by the detail sheet's layout, so it must NOT be substituted here.
 */
const numberLabel = (m: Membership) =>
  m.number === null ? null : `Book ${m.number}`;

/**
 * The ONE series to show when a variant refuses to render a list.
 *
 * DRIVER'S RULE (2026-08-04, mid-ticket): "constrain it to derived series, or
 * the first series created by the user that contains that book", with the
 * tiebreak settled the same day once the build exposed that the rule was silent
 * on the case that actually matters — TWO DETECTED series, which is the real
 * one (Discworld 8 + Night Watch 1 are both detected).
 *
 *   1. among DETECTED series (06's `origin`), the LARGEST wins
 *   2. failing that, the FIRST user-created one, in creation order
 *
 * The asymmetry is deliberate, not an oversight. Detected series have no
 * meaningful creation order — it is whatever order the scan emitted — so size is
 * the only signal available, and the bigger series is almost always the
 * canonical one with the sub-series as the specialist grouping. User-created
 * series DO have a meaningful creation order, so the driver's original wording
 * stands for them unchanged.
 *
 * Real-DB rows carry no `origin` — schema v32 predates 06's column — so an
 * absent value is read as `detected`, matching what the detector will write and
 * what `syntheticSeries.ts:263` already defaults to.
 *
 * THIS IS A DEPARTURE FROM TICKET 10, not a rendering shortcut. 10 ruled the
 * series line "renders a LIST because multi-membership is real", and a single
 * line cannot. The cost is that *Guards! Guards!* shows Discworld 8 and simply
 * does not mention Night Watch 1 here — that membership is only reachable by
 * opening the series detail sheet. Worth deciding deliberately rather than
 * discovering later.
 */
function primaryMembership(items: Membership[]): Membership | null {
  if (items.length === 0) return null;
  const detected = items.filter((m) => m.origin !== 'user');
  if (detected.length > 0) {
    // Largest wins; `reduce` keeps the FIRST on a tie, so the pick is stable.
    return detected.reduce((best, m) => (m.total > best.total ? m : best));
  }
  return items[0];
}

/* ------------------------------------------------------------- variant NEW  */
/**
 * SUBHEADING — one line directly under the book title, reading as a sentence:
 * `Book 8 of Discworld`. Driver-requested after seeing the first three.
 *
 * The claim none of the other three make: a series is part of the book's TITLE
 * BLOCK — the same thing a printed book does on its cover. It is the only
 * variant that reads as prose rather than as a field, and the only one that
 * shows a single series (see `primaryMembership`).
 *
 * STATIC — deliberately NOT tappable (driver, 2026-08-04: "we really might make
 * it static and not tappable. this might be overkill"). That drops a SECOND
 * piece of ticket 10, which specified the line "taps through to series detail".
 * The justification is that the route is not lost, only duplicated: the series
 * sheet is already reachable from the browse row, and a subheading that reads as
 * prose has nowhere to put an affordance cue without becoming a field again.
 *
 * Recorded rather than assumed, because 10 is a closed ticket.
 */
const SeriesSubheading = ({ items }: { items: Membership[] }) => {
  const { colors: themeColors } = useTheme();
  const m = primaryMembership(items);
  if (!m) return null;
  return (
    <View style={styles.subheadingRow}>
      <Text
        style={[styles.subheading, { color: themeColors.textMuted }]}
        numberOfLines={1}
      >
        {m.number === null ? 'Part of ' : `Book ${m.number} of `}
        <Text style={{ color: themeColors.text }}>{m.name}</Text>
      </Text>
    </View>
  );
};

/* ---------------------------------------------------------------- variant A */
/**
 * BYLINE — series as identity, sited directly under Author/Narrator and above
 * the genre chips.
 *
 * The claim: a series is the same KIND of fact as an author, so it belongs in
 * the same block, and a reader looking for "what is this part of" looks where
 * they looked for "who wrote this". Multi-membership stacks as extra lines,
 * which is free but is also the variant's risk — three series push the genres,
 * the info cards and the play button all down at once.
 */
const SeriesByline = ({ items }: { items: Membership[] }) => {
  const { colors: themeColors } = useTheme();
  return (
    <View style={styles.bylineBlock}>
      {items.map((m) => (
        <Pressable
          key={m.seriesId}
          onPress={() => openSeries(m.seriesId)}
          style={styles.bylineRow}
          hitSlop={6}
        >
          <Layers size={15} color={themeColors.textMuted} strokeWidth={1.8} />
          <Text
            style={[styles.bylineName, { color: themeColors.text }]}
            numberOfLines={1}
          >
            {m.name}
          </Text>
          {numberLabel(m) ? (
            <Text style={[styles.bylineNum, { color: themeColors.textMuted }]}>
              {numberLabel(m)}
            </Text>
          ) : null}
          <ChevronRight size={15} color={themeColors.textMuted} strokeWidth={1.8} />
        </Pressable>
      ))}
    </View>
  );
};

/* ---------------------------------------------------------------- variant B */
/**
 * CHIPS — series as a label, sited in its own wrapping row immediately above
 * the genre chips, styled as their sibling but distinguished by the `Layers`
 * glyph and a brighter text colour.
 *
 * The claim: a series is one of this book's labels. Costs the least vertical
 * space of the three, and multi-membership is genuinely free because chips
 * wrap. The risk is the opposite of the byline's: a chip row reads as
 * non-interactive metadata, and 10 requires this to be a route.
 */
const SeriesChips = ({ items }: { items: Membership[] }) => {
  const { colors: themeColors } = useTheme();
  return (
    <View style={styles.chipRow}>
      {items.map((m) => (
        <Pressable
          key={m.seriesId}
          onPress={() => openSeries(m.seriesId)}
          style={styles.chip}
          hitSlop={4}
        >
          <Layers size={13} color={themeColors.text} strokeWidth={2} />
          <Text style={[styles.chipText, { color: themeColors.text }]} numberOfLines={1}>
            {m.name}
            {numberLabel(m) ? ` · ${m.number}` : ''}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

/* ---------------------------------------------------------------- variant C */
/**
 * CARD — series as metadata, sited as a fourth cell in the existing
 * Duration / Released / Chapters row.
 *
 * The claim: a series is a fact about the book like its length. This is the
 * variant most likely to LOSE, and it is here to lose honestly: the row is
 * `flex: 1` thirds, so a fourth cell squeezes all four, a series name is far
 * longer than `7h 12m`, and multi-membership cannot be expressed except as
 * `+1` — which ticket 10 explicitly ruled out by requiring a LIST.
 *
 * If it wins anyway, that is a real finding: it costs ZERO extra vertical
 * space, the only one of the three that does.
 */
const SeriesCard = ({ items }: { items: Membership[] }) => {
  const { colors: themeColors } = useTheme();
  const first = items[0];
  const extra = items.length - 1;
  return (
    <>
      <View style={styles.cardDivider} />
      <Pressable
        style={styles.card}
        onPress={() => openSeries(first.seriesId)}
        hitSlop={4}
      >
        <Layers size={24} color={colors.text} strokeWidth={1.5} />
        <Text
          style={[styles.cardValue, { color: themeColors.text }]}
          numberOfLines={1}
        >
          {first.number === null ? first.name : `#${first.number}`}
        </Text>
        <Text style={styles.cardLabel} numberOfLines={1}>
          {extra > 0 ? `Series +${extra}` : 'Series'}
        </Text>
      </Pressable>
    </>
  );
};

/* ------------------------------------------------------------------- mount */

/**
 * Where in `titleDetails` this instance is mounted. TWO anchors, not three:
 * `byline` and `chips` both live in the info column under Author/Narrator and
 * differ in FORM, not position. Giving chips its own anchor (below the genres
 * rather than above) would have been a tweak, not a structural variant — and
 * the prototype skill is explicit that three slightly-moved rows is wallpaper.
 */
export type SeriesLineSlot = 'title' | 'text' | 'cards';

const SLOT_OF: Record<Exclude<SeriesLineVariant, 'off'>, SeriesLineSlot> = {
  subheading: 'title',
  byline: 'text',
  chips: 'text',
  card: 'cards',
};

/**
 * Mounted THREE times in `titleDetails`, once per candidate position. Each
 * mount renders only when the selected variant belongs to it, so the real
 * screen carries three one-line commented slots and no branching logic.
 *
 * Renders nothing when the book is in no series — ticket 10's convention, and
 * the map's Out-of-scope ruling that an inapplicable item is ABSENT, never
 * disabled at 0.4 opacity.
 */
const ProtoSeriesLine = ({
  bookId,
  slot,
}: {
  bookId: string | undefined;
  slot: SeriesLineSlot;
}) => {
  const variant = useProtoStore((s) => s.seriesLineVariant);
  const items = useMemberships(bookId);

  if (!__DEV__) return null;
  if (variant === 'off') return null;
  if (SLOT_OF[variant] !== slot) return null;
  if (items.length === 0) return null;

  if (variant === 'subheading') return <SeriesSubheading items={items} />;
  if (variant === 'byline') return <SeriesByline items={items} />;
  if (variant === 'chips') return <SeriesChips items={items} />;
  return <SeriesCard items={items} />;
};

/**
 * The switcher. Deliberately NOT `ProtoPanel` — that one is bound to the
 * library screen's rendered series list. A bare cycler is enough here because
 * ticket 14 has exactly one knob.
 *
 * Visually loud and obviously not part of the design being judged, per the
 * prototype skill. Shows the membership count too, because "does this book even
 * have a series" is the first thing you check when a variant renders nothing.
 */
export const ProtoSeriesLinePill = ({ bookId }: { bookId: string | undefined }) => {
  const variant = useProtoStore((s) => s.seriesLineVariant);
  const setVariant = useProtoStore((s) => s.setSeriesLineVariant);
  const items = useMemberships(bookId);

  if (!__DEV__) return null;

  const idx = SERIES_LINE_VARIANTS.findIndex((v) => v.id === variant);
  const step = (d: number) => {
    const n = SERIES_LINE_VARIANTS.length;
    setVariant(SERIES_LINE_VARIANTS[(idx + d + n) % n].id);
  };

  return (
    <View style={styles.pill} pointerEvents='box-none'>
      <Pressable onPress={() => step(-1)} style={styles.pillArrow} hitSlop={10}>
        <Text style={styles.pillArrowText}>‹</Text>
      </Pressable>
      <Text style={styles.pillLabel}>
        14 · {SERIES_LINE_VARIANTS[idx]?.label ?? variant} · {items.length} series
      </Text>
      <Pressable onPress={() => step(1)} style={styles.pillArrow} hitSlop={10}>
        <Text style={styles.pillArrowText}>›</Text>
      </Pressable>
    </View>
  );
};

/**
 * `Add to series…` — ticket 14's third question, which is only about ORDER.
 *
 * Ticket 10 already ruled it is **always present**: multi-membership means any
 * book can always join another series, so it has no inapplicable state and
 * never has to face the absent-vs-disabled convention that the map's Out of
 * scope section reversed.
 *
 * Sited directly under `Edit Book Details` on the argument that both act on
 * what the book IS, while `Remove Auto-Chapters` and `Mark as finished` act on
 * how it PLAYS. Flip it by moving this one mount.
 *
 * Read-only stub — the prototype skill's rule. The real one opens a picker.
 */
export const ProtoAddToSeriesMenuItem = ({ onPress }: { onPress: () => void }) => {
  const { colors: themeColors } = useTheme();
  // Gated on the same knob so `Off (control)` really is the shipping screen —
  // otherwise the control would already carry half the feature.
  const variant = useProtoStore((s) => s.seriesLineVariant);
  if (!__DEV__ || variant === 'off') return null;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.menuItem, { borderBottomColor: themeColors.divider }]}
    >
      <Layers size={20} color={themeColors.text} strokeWidth={1.5} />
      <Text style={[styles.menuItemText, { color: themeColors.text }]}>
        Add to series…
      </Text>
    </Pressable>
  );
};

export default ProtoSeriesLine;

const styles = StyleSheet.create({
  /*
   * Subheading — sits under the centred title, so it centres too.
   *
   * The negative margin is load-bearing. `bookInfoColumn` sets `gap: 20`, which
   * applies between EVERY child, so as a plain child this line sat 20dp below
   * the title and read as its own block. The driver asked for the gap the
   * `Read by` label has above the narrator's name — and those two Texts sit in a
   * bare View with NO gap at all, so the target is pure line spacing.
   * -17 against the parent's 20 leaves ~3dp. The 20dp gap BELOW is untouched,
   * which is what keeps the subheading part of the title block rather than part
   * of the author block.
   */
  subheadingRow: {
    width: '100%',
    alignItems: 'center',
    marginTop: -17,
  },
  subheading: { fontFamily: 'Rubik', fontSize: fontSize.sm },

  /* byline */
  bylineBlock: { width: '100%', gap: 6, paddingTop: 4 },
  bylineRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bylineName: { fontFamily: 'Rubik', fontSize: fontSize.sm, flexShrink: 1 },
  bylineNum: { fontFamily: 'Rubik', fontSize: fontSize.sm },

  /* chips */
  chipRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.modalBackground,
    maxWidth: '100%',
  },
  chipText: { fontFamily: 'Rubik', fontSize: fontSize.sm, flexShrink: 1 },

  /* card — mirrors `titleDetails`' own infoCard/listInfoText exactly */
  card: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cardValue: { fontFamily: 'Rubik', fontSize: fontSize.sm, paddingTop: 6 },
  cardLabel: { fontFamily: 'Rubik', fontSize: 14, color: '#d8dee9ac' },
  cardDivider: {
    height: '70%',
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#d8dee945',
  },

  /* overflow item — mirrors `titleDetails`' own menuItem/menuItemText */
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  menuItemText: { fontFamily: 'Rubik', fontSize: 16 },

  /* switcher */
  pill: {
    position: 'absolute',
    left: 12,
    bottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#FF2D95',
  },
  pillArrow: { paddingHorizontal: 6 },
  pillArrowText: { color: '#fff', fontSize: 18, lineHeight: 20 },
  pillLabel: { color: '#fff', fontFamily: 'Rubik', fontSize: 11 },
});
