/**
 * THROWAWAY — ticket 15, variant F: THE AUTHOR ACCORDION.
 *
 * F keeps everything E settled and challenges exactly one thing: whether
 * `Authors → Books` needs to be two steps at all.
 *
 *   E   pick authors ─Next─▶ see their books ─Next─▶ Order ─▶ Save
 *   F   tap an author, their books unfold in place ─Next─▶ Order ─▶ Save
 *
 * The claim: an author gate and a book list are the same list at two zoom
 * levels, so an accordion expresses both without a step between them. If that
 * holds, F deletes the last stage boundary in the create flow — the funnel is
 * gone rather than merely folded up, and `Next` is pressed once instead of
 * twice.
 *
 * What it keeps, unchanged, from E: the whole editor surface below the panel
 * (`editorShell.tsx`), staged selection, the numbering rule, no book totals.
 * Those are settled; re-litigating them here would make the A/B unreadable.
 *
 * ── ONE AT A TIME ─────────────────────────────────────────────────────────
 *
 * `expanded` is a single nullable name, not a Set. The driver asked for it and
 * it is also the only version that pays for itself: with several authors open,
 * the books you are choosing between are separated by however many rows the
 * other open authors contribute, and the accordion stops being a way to see one
 * author's shelf. Collapsing on expand keeps the answer to "what am I choosing
 * between?" on one screen.
 *
 * ── ROW STYLING ───────────────────────────────────────────────────────────
 *
 * Single column, drawn after the Android file picker the driver supplied: a
 * quiet outline glyph, a plain name at reading size, and a hairline rule
 * INDENTED to the text's left edge so the glyph column reads as a gutter rather
 * than as a cell. The folder is replaced by the circle-check, which does a job
 * a folder cannot: it reports whether this author is contributing anything to
 * the series, so a collapsed list still shows you where your picks are.
 *
 * ── What F must actually be judged on ─────────────────────────────────────
 *
 * NOT density. Single column shows ~7 authors per screen against E's ~18, and
 * the driver ruled that cost small — one flick reaches the bottom either way.
 *
 * The real axis is **how many authors one create involves**:
 *
 *   one author    F is one press shorter than E. Always exactly one — a
 *                 constant, not a saving that grows with the work.
 *   many authors  E multi-selects the authors and then shows every candidate
 *                 book on ONE merged list. F never shows more than one author's
 *                 books at a time, so a 10-author Favorites list is 10
 *                 expand/collapse cycles with no moment of seeing the whole set.
 *
 * That is the same axis as the ticket's unanswered question — a cross-author
 * playlist versus rescuing one author's real series — so choosing between E and
 * F very likely means answering it.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import { Circle, CircleCheck, X } from 'lucide-react-native';

import { useTheme } from '@/hooks/useTheme';
import { SeriesBookRow } from '@/components/SeriesBookRow';
import { useLibraryStore } from '@/store/library';
import { bookStructuralKey } from '@/helpers/bookStructuralKey';
import { fontSize, screenPadding } from '@/constants/tokens';
import { useProtoStore } from '@/prototypes/protoStore';
import {
  AddBooksButton,
  EditorIdentityRow,
  OrderedList,
  useHeroUri,
  useNumbering,
} from './editorShell';
import {
  ProtoWizardFooter,
  ProtoWizardHeader,
  rippleOf,
  styles as shared,
  useAuthorCells,
  useBookPool,
  useHardwareBack,
  useKeyMap,
  useWizardDraft,
} from './wizardShared';

export default function VariantF({ onExit }: { onExit: () => void }) {
  const { colors: themeColors } = useTheme();

  const [panelOpen, setPanelOpen] = useState(true);
  /** Single nullable name — see header. Never a Set. */
  const [expanded, setExpanded] = useState<string | null>(null);
  const [staged, setStaged] = useState<string[]>([]);

  const authorPad = useProtoStore((s) => s.authorPad);
  const setAuthorPad = useProtoStore((s) => s.setAuthorPad);

  const name = useWizardDraft((s) => s.name);
  const setName = useWizardDraft((s) => s.setName);
  const ordered = useWizardDraft((s) => s.ordered);
  const toggleBook = useWizardDraft((s) => s.toggleBook);
  const setOrdered = useWizardDraft((s) => s.setOrdered);

  const authorCells = useAuthorCells(authorPad);
  const keyMap = useKeyMap();
  const scrollableRef = useAnimatedRef<Animated.ScrollView>();

  // Only the expanded author's books are ever fetched. An empty allow-list
  // yields an empty pool, which is the collapsed state — no branch needed.
  const allowList = useMemo(() => (expanded ? [expanded] : []), [expanded]);
  const { rows } = useBookPool({ query: '', authorAllowList: allowList });
  const expandedBooks = useMemo(
    () => rows.filter((r) => r.type === 'book'),
    [rows],
  );

  /** author name → its books' structural keys, for the collapsed-row check. */
  const authors = useLibraryStore((s) => s.authors);
  const authorKeys = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of authors) {
      const keys: string[] = [];
      for (const b of a.books) {
        const k = bookStructuralKey(b);
        if (k) keys.push(k);
      }
      m.set(a.name, keys);
    }
    return m;
  }, [authors]);

  const titleOf = useCallback(
    (key: string) => keyMap.get(key)?.bookTitle ?? '',
    [keyMap],
  );
  const heroUri = useHeroUri(ordered, keyMap);
  const numbering = useNumbering({ ordered, setOrdered, titleOf });

  const contributes = useCallback(
    (authorName: string) => {
      const keys = authorKeys.get(authorName);
      if (!keys) return false;
      return keys.some((k) => ordered.includes(k) || staged.includes(k));
    },
    [authorKeys, ordered, staged],
  );

  /* ----------------------------------------------------------- panel --- */

  const openPicker = useCallback(() => {
    setStaged([]);
    setExpanded(null);
    setPanelOpen(true);
  }, []);

  const commitStaged = useCallback(() => {
    setOrdered([...ordered, ...staged.filter((k) => !ordered.includes(k))]);
    setStaged([]);
    setExpanded(null);
    setPanelOpen(false);
  }, [ordered, staged, setOrdered]);

  const dismissPanel = useCallback(() => {
    setStaged([]);
    setExpanded(null);
    if (ordered.length > 0) {
      setPanelOpen(false);
      return;
    }
    onExit();
  }, [ordered.length, onExit]);

  const back = useCallback(() => {
    // Collapsing is a real step back — it is the only thing the accordion has
    // that resembles a stage, so back should undo it before leaving.
    if (panelOpen && expanded) {
      setExpanded(null);
      return true;
    }
    if (panelOpen) {
      dismissPanel();
      return true;
    }
    onExit();
    return true;
  }, [panelOpen, expanded, dismissPanel, onExit]);
  useHardwareBack(back);

  /* ----------------------------------------------------------- footer --- */

  const footerActive = panelOpen
    ? staged.length > 0 || ordered.length > 0
    : name.trim().length > 0 && ordered.length > 0;

  const onFooter = useCallback(() => {
    if (panelOpen) {
      if (staged.length === 0 && ordered.length === 0) {
        Alert.alert("Can't continue", 'Select at least one book.');
        return;
      }
      commitStaged();
      return;
    }
    if (name.trim().length === 0) {
      Alert.alert("Can't save", 'Enter a series name.');
      return;
    }
    if (ordered.length === 0) {
      Alert.alert("Can't save", 'Add at least one book.');
      return;
    }
    Alert.alert(`Would save “${name.trim()}”`, numbering.buildSaveBody(), [
      { text: 'OK', onPress: onExit },
    ]);
  }, [panelOpen, staged.length, ordered.length, name, numbering, commitStaged, onExit]);

  return (
    <View style={shared.screen}>
      <ProtoWizardHeader
        title={name.trim() || 'New series'}
        subtitle={
          panelOpen
            ? 'Tap an author to see their books.'
            : 'Drag to order. Number them if you want to.'
        }
        onBack={back}
      />

      <Animated.ScrollView
        ref={scrollableRef}
        style={shared.list}
        contentContainerStyle={localStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps='handled'
      >
        <EditorIdentityRow name={name} onChangeName={setName} heroUri={heroUri} />

        {ordered.length > 0 && (
          <OrderedList
            ordered={ordered}
            setOrdered={setOrdered}
            keyMap={keyMap}
            numbers={numbering.numbers}
            setNumber={numbering.setNumber}
            onRemove={toggleBook}
            scrollableRef={scrollableRef}
            sortByNumber={numbering.sortByNumber}
            numberedCount={numbering.numberedCount}
            numberingNote={numbering.numberingNote}
          />
        )}

        {!panelOpen ? (
          <AddBooksButton onPress={openPicker} />
        ) : (
          <View style={[localStyles.panel, { borderColor: themeColors.primary }]}>
            <View style={localStyles.panelHead}>
              <Text style={[localStyles.panelTitle, { color: themeColors.text }]}>
                Add books
              </Text>
              <Pressable onPress={dismissPanel} hitSlop={10}>
                <X size={20} color={themeColors.textMuted} />
              </Pressable>
            </View>

            {/* Two crumbs, not three: the accordion is ONE stage. That the
                breadcrumb got shorter is the whole result of this variant. */}
            <View style={localStyles.crumbRow}>
              <Text style={[localStyles.crumb, { color: themeColors.primary, fontWeight: '600' }]}>
                Books
              </Text>
              <Text style={[localStyles.crumb, { color: themeColors.textMuted }]}>›</Text>
              <Text style={[localStyles.crumb, { color: themeColors.textMuted }]}>
                Order
              </Text>
            </View>

            <View style={localStyles.accordion}>
              {authorCells.map((cell) => (
                <AuthorAccordionRow
                  key={cell.name}
                  name={cell.name}
                  synthetic={cell.synthetic}
                  expanded={expanded === cell.name}
                  contributes={contributes(cell.name)}
                  // Tapping an open author closes it; tapping another swaps.
                  onPress={() =>
                    setExpanded((prev) => (prev === cell.name ? null : cell.name))
                  }
                >
                  {expandedBooks.map((row) =>
                    row.type === 'book' ? (
                      <BookChoice
                        key={row.key}
                        bookId={row.book.bookId}
                        title={row.book.bookTitle}
                        author={row.book.author}
                        artwork={row.book.artwork}
                        alreadyIn={ordered.includes(row.bookKey)}
                        staged={staged.includes(row.bookKey)}
                        onPress={() =>
                          setStaged((prev) =>
                            prev.includes(row.bookKey)
                              ? prev.filter((k) => k !== row.bookKey)
                              : [...prev, row.bookKey],
                          )
                        }
                      />
                    ) : null,
                  )}
                </AuthorAccordionRow>
              ))}
            </View>

            <Pressable
              onPress={() => setAuthorPad(!authorPad)}
              style={localStyles.padToggle}
              hitSlop={8}
            >
              <Text style={localStyles.padToggleText}>
                {authorPad ? 'real authors only' : '+90 fake authors'}
              </Text>
            </Pressable>
          </View>
        )}
      </Animated.ScrollView>

      <ProtoWizardFooter
        leftLabel='Cancel'
        onLeft={onExit}
        rightLabel={panelOpen ? 'Next' : 'Save'}
        rightActive={footerActive}
        onRight={onFooter}
      />
    </View>
  );
}

