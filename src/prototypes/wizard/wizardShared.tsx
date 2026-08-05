/**
 * THROWAWAY — Series UX redesign prototype harness, ticket 15.
 * Delete with `rm -rf src/prototypes` (see ../README.md).
 *
 * Shared furniture for the four create-flow variants. Three things live here
 * because they are 05's three logged defects, and the ticket requires them
 * fixed in WHATEVER shape wins — so no variant may be judged on them:
 *
 *   1. `ProtoWizardFooter`'s inactive button is an OUTLINE in the primary
 *      colour, not `divider`-on-`textMuted`. The shipping wizard paints a
 *      light grey rectangle and writes muted grey on it, which is unreadable
 *      at every contrast ratio (authors.tsx:127-137, books.tsx:202-217).
 *   2. `ProtoWizardHeader` is the app header the wizard has never had — back
 *      affordance, title, and a step indicator that tells you how much is left.
 *   3. Every list here is `flex: 1` — a tidiness change that turned out to fix
 *      NOTHING. See the correction below.
 *
 * ── CORRECTION, measured on device 2026-08-04 ────────────────────────────
 *
 * While building this I claimed 05's "large dead vertical region" was a
 * one-word layout bug: `authors.tsx:108` and `books.tsx:179` render a bare
 * `<FlatList>` with no `flex: 1`, so (I reasoned) the list sizes to its
 * content and the footer floats mid-screen. **That is wrong.** The shipping
 * wizard was driven side by side with variant A and its footer is pinned to
 * the bottom exactly as A's is — RN's FlatList takes the remaining space here
 * regardless. Adding `flex: 1` changed nothing visible.
 *
 * What the dead region actually is: **the wizard has too little on each
 * screen.** Step 1 is four author rows and 1,900px of nothing. That makes it
 * an argument about SHAPE, not styling — and therefore ticket 15's business
 * rather than a defect to be swept up. Variants B, C and D all shrink it by
 * putting more on each screen; no amount of layout tidying does.
 *
 * The book pool holds BOTH readings of "what is the wizard for" open, because
 * the driver deferred that to the device session: it carries a search field
 * (the playlist reading — a playlist spans authors, so an author gate is wrong
 * by construction) AND keeps author group headings (the rescue reading — the
 * ~4% dark books are genuinely author-scoped real series). Whichever reading
 * wins, the evidence for it is on screen.
 */
import React, { useEffect, useMemo } from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { create } from 'zustand';
import { ChevronLeft, Search, X } from 'lucide-react-native';

import { useTheme } from '@/hooks/useTheme';
import { useLibraryStore } from '@/store/library';
import { bookStructuralKey } from '@/helpers/bookStructuralKey';
import { compareBookTitles } from '@/helpers/miscellaneous';
import { fontSize, screenPadding } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
import { Book } from '@/types/Book';

/* ------------------------------------------------------------------ draft -- */

/**
 * The prototype's own draft. Deliberately NOT `useSeriesDraftStore`: that store
 * is real code shaped around the three-step funnel (`selectedAuthorNames` is a
 * field on it), and three of the four variants exist to question that shape.
 * Borrowing it would have smuggled the answer in.
 *
 * Nothing here reaches the database. `createSeries` is never called.
 */
type WizardDraftState = {
  name: string;
  /** Only variant A uses this. Its absence elsewhere is the point. */
  authorFilter: string[];
  /** Selection order is NOT series order — `ordered` is the source of truth. */
  ordered: string[];
  query: string;
  setName: (name: string) => void;
  setQuery: (query: string) => void;
  toggleAuthor: (name: string) => void;
  /** Variant E only: `+ Add books` starts a fresh author pass. */
  clearAuthors: () => void;
  toggleBook: (key: string) => void;
  setOrdered: (keys: string[]) => void;
  reset: () => void;
};

