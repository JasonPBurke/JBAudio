/**
 * THROWAWAY — ticket 15, variant E: D's SURFACE, THE FUNNEL FOLDED INTO IT.
 *
 * The driver rejected all four of A–D on device and specified E out of their
 * parts. It is D's shape — one editor surface for create and edit — with the
 * funnel demoted from three SCREENS to two steps inside a panel on that surface,
 * and the third stage (Order) relocated to the list where the series lives.
 *
 *   Authors ─Next─▶ Books ─Next─▶ (panel closes) ─▶ Order in the list ─▶ Save
 *
 * Everything from the identity row down is `editorShell.tsx`, shared with
 * variant F. What is E's own, and what F exists to challenge, is the PANEL:
 * two steps, authors then books.
 *
 * ── The five things E changes from D, and why each is a change ────────────
 *
 * 1. NO NAME PROMPT. D opened on a dialog. Here the name field is just a field
 *    in the identity row and the panel opens on Authors immediately, so naming
 *    can happen before or after picking — the driver's call. D's prompt was one
 *    stop that bought nothing the field doesn't.
 *
 * 2. THE AUTHOR PICKER RETURNS, but as a step INSIDE the panel rather than a
 *    screen. This reverses the search field that B introduced and that the
 *    findings called "the strongest single result of the session" —
 *    deliberately. The driver's stated use is scanning 50-100 authors to find a
 *    series, which is a BROWSE, and search only helps someone who already knows
 *    the name.
 *
 * 3. SELECTION IS STAGED. Tapping a book does NOT touch `ordered`. D committed
 *    on every tap, so the list above grew and shoved the panel down the screen —
 *    "very jarring", and structural rather than cosmetic: in D the panel and the
 *    list share one scroll view, so anything landing above the panel must move
 *    it. Measured on device: one tap moved 547,334 px in D and 28,488 in E (the
 *    tapped row's own border and bubble), with 0 changed pixels above the panel.
 *
 * 4. NUMBERS START EMPTY — the driver's rule, implemented in `useNumbering`.
 *
 * 5. NO BOOK TOTALS anywhere — no per-author tally, no "N picked", no "M shown".
 *    Driver's ruling: not additive, confusing.
 *
 * ── D's logged cost that E actually resolves ──────────────────────────────
 *
 * D inherited "Edit series" / "Delete Series" wording for a series that does not
 * exist yet. E drops Delete from the create pass entirely: on one shared
 * surface, Delete is a function of EDITING something, so it appears when there
 * is something to delete.
 *
 * ── Fidelity limits ───────────────────────────────────────────────────────
 *
 * The author grid and the book pool render unvirtualized inside the outer
 * `Animated.ScrollView` (a nested `FlatList` would warn, and `Sortable.Grid`
 * needs the ScrollView). At the padded 100 authors that is ~50 rows of plain
 * Views — fine to look at, not fine to ship. Shipping wants the pool as the
 * `FlatList` with everything above it as `ListHeaderComponent`. That is a
 * rendering problem, not a layout one, and does not change what is judged here.
 */
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import { Check, X } from 'lucide-react-native';

