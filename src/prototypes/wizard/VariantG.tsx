/**
 * THROWAWAY — ticket 15, variant G: E's FLOW, IN A SHEET THAT COVERS THE LIST.
 *
 * G exists to settle the last item on 15's "still open" list: the bottom-sheet
 * picker, described there as "the one presentation idea still standing". It is
 * NOT a third design. It holds E's shape fixed — two steps, authors then books,
 * the same `editorShell` from the identity row down — and changes exactly one
 * thing: the picker is a presented sheet ON TOP of the editor rather than a
 * panel INSIDE it.
 *
 *   E   the panel is a box in the scroll view; the list is above it, visible
 *   G   the sheet covers the list entirely, with a backdrop over the editor
 *
 * ── What the sheet is supposed to buy ─────────────────────────────────────
 *
 * Two things, and they should be judged separately because only one of them is
 * still unclaimed:
 *
 * 1. IT REMOVES THE JUMP STRUCTURALLY. Nothing the sheet does can move the list,
 *    because they are different layers. **But E already removed the jump by
 *    staging** — measured on device at 28,488 changed pixels against D's
 *    547,334, with 0 differing pixels above the panel. So this is a second
 *    solution to a solved problem, and it only pays if it buys something else.
 *
 * 2. IT REMOVES THE MODE AMBIGUITY. This is the live one. In E the footer's
 *    `Next` silently becomes `Save` when the panel closes — a mode change on a
 *    screen that otherwise looks static. A sheet cannot have that problem: the
 *    sheet owns its own `Next`, the editor keeps its own `Save`, and which one
 *    you are looking at is never in question because one is covering the other.
 *
 * ── The harness knob: does the sheet make STAGING unnecessary? ─────────────
 *
 * If the list is covered, committing on every tap cannot be seen, so the reason
 * staging exists may not survive the presentation change. That is testable
 * rather than arguable, so it is a pink knob inside the sheet instead of a
 * seventh variant. Flip it and pick a book:
 *
 *   staged        tapping stages; `Next` commits the batch (E's behaviour)
 *   commit on tap tapping writes straight to `ordered`, under the sheet
 *
 * If `commit on tap` reads fine, the shipped version can drop the staging buffer
 * and one piece of state with it. If closing the sheet onto a list that grew
 * behind your back reads badly, staging survives on its own merits rather than
 * as jump-prevention.
 *
 * ── A deliberate difference from E, surfaced rather than hidden ────────────
 *
 * BACK MEANS DISMISS, NOT STEP BACK. In E, hardware back walks Books → Authors,
 * and the panel's `X` is the only dismiss. A sheet already owns two dismiss
 * gestures (pan down, backdrop tap) and `@gorhom/bottom-sheet` registers its own
 * back handler when it opens, so fighting it would mean racing RN's BackHandler
 * registration order — fragile, and it would be papering over a real difference.
 * So G puts stepping back where a sheet puts it: a chevron in the sheet's own
 * header. Judge that as part of the presentation, because it is not separable
 * from it.
 *
 * ── Fidelity limits (inherited from E, plus one) ───────────────────────────
 *
 * The author grid and the book pool still render unvirtualized, now inside a
 * `BottomSheetScrollView`. Same note as E: fine at the padded 100, not fine to
 * ship, and it does not change what is being judged.
 *
 * NEW: the sheet is presented from inside a route that is itself pushed. Ticket
 * 15's session settled the create surface as a root `transparentModal`, so the
 * shipped stack would be sheet → transparentModal → (library | formSheet). This
 * prototype does NOT reproduce that depth — the harness route is a plain push —
 * so a clean result here is NOT evidence that the three-deep stack behaves.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, X } from 'lucide-react-native';

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
  ProtoPrimaryButton,
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

type SheetStep = 'authors' | 'books';

export default function VariantG({ onExit }: { onExit: () => void }) {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();

  const sheetRef = useRef<BottomSheetModal>(null);
  const [sheetStep, setSheetStep] = useState<SheetStep>('authors');
  const [staged, setStaged] = useState<string[]>([]);
  /** Harness knob — see the header note. Local, so it resets per mount. */
  const [commitOnTap, setCommitOnTap] = useState(false);

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
  const { rows } = useBookPool({ query: '', authorAllowList: authorFilter });

  const titleOf = useCallback(
    (key: string) => keyMap.get(key)?.bookTitle ?? '',
    [keyMap],
  );
  const heroUri = useHeroUri(ordered, keyMap);
  const numbering = useNumbering({ ordered, setOrdered, titleOf });

  const snapPoints = useMemo(() => ['88%'], []);

  /* ------------------------------------------------------------ sheet --- */

  // Opens on Authors immediately, exactly as E does — the driver's answer to
  // "where does a fresh create start" is being held constant here.
  useEffect(() => {
    sheetRef.current?.present();
  }, []);

  const openPicker = useCallback(() => {
    setStaged([]);
    clearAuthors();
    setSheetStep('authors');
    sheetRef.current?.present();
  }, [clearAuthors]);

  const commitStaged = useCallback(() => {
    setOrdered([...ordered, ...staged.filter((k) => !ordered.includes(k))]);
    setStaged([]);
    sheetRef.current?.dismiss();
  }, [ordered, staged, setOrdered]);

  /**
   * Fired by every dismissal route there is — `Next`, the `X`, pan-down,
   * backdrop tap and gorhom's own back handler — so the staging buffer is
   * dropped no matter which gesture ends the pass.
   *
   * DELIBERATE DIVERGENCE FROM E. E's `dismissPanel` exits the whole flow when
   * `ordered` is empty, because an editor with no panel and no books is a dead
   * end. In G it is not a dead end: the editor keeps its own `Cancel`, its own
   * `Save` and the `Add books` button, all of which are uncovered the moment the
   * sheet goes. Exiting the route on a pan-down would also mean the gesture that
   * *usually* means "put this away" instead means "abandon everything", which is
   * the kind of surprise a sheet should not carry.
   */
  const onSheetDismiss = useCallback(() => {
    setStaged([]);
  }, []);

  // Only reached when the sheet is already closed; gorhom owns back while it is
  // open. See the header note on back semantics.
  const back = useCallback(() => {
    onExit();
    return true;
  }, [onExit]);
  useHardwareBack(back);

  const onBookPress = useCallback(
    (bookKey: string) => {
      if (commitOnTap) {
        toggleBook(bookKey);
        return;
      }
      setStaged((prev) =>
        prev.includes(bookKey)
          ? prev.filter((k) => k !== bookKey)
          : [...prev, bookKey],
      );
    },
    [commitOnTap, toggleBook],
  );

  /* ----------------------------------------------------------- footer --- */

  const sheetNextActive =
    sheetStep === 'authors'
      ? authorFilter.length > 0
      : staged.length > 0 || ordered.length > 0;

  const onSheetNext = useCallback(() => {
    if (sheetStep === 'authors') {
      if (authorFilter.length === 0) {
        Alert.alert("Can't continue", 'Select at least one author.');
        return;
      }
      setSheetStep('books');
      return;
    }
    if (staged.length === 0 && ordered.length === 0) {
      Alert.alert("Can't continue", 'Select at least one book.');
      return;
    }
    commitStaged();
  }, [sheetStep, authorFilter.length, staged.length, ordered.length, commitStaged]);

  const onSave = useCallback(() => {
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
  }, [name, ordered.length, numbering, onExit]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        pressBehavior='close'
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  return (
    <View style={shared.screen}>
      {/* The editor underneath keeps its OWN chrome and its OWN Save. That is
          the whole point of the variant: the two surfaces never share a footer,
          so `Next` never turns into `Save`. */}
      <ProtoWizardHeader
        title={name.trim() || 'New series'}
        subtitle='Drag to order. Number them if you want to.'
        onBack={onExit}
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

        <AddBooksButton onPress={openPicker} />
      </Animated.ScrollView>

      <ProtoWizardFooter
        leftLabel='Cancel'
        onLeft={onExit}
        rightLabel='Save'
        rightActive={name.trim().length > 0 && ordered.length > 0}
        onRight={onSave}
      />

      <BottomSheetModal
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        onDismiss={onSheetDismiss}
        backgroundStyle={{ backgroundColor: themeColors.modalBackground }}
        handleIndicatorStyle={{ backgroundColor: themeColors.textMuted }}
      >
        {/* A plain View, NOT `BottomSheetView`: that component sizes itself to
            its content (it exists for `enableDynamicSizing`), so with a fixed
            88% snap point it let the author grid run past the sheet's bottom
            edge and pushed the footer off-screen entirely. A `flex: 1` View
            takes the sheet's height, which is what pins the footer. */}
        <View style={localStyles.sheetRoot}>
          <View style={localStyles.sheetHead}>
            {sheetStep === 'books' ? (
              <Pressable
                onPress={() => setSheetStep('authors')}
                hitSlop={10}
                style={localStyles.sheetBack}
              >
                <ChevronLeft size={22} color={themeColors.text} />
              </Pressable>
            ) : (
              <View style={localStyles.sheetBackSpacer} />
            )}
            <Text style={[localStyles.sheetTitle, { color: themeColors.text }]}>
              Add books
            </Text>
            <Pressable onPress={() => sheetRef.current?.dismiss()} hitSlop={10}>
              <X size={20} color={themeColors.textMuted} />
            </Pressable>
          </View>

          <Breadcrumb step={sheetStep} />

          <BottomSheetScrollView
            style={localStyles.sheetScroll}
            contentContainerStyle={localStyles.sheetScrollContent}
            keyboardShouldPersistTaps='handled'
          >
            {sheetStep === 'authors' ? (
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
                <Pressable
                  onPress={() => setAuthorPad(!authorPad)}
                  style={localStyles.knob}
                  hitSlop={8}
                >
                  <Text style={localStyles.knobText}>
                    {authorPad ? 'real authors only' : '+90 fake authors'}
                  </Text>
                </Pressable>
              </>
            ) : rows.length === 0 ? (
              <ProtoEmptyPool query='' />
            ) : (
              <>
                {rows.map((row) => {
                  if (row.type === 'heading') {
                    return <ProtoAuthorHeading key={row.key} name={row.name} />;
                  }
                  const alreadyIn = ordered.includes(row.bookKey);
                  // Under `commit on tap` an already-in book stays live, because
                  // un-picking is the only way back — there is no staging buffer
                  // to drop it from, and the list it would shrink is covered.
                  const inert = alreadyIn && !commitOnTap;
                  return (
                    <View
                      key={row.key}
                      style={[
                        localStyles.poolRow,
                        inert && localStyles.poolRowAlreadyIn,
                      ]}
                    >
                      <SeriesBookRow
                        context='selection'
                        bookId={row.book.bookId}
                        title={row.book.bookTitle}
                        author={row.book.author}
                        artwork={row.book.artwork}
                        selected={alreadyIn || staged.includes(row.bookKey)}
                        onPress={
                          inert ? undefined : () => onBookPress(row.bookKey)
                        }
                      />
                    </View>
                  );
                })}
                <Pressable
                  onPress={() => setCommitOnTap(!commitOnTap)}
                  style={localStyles.knob}
                  hitSlop={8}
                >
                  <Text style={localStyles.knobText}>
                    {commitOnTap ? 'commit on tap' : 'staged'}
                  </Text>
                </Pressable>
              </>
            )}
          </BottomSheetScrollView>

          {/* The sheet's own action. The editor's `Save` is behind the backdrop
              and stays `Save` the whole time — no label ever changes meaning. */}
          <View
            style={[
              localStyles.sheetFooter,
              {
                borderTopColor: themeColors.divider,
                paddingBottom: insets.bottom + 8,
              },
            ]}
          >
            <Pressable
              onPress={() => sheetRef.current?.dismiss()}
              style={localStyles.sheetCancel}
              hitSlop={8}
            >
              <Text style={[shared.footerLeft, { color: themeColors.textMuted }]}>
                Cancel
              </Text>
            </Pressable>
            <ProtoPrimaryButton
              label='Next'
              active={sheetNextActive}
              onPress={onSheetNext}
            />
          </View>
        </View>
      </BottomSheetModal>
    </View>
  );
}

/** Same breadcrumb as E, so the two read as one flow in two presentations. */
function Breadcrumb({ step }: { step: SheetStep }) {
  const { colors: themeColors } = useTheme();
  const marks: { label: string; state: 'done' | 'now' | 'next' }[] = [
    { label: 'Authors', state: step === 'authors' ? 'now' : 'done' },
    { label: 'Books', state: step === 'books' ? 'now' : 'next' },
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

/** Lifted verbatim from E — the cell is not what G is testing. */
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
          style={[localStyles.authorCheck, { backgroundColor: themeColors.primary }]}
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

  sheetRoot: { flex: 1, paddingHorizontal: screenPadding.horizontal },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sheetBack: { marginLeft: -6 },
  sheetBackSpacer: { width: 1 },
  sheetTitle: {
    flex: 1,
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.base,
  },
  sheetScroll: { flex: 1 },
  sheetScrollContent: { paddingTop: 8, paddingBottom: 16 },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetCancel: { paddingVertical: 12, paddingHorizontal: 8 },

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

  knob: {
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#B5179E',
  },
  knobText: { color: '#fff', fontFamily: 'Rubik', fontSize: 10 },

  poolRow: { marginBottom: 8 },
  poolRowAlreadyIn: { opacity: 0.45 },
});