export const useWizardDraft = create<WizardDraftState>()((set) => ({
  name: '',
  authorFilter: [],
  ordered: [],
  query: '',
  setName: (name) => set({ name }),
  setQuery: (query) => set({ query }),
  toggleAuthor: (name) =>
    set((s) => ({
      authorFilter: s.authorFilter.includes(name)
        ? s.authorFilter.filter((n) => n !== name)
        : [...s.authorFilter, name],
    })),
  clearAuthors: () => set({ authorFilter: [] }),
  // Selecting appends, so the order step arrives seeded in the order you
  // picked. The shipping wizard instead re-sorts into author-grouped title
  // order at books.tsx:103 — worth watching for, because a hand-made playlist
  // is often picked in the order you want it (07: it seeds canonical NULL, so
  // nothing else can order it).
  toggleBook: (key) =>
    set((s) => ({
      ordered: s.ordered.includes(key)
        ? s.ordered.filter((k) => k !== key)
        : [...s.ordered, key],
    })),
  setOrdered: (ordered) => set({ ordered }),
  reset: () => set({ name: '', authorFilter: [], ordered: [], query: '' }),
}));

/* ------------------------------------------------------------------- pool -- */

export type PoolRow =
  | { type: 'heading'; key: string; name: string; count: number }
  | { type: 'book'; key: string; book: Book; bookKey: string };

/**
 * Every book in the library as author-grouped rows, narrowed by `query` and
 * (optionally) by an explicit author allow-list.
 *
 * The query matches title OR author, so typing an author's name reproduces
 * exactly what variant A's step 1 does — which is the whole argument that the
 * step is a filter, not a stage.
 */
export function useBookPool({
  query,
  authorAllowList,
}: {
  query: string;
  authorAllowList?: string[];
}): { rows: PoolRow[]; matchCount: number; totalCount: number } {
  const authors = useLibraryStore((state) => state.authors);

  return useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows: PoolRow[] = [];
    let matchCount = 0;
    let totalCount = 0;

    const groups = [...authors]
      .filter((a) => !authorAllowList || authorAllowList.includes(a.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const group of groups) {
      const sorted = [...group.books].sort((a, b) =>
        compareBookTitles(a.bookTitle, b.bookTitle),
      );
      const matched: PoolRow[] = [];
      for (const book of sorted) {
        const bookKey = bookStructuralKey(book);
        if (!bookKey) continue;
        totalCount += 1;
        if (
          needle.length > 0 &&
          !book.bookTitle?.toLowerCase().includes(needle) &&
          !group.name.toLowerCase().includes(needle)
        ) {
          continue;
        }
        matched.push({ type: 'book', key: bookKey, book, bookKey });
      }
      if (matched.length === 0) continue;
      matchCount += matched.length;
      rows.push({
        type: 'heading',
        key: `author-${group.name}`,
        name: group.name,
        count: matched.length,
      });
      rows.push(...matched);
    }
    return { rows, matchCount, totalCount };
  }, [authors, query, authorAllowList]);
}

/** Structural key → live Book, for rendering an ordered list of keys. */
export function useKeyMap(): Map<string, Book> {
  const books = useLibraryStore((state) => state.books);
  return useMemo(() => {
    const m = new Map<string, Book>();
    for (const book of Object.values(books)) {
      const key = bookStructuralKey(book);
      if (key) m.set(key, book);
    }
    return m;
  }, [books]);
}

/* ---------------------------------------------------------- authors ------ */

export type AuthorCell = { name: string; synthetic: boolean };

/**
 * Deterministic filler so the 2-column author grid can be judged at the scale
 * it will actually meet.
 *
 * The driver is "planning against looking through 50-100 authors"; the emulator
 * corpus has eight books by a handful of authors. A density question cannot be
 * answered at 1/12th density, so the grid gets padding — but padding that can
 * never be mistaken for data:
 *
 *   - synthetic cells are NOT selectable and render dimmed, so pressing Next
 *     can never land you in an empty book step wondering what broke;
 *   - the toggle that turns them on is harness pink, like every other knob.
 *
 * Name lengths are deliberately uneven, with two deliberately overlong ones, so
 * the cell's truncation behaviour is exercised rather than assumed.
 */
const SYNTHETIC_FIRSTS = [
  'Alice', 'Bernard', 'Cordelia', 'Devon', 'Eleanora', 'Frank', 'Guinevere',
  'Hamish', 'Imogen', 'Jasper', 'Katarina', 'Lucian', 'Marguerite', 'Nathaniel',
  'Ottoline', 'Persephone', 'Quentin', 'Rosalind', 'Sebastian', 'Theodora',
  'Ulysses', 'Vivienne', 'Wendell', 'Xiomara', 'Yolanda', 'Zachariah',
];
const SYNTHETIC_LASTS = [
  'Ash', 'Blackwood', 'Carrington', 'Dunmore', 'Ellsworth', 'Fairweather',
  'Grimshaw', 'Hollingsworth', 'Inglethorpe', 'Jessop', 'Kingsley', 'Lockhart',
  'Merriweather', 'Northcote', 'Ovington', 'Pemberton', 'Quill', 'Ravensworth',
  'Stanhope', 'Thornbury', 'Underhill', 'Vandermeer', 'Wycliffe', 'Yarborough',
];