import { useTheme } from '@/hooks/useTheme';
import { SeriesBookRow } from '@/components/SeriesBookRow';
import { fontSize, screenPadding } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
import { useProtoStore } from '@/prototypes/protoStore';
import {
  AddBooksButton,
  EditorIdentityRow,
  OrderedList,
  useHeroUri,
  useNumbering,
} from './editorShell';
import {
  ProtoAuthorHeading,
  ProtoEmptyPool,
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

/** `closed` is the Order stage: the panel is gone and the list is the screen. */
type PanelStep = 'closed' | 'authors' | 'books';

export default function VariantE({ onExit }: { onExit: () => void }) {
  const { colors: themeColors } = useTheme();

  // Opens on Authors: the driver's answer to "where does a fresh create start".
  const [panelStep, setPanelStep] = useState<PanelStep>('authors');
  /** The staging buffer — see header note 3. Never the same array as `ordered`. */
  const [staged, setStaged] = useState<string[]>([]);

  const authorPad = useProtoStore((s) => s.authorPad);
  const setAuthorPad = useProtoStore((s) => s.setAuthorPad);

  const name = useWizardDraft((s) => s.name);
  const setName = useWizardDraft((s) => s.setName);
  const authorFilter = useWizardDraft((s) => s.authorFilter);
  const toggleAuthor = useWizardDraft((s) => s.toggleAuthor);
  const clearAuthors = useWizardDraft((s) => s.clearAuthors);
  const ordered = useWizardDraft((s) => s.ordered);
  const toggleBook = useWizardDraft((s) => s.toggleBook);
  const setOrdered = useWizardDraft((s) => s.setOrdered);

  const authorCells = useAuthorCells(authorPad);
  const keyMap = useKeyMap();
  const scrollableRef = useAnimatedRef<Animated.ScrollView>();
  // No query: the author step IS the filter in this variant.
  const { rows } = useBookPool({ query: '', authorAllowList: authorFilter });

  const titleOf = useCallback(
    (key: string) => keyMap.get(key)?.bookTitle ?? '',
    [keyMap],
  );
  const heroUri = useHeroUri(ordered, keyMap);
  const numbering = useNumbering({ ordered, setOrdered, titleOf });

  /* ----------------------------------------------------------- panel --- */

  const openPicker = useCallback(() => {
    setStaged([]);
    clearAuthors();
    setPanelStep('authors');
  }, [clearAuthors]);

  const commitStaged = useCallback(() => {
    // Appends in the order they were tapped, which seeds Order with the
    // sequence the picking already implied. `ordered` is only ever written HERE
    // while the panel is open — that is what stops the list shoving the panel.
    setOrdered([...ordered, ...staged.filter((k) => !ordered.includes(k))]);
    setStaged([]);
    setPanelStep('closed');
  }, [ordered, staged, setOrdered]);

  /** Abandon the pass. Only leaves the flow if there is nothing behind it. */
  const dismissPanel = useCallback(() => {
    setStaged([]);
    if (ordered.length > 0) {
      setPanelStep('closed');
      return;
    }
    onExit();
  }, [ordered.length, onExit]);

  const back = useCallback(() => {
    if (panelStep === 'books') {
      setPanelStep('authors');
      return true;
    }
    dismissPanel();
    return true;
  }, [panelStep, dismissPanel]);
  useHardwareBack(back);

  /* ----------------------------------------------------------- footer --- */

  const footerLabel = panelStep === 'closed' ? 'Save' : 'Next';
  const footerActive =
    panelStep === 'authors'
      ? authorFilter.length > 0
      : panelStep === 'books'
        ? staged.length > 0 || ordered.length > 0
        : name.trim().length > 0 && ordered.length > 0;

  const onFooter = useCallback(() => {
    if (panelStep === 'authors') {
      if (authorFilter.length === 0) {
        Alert.alert("Can't continue", 'Select at least one author.');
        return;
      }
      setPanelStep('books');
      return;
    }
    if (panelStep === 'books') {
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
  }, [
    panelStep,
    authorFilter.length,
    staged.length,
    ordered.length,
    name,
    numbering,
    commitStaged,
    onExit,
  ]);

  return (
    <View style={shared.screen}>
      <ProtoWizardHeader
        title={name.trim() || 'New series'}
        subtitle={
          panelStep === 'authors'
            ? 'Whose books are in this series?'
            : panelStep === 'books'
              ? 'Tap the books that belong in it.'
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

        {panelStep === 'closed' ? (
          <AddBooksButton onPress={openPicker} />
        ) : (
          <View style={[localStyles.panel, { borderColor: themeColors.primary }]}>
            <View style={localStyles.panelHead}>
              <Text style={[localStyles.panelTitle, { color: themeColors.text }]}>
                Add books
              </Text>
              {/* X closes the PANEL; the header chevron and hardware back step
                  back one stage. Two affordances, two jobs — collapsing them
                  would make Books ▸ X mean "return to Authors", which reads as
                  a bug the first time you press it. */}
              <Pressable onPress={dismissPanel} hitSlop={10}>
                <X size={20} color={themeColors.textMuted} />
              </Pressable>
            </View>

            <Breadcrumb step={panelStep} />

            {panelStep === 'authors' ? (
              <>
                <View style={localStyles.authorGrid}>
                  {authorCells.map((cell) => (
                    <AuthorCellView
                      key={cell.name}
                      name={cell.name}
                      synthetic={cell.synthetic}
                      selected={authorFilter.includes(cell.name)}
                      onPress={() => toggleAuthor(cell.name)}
                    />
                  ))}
                </View>
                {/* Harness knob — density can't be judged at 8 authors. */}
                <Pressable
                  onPress={() => setAuthorPad(!authorPad)}
                  style={localStyles.padToggle}
                  hitSlop={8}
                >
                  <Text style={localStyles.padToggleText}>
                    {authorPad ? 'real authors only' : '+90 fake authors'}
                  </Text>
                </Pressable>
              </>
            ) : rows.length === 0 ? (
              <ProtoEmptyPool query='' />
            ) : (
              rows.map((row) => {
                if (row.type === 'heading') {
                  return <ProtoAuthorHeading key={row.key} name={row.name} />;
                }
                const alreadyIn = ordered.includes(row.bookKey);
                return (
                  <View
                    key={row.key}
                    style={[
                      localStyles.poolRow,
                      alreadyIn && localStyles.poolRowAlreadyIn,
                    ]}
                  >
                    <SeriesBookRow
                      context='selection'
                      bookId={row.book.bookId}
                      title={row.book.bookTitle}
                      author={row.book.author}
                      artwork={row.book.artwork}
                      selected={alreadyIn || staged.includes(row.bookKey)}
                      // Already-in books are inert: removing one from HERE would
                      // shrink the list above and reintroduce the jump.
                      onPress={
                        alreadyIn
                          ? undefined
                          : () =>
                              setStaged((prev) =>
                                prev.includes(row.bookKey)
                                  ? prev.filter((k) => k !== row.bookKey)
                                  : [...prev, row.bookKey],
                              )
                      }
                    />
                  </View>
                );
              })
            )}
          </View>
        )}
      </Animated.ScrollView>

      <ProtoWizardFooter
        leftLabel='Cancel'
        onLeft={onExit}
        rightLabel={footerLabel}
        rightActive={footerActive}
        onRight={onFooter}
      />
    </View>
  );
}

/**
 * `Authors › Books › Order` — a breadcrumb rather than an `n of 3`.
 *
 * The fraction would lie: there are only two `Next` presses, because Order
 * happens in the list rather than in the panel. The breadcrumb tells you the
 * same "how much is left" without claiming a third press, and it makes the
 * screen you land on legible as the third stage instead of as an exit.
 */
function Breadcrumb({ step }: { step: PanelStep }) {
  const { colors: themeColors } = useTheme();
  const marks: { label: string; state: 'done' | 'now' | 'next' }[] = [
    { label: 'Authors', state: step === 'authors' ? 'now' : 'done' },
    {
      label: 'Books',
      state: step === 'books' ? 'now' : step === 'authors' ? 'next' : 'done',
    },
    { label: 'Order', state: 'next' },
  ];
  return (
    <View style={localStyles.crumbRow}>
      {marks.map((m, i) => (
        <React.Fragment key={m.label}>
          {i > 0 && (
            <Text style={[localStyles.crumbSep, { color: themeColors.textMuted }]}>
              ›
            </Text>
          )}
          <Text
            style={[
              localStyles.crumb,
              m.state === 'now'
                ? { color: themeColors.primary, fontWeight: '600' }
                : { color: themeColors.textMuted },
            ]}
          >
            {m.label}
          </Text>
        </React.Fragment>
      ))}
    </View>
  );
}

/**
 * The compact author cell.
 *
 * Driver's ruling: much less space each, no book totals, and either no check
 * circle at all or a much smaller one in a corner. The corner check is the one
 * built, because dropping it entirely would leave selection signalled by border
 * colour alone — a colour-only state, which is the one version that fails for a
 * colour-blind reader. Three redundant signals instead: border weight, tint, and
 * a 12px check. The check costs no vertical space because it is absolutely
 * positioned inside the padding.
 */
function AuthorCellView({
  name,
  synthetic,
  selected,
  onPress,
}: {
  name: string;
  synthetic: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors: themeColors } = useTheme();
  return (
    <Pressable
      onPress={synthetic ? undefined : onPress}
      android_ripple={rippleOf(themeColors.divider)}
      style={[
        localStyles.authorCell,
        selected
          ? {
              borderColor: themeColors.primary,
              borderWidth: 1.5,
              backgroundColor: withOpacity(themeColors.primary, 0.12),
            }
          : { borderColor: themeColors.divider, borderWidth: 1 },
        synthetic && localStyles.authorCellSynthetic,
      ]}
    >
      <Text
        numberOfLines={2}
        style={[
          localStyles.authorCellText,
          { color: selected ? themeColors.primary : themeColors.text },
        ]}
      >
        {name}
      </Text>
      {selected && (
        <View
          style={[
            localStyles.authorCheck,
            { backgroundColor: themeColors.primary },
          ]}
        >
          <Check size={9} color={themeColors.background} strokeWidth={3.5} />
        </View>
      )}
    </Pressable>
  );
}

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
    padding: 12,
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
  crumbSep: { fontFamily: 'Rubik', fontSize: 12 },

  authorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  authorCell: {
    width: '48.5%',
    minHeight: 42,
    justifyContent: 'center',
    paddingVertical: 7,
    paddingLeft: 10,
    paddingRight: 20,
    borderRadius: 7,
    overflow: 'hidden',
  },
  authorCellSynthetic: { opacity: 0.38 },
  authorCellText: { fontFamily: 'Rubik', fontSize: 13, lineHeight: 16 },
  authorCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padToggle: {
    alignSelf: 'center',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#B5179E',
  },
  padToggleText: { color: '#fff', fontFamily: 'Rubik', fontSize: 10 },

  poolRow: { marginBottom: 8 },
  poolRowAlreadyIn: { opacity: 0.45 },
});