/**
 * One author row, plus its unfolded books when open.
 *
 * Styled after the file picker the driver supplied: 24px outline glyph in a
 * gutter, name at reading size in the default weight, and a hairline rule
 * indented past the gutter. Deliberately NOT a card — cards were E's answer, and
 * drawing F as cards too would hide the difference being tested behind a
 * shared skin.
 *
 * The glyph is the state, and it carries two meanings at once without a second
 * control: FILLED means this author has books in the series (staged or already
 * committed), so a fully collapsed list still shows where your picks are.
 */
function AuthorAccordionRow({
  name,
  synthetic,
  expanded,
  contributes,
  onPress,
  children,
}: {
  name: string;
  synthetic: boolean;
  expanded: boolean;
  contributes: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { colors: themeColors } = useTheme();
  const Glyph = contributes ? CircleCheck : Circle;
  return (
    <View>
      <Pressable
        onPress={synthetic ? undefined : onPress}
        android_ripple={rippleOf(themeColors.divider)}
        style={[localStyles.authorRow, synthetic && localStyles.authorRowSynthetic]}
      >
        <Glyph
          size={GUTTER}
          color={contributes ? themeColors.primary : themeColors.icon}
        />
        <Text
          numberOfLines={1}
          style={[
            localStyles.authorName,
            {
              color: expanded ? themeColors.primary : themeColors.text,
              fontWeight: expanded ? '600' : '400',
            },
          ]}
        >
          {name}
        </Text>
      </Pressable>
      {expanded && <View style={localStyles.expandedBooks}>{children}</View>}
      <View
        style={[localStyles.rule, { backgroundColor: themeColors.divider }]}
      />
    </View>
  );
}

function BookChoice({
  bookId,
  title,
  author,
  artwork,
  alreadyIn,
  staged,
  onPress,
}: {
  bookId?: string;
  title?: string;
  author?: string | null;
  artwork?: string | null;
  alreadyIn: boolean;
  staged: boolean;
  onPress: () => void;
}) {
  return (
    <View style={alreadyIn ? localStyles.bookRowAlreadyIn : undefined}>
      <SeriesBookRow
        context='selection'
        bookId={bookId}
        title={title}
        author={author}
        artwork={artwork}
        selected={alreadyIn || staged}
        // Already-in books are inert: removing one from HERE would shrink the
        // list above and reintroduce the jump staging exists to prevent.
        onPress={alreadyIn ? undefined : onPress}
      />
    </View>
  );
}

/**
 * Row metrics. `fontSize.base` (**20** in this app's scale, not the 16 it reads
 * as) with a 24px glyph — SETTLED on device, do not shrink again.
 *
 * A 15px/20px/11-padding variant was built and driven on 2026-08-04 and the
 * driver rejected it on sight as too small, so this is a tested choice rather
 * than a first draft. What the experiment bought:
 *
 *   20px · 24px glyph · 14 padding  →  ~60dp  →   7 authors/screen  ← this
 *   15px · 20px glyph · 11 padding  →  ~42dp  →  11 authors/screen  ← rejected
 *
 * And the density it bought turned out not to be worth buying: the driver also
 * ruled that **scroll cost is not what decides this variant** — a single flick
 * reaches the bottom of the list, so screens-of-content measures the list rather
 * than the effort. Both mitigations that framing implied (an A-Z rail, a filter
 * field) are CLOSED; see the ticket. Nothing here should be traded for density.
 *
 * `GUTTER` sizes the glyph as well as the rule's indent, so the hairline stays
 * locked to the glyph column by construction rather than by two numbers
 * happening to agree.
 */
const GUTTER = 24;
const GUTTER_GAP = 16;

const localStyles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: 12,
    paddingBottom: 16,
  },

  panel: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.base,
  },
  crumbRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  crumb: { fontFamily: 'Rubik', fontSize: 12 },

  accordion: { marginTop: 2 },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GUTTER_GAP,
    paddingVertical: 14,
  },
  authorRowSynthetic: { opacity: 0.38 },
  authorName: { flex: 1, fontFamily: 'Rubik', fontSize: fontSize.base },
  // Indented past the glyph gutter, exactly as in the reference picker.
  rule: { height: StyleSheet.hairlineWidth, marginLeft: GUTTER + GUTTER_GAP },

  expandedBooks: {
    marginLeft: GUTTER + GUTTER_GAP,
    paddingBottom: 10,
    gap: 8,
  },
  bookRowAlreadyIn: { opacity: 0.45 },

  padToggle: {
    alignSelf: 'center',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#B5179E',
  },
  padToggleText: { color: '#fff', fontFamily: 'Rubik', fontSize: 10 },
});