const SYNTHETIC_AUTHORS: AuthorCell[] = (() => {
  const out: AuthorCell[] = [
    // The two that test truncation rather than density.
    { name: 'Marguerite Featherstonehaugh-Whitmore', synthetic: true },
    { name: 'K. J. Ó Súilleabháin-Rasmussen', synthetic: true },
  ];
  for (let i = 0; i < 88; i += 1) {
    const first = SYNTHETIC_FIRSTS[i % SYNTHETIC_FIRSTS.length];
    const last = SYNTHETIC_LASTS[(i * 7 + 3) % SYNTHETIC_LASTS.length];
    out.push({ name: `${first} ${last}`, synthetic: true });
  }
  return out;
})();

/** Real library authors, alphabetical, optionally padded to ~100 for density. */
export function useAuthorCells(pad: boolean): AuthorCell[] {
  const authors = useLibraryStore((state) => state.authors);
  return useMemo(() => {
    const real: AuthorCell[] = authors.map((a) => ({
      name: a.name,
      synthetic: false,
    }));
    const all = pad ? [...real, ...SYNTHETIC_AUTHORS] : real;
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }, [authors, pad]);
}

/* ------------------------------------------------------------ back key --- */

/**
 * Hardware back → previous step.
 *
 * The shipping wizard gets this free, because each step is a real pushed route
 * inside `series/_layout.tsx`. These variants hold their steps in component
 * state instead, which is a deliberate FIDELITY LIMIT, not an oversight:
 * ticket 05 settled presentation (opaque full-screen push) and ticket 15
 * forbids reopening it, so what is being judged here is how many steps there
 * are and what sits on them — not how a step transition animates. Four real
 * route groups would have cost ten route files to test nothing this ticket
 * asks about.
 *
 * What IS lost: the push/pop animation between steps, and the edge-swipe
 * gesture. Return `true` to swallow the event so back never exits the app
 * mid-flow.
 */
export function useHardwareBack(handler: () => boolean) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, [handler]);
}

/* --------------------------------------------------------------- chrome --- */

/** 05 defect 2: the wizard has no app header. */
export function ProtoWizardHeader({
  title,
  subtitle,
  step,
  ofSteps,
  onBack,
}: {
  title: string;
  subtitle?: string;
  step?: number;
  ofSteps?: number;
  onBack: () => void;
}) {
  const { colors: themeColors } = useTheme();
  return (
    <View style={[styles.header, { borderBottomColor: themeColors.divider }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.headerBack}>
          <ChevronLeft size={26} color={themeColors.text} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={[styles.headerTitle, { color: themeColors.text }]}
        >
          {title}
        </Text>
        {step && ofSteps ? (
          <Text style={[styles.headerStep, { color: themeColors.textMuted }]}>
            {step} of {ofSteps}
          </Text>
        ) : (
          <View style={styles.headerStepSpacer} />
        )}
      </View>
      {!!subtitle && (
        <Text style={[styles.headerSubtitle, { color: themeColors.textMuted }]}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

/**
 * 05 defect 1: the inactive primary button.
 *
 * The shipping styling drops the label out of sight because both the fill and
 * the text go grey at once. Keeping the OUTLINE and the primary-coloured label
 * preserves the shipping behaviour that matters — the button stays pressable
 * so it can explain what is missing (authors.tsx:37-43, a deliberate choice
 * worth keeping) — while leaving the word legible.
 */
export function ProtoPrimaryButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors: themeColors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.primaryButton,
        active
          ? { backgroundColor: themeColors.primary, borderColor: themeColors.primary }
          : { backgroundColor: 'transparent', borderColor: themeColors.primary },
      ]}
    >
      <Text
        style={[
          styles.primaryLabel,
          { color: active ? themeColors.background : themeColors.primary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ProtoWizardFooter({
  leftLabel,
  onLeft,
  rightLabel,
  rightActive,
  onRight,
  note,
}: {
  leftLabel: string;
  onLeft: () => void;
  rightLabel: string;
  rightActive: boolean;
  onRight: () => void;
  note?: string;
}) {
  const { colors: themeColors } = useTheme();
  return (
    <View style={[styles.footer, { borderTopColor: themeColors.divider }]}>
      <Pressable onPress={onLeft} style={styles.footerButton} hitSlop={8}>
        <Text style={[styles.footerLeft, { color: themeColors.textMuted }]}>
          {leftLabel}
        </Text>
      </Pressable>
      {!!note && (
        <Text
          numberOfLines={1}
          style={[styles.footerNote, { color: themeColors.textMuted }]}
        >
          {note}
        </Text>
      )}
      <ProtoPrimaryButton
        label={rightLabel}
        active={rightActive}
        onPress={onRight}
      />
    </View>
  );
}

/** Name field + search field, the two inputs every variant but A's step 1 has. */
export function ProtoSearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const { colors: themeColors } = useTheme();
  return (
    <View
      style={[
        styles.searchWrap,
        { borderColor: themeColors.divider },
      ]}
    >
      <Search size={17} color={themeColors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={themeColors.textMuted}
        style={[styles.searchInput, { color: themeColors.text }]}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={10}>
          <X size={17} color={themeColors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

export function ProtoNameField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { colors: themeColors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder='Series name (required)'
      placeholderTextColor={themeColors.textMuted}
      style={[
        styles.nameInput,
        { color: themeColors.text, borderColor: themeColors.divider },
      ]}
    />
  );
}

/**
 * `count` is OPTIONAL as of variant E, and E omits it.
 *
 * The driver's ruling, 2026-08-04: "drop the book totals from the designs. they
 * are not additive, but confusing." A per-author tally answers a question nobody
 * asked (how prolific is this author?) while the question actually on screen is
 * "which of these belong in the series?" — so it is noise competing with the
 * only signal that matters.
 *
 * Kept optional rather than deleted so A–D still render exactly as they were
 * judged. Rewriting a rejected variant destroys the comparison record.
 */
export function ProtoAuthorHeading({
  name,
  count,
}: {
  name: string;
  count?: number;
}) {
  const { colors: themeColors } = useTheme();
  return (
    <View style={styles.authorHeadingRow}>
      <Text style={[styles.authorHeading, { color: themeColors.textMuted }]}>
        {name}
      </Text>
      {count !== undefined && (
        <Text style={[styles.authorCount, { color: themeColors.textMuted }]}>
          {count}
        </Text>
      )}
    </View>
  );
}

export function ProtoEmptyPool({ query }: { query: string }) {
  const { colors: themeColors } = useTheme();
  return (
    <View style={styles.emptyPool}>
      <Text style={[styles.emptyPoolText, { color: themeColors.textMuted }]}>
        {query.trim().length > 0
          ? `Nothing matches “${query.trim()}”.`
          : 'No books in the library.'}
      </Text>
    </View>
  );
}

export const rippleOf = (color: string) => ({ color: withOpacity(color, 0.16) });

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBack: { marginLeft: -6 },
  headerTitle: {
    flex: 1,
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.lg,
  },
  headerStep: { fontFamily: 'Rubik', fontSize: fontSize.sm },
  headerStepSpacer: { width: 1 },
  headerSubtitle: { fontFamily: 'Rubik', fontSize: fontSize.sm },
  body: {
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: 10,
    gap: 10,
  },
  // THE FIX for 05's dead region: the list must grow, or the footer floats.
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: 8,
    gap: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: { paddingVertical: 12, paddingHorizontal: 8 },
  footerLeft: { fontFamily: 'Rubik', fontSize: fontSize.base },
  footerNote: { flex: 1, textAlign: 'right', fontFamily: 'Rubik', fontSize: 13 },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  primaryLabel: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.base,
  },
  nameInput: {
    fontFamily: 'Rubik',
    fontSize: fontSize.base,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Rubik',
    fontSize: fontSize.base,
    paddingVertical: 10,
  },
  authorHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  authorHeading: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  authorCount: { fontFamily: 'Rubik', fontSize: 12 },
  emptyPool: { paddingVertical: 40, alignItems: 'center' },
  emptyPoolText: { fontFamily: 'Rubik', fontSize: fontSize.sm },
});
