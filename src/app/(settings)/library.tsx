import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { useState, useCallback } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import {
  ArchiveRestore,
  Check,
  ChevronRight,
  FolderOpen,
  Trash2,
  FolderPlus,
  Layers,
  TableOfContents,
  Undo2,
} from 'lucide-react-native';
import SettingsHeader from '@/components/SettingsHeader';
import SettingsCard from '@/components/settings/SettingsCard';
import CollapsibleSettingsSection from '@/components/settings/CollapsibleSettingsSection';
import CompactSettingsRow from '@/components/settings/CompactSettingsRow';
import ToggleSwitch from '@/components/animations/ToggleSwitch';
import { screenPadding } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
import { useTheme } from '@/hooks/useTheme';
import { refreshLibraryStore } from '@/store/library';
import {
  getLibraryFolders,
  removeLibraryFolder,
  getAutoChapterInterval,
  setAutoChapterInterval,
  getBooksWithoutChapterData,
  getSeriesDetectionEnabled,
  setSeriesDetectionEnabled,
  getSeriesFolderGroupingEnabled,
  setSeriesFolderGroupingEnabled,
} from '@/db/settingsQueries';
import {
  loadRemovedSeries,
  restoreRemovedSeries,
} from '@/db/seriesQueries';
import type { RemovedSeriesEntry } from '@/db/seriesSuppression';
import { runSeriesDetection } from '@/db/seriesDetectionRun';
import {
  summarizeDetectionRun,
  summarizeSeriesRestore,
} from '@/helpers/seriesDetectionSummary';
import { applyAutoChaptersToExistingBooks } from '@/helpers/autoChapterGenerator';
import { directoryPicker } from '@/helpers/directoryPicker';
import { router } from 'expo-router';
import { useRequiresPro } from '@/hooks/useRequiresPro';
import { ProBadge } from '@/components/ProBadge';
import ProFeaturePopup from '@/modals/ProFeaturePopup';
import InfoDialogPopup from '@/modals/InfoDialogPopup';

/**
 * §A9 — the copy ships EXACTLY as ticket 09 §9 wrote it. Card description with
 * no trailing period (matching the sibling card), three paragraphs behind the
 * `Info` icon, and the sub-option caption below.
 *
 * The caption stays GENERIC on purpose. The real rule turns on *contradiction
 * versus absence* — a folder is trusted when the library's own tags corroborate
 * it and refused when they name something else — which is not sayable in two
 * lines, and every short approximation misdescribes at least one real case.
 *
 * DELIBERATELY UNMENTIONED: that two recordings of one series stay separate.
 * It is internal machinery the user cannot act on, and naming it invites doubt
 * about a case that is already handled.
 */
const SERIES_DETECTION_DESCRIPTION =
  'Automatically group books into series using their tags and folder names';

/**
 * DRIVER'S RULING, 2026-08-08 (ticket 07, on the question ticket 19 handed it):
 * the third paragraph's promise SHIPS AS WRITTEN, with no file-move caveat.
 *
 * 19 ruled that moving or renaming a book's folder ends its series membership,
 * and that moving the library root deletes hand-made series outright — so the
 * promise is true for every scan of a library whose files have not moved, and
 * false in the one case where they have. Qualifying it was offered and
 * declined: the paragraph is about what *detection* does to your work, a user
 * who renames their library root is not surprised that the app treats the
 * contents as new, and a fourth paragraph of doubt is a real cost on the one
 * card where the app makes its promise in plain language. The wording is
 * therefore unchanged, so 09 §9 and `spec.md` need no amendment.
 */
const SERIES_DETECTION_INFO = [
  'When enabled, books are grouped into series automatically as your library ' +
    'is scanned, using the series information in their tags and, if you turn ' +
    'on folder grouping, their folder names.',
  'Series names come from your files, so a name may occasionally look odd. ' +
    'Books with no series information are left on their own. Both are fixable ' +
    'by hand — you can rename a series, add a book to one, or remove a book ' +
    "that doesn't belong.",
  "Your changes are never overwritten. Renamed series, books you've added " +
    'or removed, custom ordering and hand-made series are all left alone when ' +
    'your library is scanned again. Deleting a detected series also stops it ' +
    'being recreated; you can reverse that from Removed Series.',
].join('\n\n');

/**
 * A12's recovery copy. Two sentences, and it is short BECAUSE restore now runs
 * detection on the spot: an earlier version had to explain that the series
 * would return "the next time your library is scanned — or straight away with
 * Detect Series in Existing Books", which is a caveat and a cross-reference
 * that a user has to hold in their head. Making the button do what it says
 * deleted the sentence.
 */
const REMOVED_SERIES_DESCRIPTION =
  'Series you delete are not detected again, so a grouping you rejected ' +
  'stays rejected. Restoring one brings it straight back.';

const REMOVED_SERIES_EMPTY =
  "You haven't deleted any series. When you do, they'll be listed here so " +
  'you can bring them back.';

const LibrarySettingsScreen = () => {
  const { colors: themeColors } = useTheme();
  const { isProUser, hasPurchasedPro } = useRequiresPro();
  const [showProPopup, setShowProPopup] = useState(false);
  const [libraryFolders, setLibraryFolders] = useState<string[]>([]);
  const [autoChapterEnabled, setAutoChapterEnabled] = useState(false);
  const [autoChapterInterval, setAutoChapterIntervalState] =
    useState<string>('30');
  const [booksWithoutChaptersCount, setBooksWithoutChaptersCount] =
    useState(0);
  const [isApplying, setIsApplying] = useState(false);
  const autoChapterToggleValue = useSharedValue(0);

  // §A9 — detection is ON by default and NOT Pro-gated. Both seeds below must
  // match their column's default: this state is what renders for the frame
  // before the fetch resolves, so seeding `false` would show every user a
  // switch turned off that they never turned off. Same trap the DB getter
  // avoids by reading `!== false` (K1), one layer up.
  const [seriesDetectionEnabled, setSeriesDetectionEnabledState] =
    useState(true);
  const [folderGroupingEnabled, setFolderGroupingEnabledState] =
    useState(false);
  const [removedSeries, setRemovedSeries] = useState<RemovedSeriesEntry[]>(
    [],
  );
  const [removedExpanded, setRemovedExpanded] = useState(false);
  // Animated-height expansion, copied from CollapsibleSettingsSection so this
  // row and `Library Folders` two inches below it roll out identically: a
  // measured, absolutely-positioned child inside a clipping wrapper whose
  // height is driven 0→1. The content is ALWAYS mounted — that is what makes
  // it measurable — and the wrapper's overflow is what hides it.
  const removedHeight = useSharedValue(0);
  const [removedContentHeight, setRemovedContentHeight] = useState(0);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionInfoVisible, setDetectionInfoVisible] = useState(false);
  const seriesDetectionToggleValue = useSharedValue(1);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchSettings = async () => {
        const folders = await getLibraryFolders();
        const interval = await getAutoChapterInterval();
        const booksWithoutChapters = await getBooksWithoutChapterData();
        const detectionEnabled = await getSeriesDetectionEnabled();
        const folderGrouping = await getSeriesFolderGroupingEnabled();
        const removed = await loadRemovedSeries();

        if (isActive) {
          setLibraryFolders(folders);
          if (interval !== null) {
            setAutoChapterEnabled(true);
            setAutoChapterIntervalState(interval.toString());
            autoChapterToggleValue.value = 1;
          } else {
            setAutoChapterEnabled(false);
            autoChapterToggleValue.value = 0;
          }
          setBooksWithoutChaptersCount(booksWithoutChapters.length);
          setSeriesDetectionEnabledState(detectionEnabled);
          seriesDetectionToggleValue.value = detectionEnabled ? 1 : 0;
          setFolderGroupingEnabledState(folderGrouping);
          // G7 — the table has no unique constraint, so a double-delete can
          // leave two rows for one name. `loadRemovedSeries` groups by series
          // identity, so the count in the label and the lines in the list are
          // literally the same array and cannot disagree.
          setRemovedSeries(removed);
        }
      };
      fetchSettings();

      return () => {
        isActive = false;
      };
      // Both are `useSharedValue` handles, which reanimated keeps as ONE stable
      // object for the component's lifetime — the code mutates `.value` rather
      // than replacing them. So this list can never change identity and the
      // effect still runs only on focus; they are named purely to satisfy
      // exhaustive-deps, whose other suggestion (drop the array) would turn a
      // focus effect into a run-every-render one.
    }, [autoChapterToggleValue, seriesDetectionToggleValue]),
  );

  const handleRemoveFolder = (folderPath: string) => {
    Alert.alert(
      'Remove Library',
      `Are you sure you want to remove this folder and all of its books from your library?\n\n${folderPath}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeLibraryFolder(folderPath);
            await refreshLibraryStore();
            setLibraryFolders((prev) =>
              prev.filter((path) => path !== folderPath),
            );
          },
        },
      ],
    );
  };

  const handleAddFolder = async () => {
    router.back();
    await directoryPicker();
  };

  const handleAutoChapterToggle = async () => {
    // Check for Pro when trying to enable auto-chapters
    if (!autoChapterEnabled && !isProUser) {
      setShowProPopup(true);
      return;
    }

    const newEnabled = !autoChapterEnabled;
    setAutoChapterEnabled(newEnabled);
    autoChapterToggleValue.value = newEnabled ? 1 : 0;

    if (newEnabled) {
      // Enable with the currently selected interval
      await setAutoChapterInterval(parseInt(autoChapterInterval, 10));
    } else {
      // Disable auto-chapter generation
      await setAutoChapterInterval(null);
    }
  };

  const handleIntervalChange = async (value: string) => {
    setAutoChapterIntervalState(value);
    if (autoChapterEnabled) {
      await setAutoChapterInterval(parseInt(value, 10));
    }
  };

  /**
   * §A9 — OFF stops future detection and leaves existing series untouched,
   * matching `setAutoChapterInterval(null)` above exactly: the write is the
   * whole of the side effect, and nothing walks the series table.
   *
   * No Pro check, deliberately. Gating detection would invert the redesign for
   * free users — an empty Series tab reads as a broken feature, not an upsell.
   */
  const handleSeriesDetectionToggle = async () => {
    const newValue = !seriesDetectionEnabled;
    setSeriesDetectionEnabledState(newValue);
    seriesDetectionToggleValue.set(newValue ? 1 : 0);
    await setSeriesDetectionEnabled(newValue);
  };

  const handleFolderGroupingToggle = async () => {
    const newValue = !folderGroupingEnabled;
    setFolderGroupingEnabledState(newValue);
    await setSeriesFolderGroupingEnabled(newValue);
  };

  /**
   * §A9 — the retroactive run, and the bridge for anyone whose first scan
   * happened with detection off.
   *
   * No confirmation dialog: A14 makes every bulk action on this card CREATIVE,
   * and the sibling's `Apply Auto-Chapters` prompt exists because that one
   * writes chapters into books. This writes series rows, each of which the
   * user can delete. It also carries NO COUNT — the naive figure ("books not
   * in a series") is not a promise the way the chapters count is, because most
   * books in a typical library are standalones that will never group.
   *
   * `runSeriesDetection` never throws, so there is nothing to catch; the flag
   * is cleared in `finally` regardless.
   */
  const handleDetectExistingSeries = async () => {
    if (isDetecting) return;

    setIsDetecting(true);
    try {
      const report = summarizeDetectionRun(await runSeriesDetection());
      Alert.alert(report.title, report.message, [{ text: 'OK' }]);
    } finally {
      setIsDetecting(false);
    }
  };

  /**
   * A12's restore, and it does NOT stop at deleting the suppression row.
   *
   * The spec says the next scan recreates the series. Waiting for one was
   * rejected on device: a restore that deletes a veto changes nothing the user
   * can see, and "it'll come back later" is indistinguishable from "it never
   * came back" in the two cases where it genuinely never does — detection
   * switched off, and books that have moved since the delete. Running
   * detection here turns both into a sentence the user reads immediately.
   *
   * `runSeriesDetection` measures 181–643ms on a real 3,461-file library and
   * never throws, so there is nothing to catch; the flag clears in `finally`.
   * A14 is untouched — the run is creative-only, and reconcile cannot remove a
   * series it did not match.
   */
  const runRestore = useCallback(
    async (entries: RemovedSeriesEntry[]) => {
      if (isRestoring || entries.length === 0) return;
      setIsRestoring(true);
      try {
        await restoreRemovedSeries(
          entries.flatMap((entry) => entry.rowIds),
        );
        const report = summarizeSeriesRestore(
          entries.map((entry) => entry.name),
          await runSeriesDetection(),
        );
        setRemovedSeries(await loadRemovedSeries());
        Alert.alert(report.title, report.message, [{ text: 'OK' }]);
      } finally {
        setIsRestoring(false);
      }
    },
    [isRestoring],
  );

  /**
   * The one bulk action on this card that asks first, and the reason is
   * reversibility rather than destructiveness: restoring everything is a
   * single tap, while undoing it costs one confirmed delete per series. Cheap
   * to do and expensive to undo is exactly when a prompt earns its place.
   *
   * A14 still holds — this creates, so the confirm button is not `destructive`
   * and the copy promises books are untouched rather than warning about them.
   */
  const handleRestoreAll = useCallback(() => {
    Alert.alert(
      'Restore all removed series?',
      `This brings back ${removedSeries.length} series and lets detection ` +
        'group them again. Your books are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore All', onPress: () => runRestore(removedSeries) },
      ],
    );
  }, [removedSeries, runRestore]);

  const handleApplyToExisting = async () => {
    if (!isProUser) {
      setShowProPopup(true);
      return;
    }

    if (booksWithoutChaptersCount === 0) {
      Alert.alert(
        'No Books Found',
        'All books in your library already have chapter data.',
        [{ text: 'OK' }],
      );
      return;
    }

    Alert.alert(
      'Apply Auto-Chapters',
      `This will generate ${autoChapterInterval}-minute chapters for ${booksWithoutChaptersCount} book${booksWithoutChaptersCount > 1 ? 's' : ''} without chapter data. Continue?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Apply',
          onPress: async () => {
            setIsApplying(true);
            try {
              const count = await applyAutoChaptersToExistingBooks();
              await refreshLibraryStore();
              setBooksWithoutChaptersCount(0);
              Alert.alert(
                'Success',
                `Auto-chapters generated for ${count} book${count > 1 ? 's' : ''}.`,
                [{ text: 'OK' }],
              );
            } catch (error) {
              Alert.alert(
                'Error',
                'Failed to apply auto-chapters. Please try again.',
                [{ text: 'OK' }],
              );
            } finally {
              setIsApplying(false);
            }
          },
        },
      ],
    );
  };

  // The app's one expand affordance: SectionHeaderBar rotates a ChevronRight
  // 90° over 200ms, and `Library Folders` sits directly below this card doing
  // exactly that. Reusing it means the collapsed row is pixel-identical to the
  // chevron it already had.
  const removedChevronStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: withTiming(removedExpanded ? '90deg' : '0deg', {
          duration: 200,
        }),
      },
    ],
  }));

  // 300ms, matching CollapsibleSettingsSection exactly — the chevron's 200ms
  // is also its own, so the two are already paired everywhere else in the app.
  const removedContentStyle = useAnimatedStyle(() => ({
    height: removedHeight.value * removedContentHeight,
    opacity: removedHeight.value,
  }));

  const toggleRemovedSeries = useCallback(() => {
    const next = !removedExpanded;
    removedHeight.value = withTiming(next ? 1 : 0, { duration: 300 });
    setRemovedExpanded(next);
  }, [removedExpanded, removedHeight]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: themeColors.modalBackground },
      ]}
    >
      <SettingsHeader title='Library' />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsCard title='Add Folder' icon={FolderPlus}>
          <View style={styles.addFolderContent}>
            <Text
              style={[
                styles.addFolderDescription,
                { color: themeColors.textMuted },
              ]}
            >
              Select a folder to add to your audiobook library
            </Text>
            <TouchableOpacity
              onPress={handleAddFolder}
              style={[
                styles.addButton,
                {
                  backgroundColor: withOpacity(themeColors.primary, 0.1),
                },
              ]}
            >
              <FolderPlus size={20} color={themeColors.primary} />
              <Text
                style={[
                  styles.addButtonText,
                  { color: themeColors.primary },
                ]}
              >
                Add Library Folder
              </Text>
            </TouchableOpacity>
          </View>
        </SettingsCard>

        {/*
          §F10 — `Layers` was doing double duty as the library's Series-view
          toggle and the auto-chapters glyph. Series keeps `Layers`;
          auto-chapters moves to `TableOfContents`, as it already has on
          `titleDetails`. This screen is where the collision would have been
          visible — two adjacent cards wearing the same icon.
        */}
        <SettingsCard
          title='Auto-Generate Chapters'
          icon={TableOfContents}
          rightAccessory={!hasPurchasedPro ? <ProBadge /> : undefined}
        >
          <View style={styles.autoChapterContent}>
            <Text
              style={[
                styles.addFolderDescription,
                { color: themeColors.textMuted },
              ]}
            >
              Automatically create chapter markers for audiobooks that
              don&apos;t have embedded chapter data
            </Text>
            <CompactSettingsRow
              label='Enable Auto-Chapters'
              control={
                <ToggleSwitch
                  value={autoChapterToggleValue}
                  onPress={handleAutoChapterToggle}
                  style={{ width: 72, height: 36, padding: 5 }}
                  trackColors={{
                    on: themeColors.primary,
                    off: themeColors.modalBackground,
                  }}
                />
              }
            />
            {autoChapterEnabled && (
              <>
                <View style={styles.pickerContainer}>
                  <Text
                    style={[
                      styles.pickerLabel,
                      { color: themeColors.textMuted },
                    ]}
                  >
                    Chapter Interval
                  </Text>
                  <Picker
                    style={{
                      flex: 1,
                      height: 50,
                      color: themeColors.text,
                      backgroundColor: themeColors.modalBackground,
                      fontFamily: 'Rubik',
                    }}
                    // itemStyle={{ fontFamily: 'Rubik' }}
                    dropdownIconColor={themeColors.primary}
                    selectedValue={autoChapterInterval}
                    onValueChange={handleIntervalChange}
                    mode='dropdown'
                  >
                    <Picker.Item label='30 minutes' value='30' />
                    <Picker.Item label='60 minutes' value='60' />
                  </Picker>
                </View>
                <TouchableOpacity
                  onPress={handleApplyToExisting}
                  disabled={isApplying}
                  style={[
                    styles.addButton,
                    {
                      backgroundColor: withOpacity(
                        themeColors.primary,
                        0.1,
                      ),
                      opacity: isApplying ? 0.5 : 1,
                    },
                  ]}
                >
                  <TableOfContents size={20} color={themeColors.primary} />
                  <Text
                    style={[
                      styles.addButtonText,
                      { color: themeColors.primary },
                    ]}
                  >
                    {isApplying
                      ? 'Applying...'
                      : `Apply to Existing Books (${booksWithoutChaptersCount})`}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </SettingsCard>

        {/*
          §B10 — detection settings live in `Manage Library`; presentation
          settings (`Series Backgrounds`) live in `Appearance`. The split brain
          is knowing: "how does it look" → Appearance is a stronger mental model
          than "everything with the word Series in it lives together", and these
          are decisions about what the library IS.
        */}
        <SettingsCard title='Series Detection' icon={Layers}>
          <View style={styles.seriesDetectionContent}>
            <Text
              style={[
                styles.addFolderDescription,
                { color: themeColors.textMuted },
              ]}
            >
              {SERIES_DETECTION_DESCRIPTION}
            </Text>
          </View>

          {/*
            K2 — a switch takes the row's control slot, so the long copy cannot
            hang off an inline icon the way the timer screen's Picker row does.
            `onInfoPress` is the prop that already solves that; do not add a
            second `How it works` row. `description` is deliberately NOT set:
            the card above already carries that exact string, and setting both
            would print it twice.
          */}
          <CompactSettingsRow
            label='Enable Series Detection'
            onInfoPress={() => setDetectionInfoVisible(true)}
            control={
              <ToggleSwitch
                value={seriesDetectionToggleValue}
                onPress={handleSeriesDetectionToggle}
                style={{ width: 72, height: 36, padding: 5 }}
                trackColors={{
                  on: themeColors.primary,
                  off: themeColors.modalBackground,
                }}
              />
            }
          />

          {/*
            Both of these render only while detection is on — the same shape as
            the interval Picker above, and for the button it is more than tidy:
            `runSeriesDetection` returns early when the setting is off, so a
            visible button would look broken rather than disabled.
          */}
          {seriesDetectionEnabled && (
            <View style={styles.seriesDetectionOptions}>
              <Pressable
                onPress={handleFolderGroupingToggle}
                style={styles.checkboxRow}
                accessibilityRole='checkbox'
                accessibilityState={{ checked: folderGroupingEnabled }}
                accessibilityLabel='Also group by folder name'
              >
                {/*
                  The checked state is an accent TINT with an accent glyph, not
                  a solid accent fill with the glyph knocked out of it. The
                  author picker does the latter, and it cannot be copied here:
                  its knockout colour is `background`, which is dark ink on the
                  accent in the dark theme and near-white ink on it in the
                  light one. The accent is user-settable, so no fixed ink is
                  derivable — and this idiom asks the question the two buttons
                  on this card already ask (accent on card), rather than adding
                  a second one (ink on accent).
                */}
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: folderGroupingEnabled
                        ? themeColors.primary
                        : themeColors.icon,
                      backgroundColor: folderGroupingEnabled
                        ? withOpacity(themeColors.primary, 0.1)
                        : 'transparent',
                    },
                  ]}
                >
                  {folderGroupingEnabled && (
                    <Check size={14} color={themeColors.primary} />
                  )}
                </View>
                <View style={styles.checkboxTextColumn}>
                  <Text
                    style={[
                      styles.checkboxLabel,
                      { color: themeColors.textMuted },
                    ]}
                  >
                    Also group by folder name
                  </Text>
                  <Text
                    style={[
                      styles.checkboxCaption,
                      { color: themeColors.textMuted },
                    ]}
                  >
                    Finds series that have no series tags, using folder
                    names. May occasionally group a folder that isn&apos;t a
                    series.
                  </Text>
                </View>
              </Pressable>

              <TouchableOpacity
                onPress={handleDetectExistingSeries}
                disabled={isDetecting}
                style={[
                  styles.addButton,
                  {
                    backgroundColor: withOpacity(themeColors.primary, 0.1),
                    opacity: isDetecting ? 0.5 : 1,
                  },
                ]}
              >
                <Layers size={20} color={themeColors.primary} />
                <Text
                  style={[
                    styles.addButtonText,
                    { color: themeColors.primary },
                  ]}
                >
                  {isDetecting
                    ? 'Detecting...'
                    : 'Detect Series in Existing Books'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/*
            A hairline ABOVE the row, not below it. The row is an entry point,
            not a trailing part of the detection options, and without the rule
            it reads as one more line of the block above. Only drawn when that
            block is showing — with detection off, `Enable Series Detection`
            already draws its own divider here and two would stack.
          */}
          {seriesDetectionEnabled && (
            <View
              style={[
                styles.rowDivider,
                { backgroundColor: withOpacity(themeColors.divider, 0.2) },
              ]}
            />
          )}

          {/*
            The count is suppressed at zero rather than reading `(0)`, but the
            row itself always shows AND stays expandable at zero: A12 rejected
            the delete-dialog checkbox because a modifier asking for foresight
            fails exactly when foresight is absent, and the same argument
            applies to an entry point that only appears once you need it. An
            empty list that explains itself is the point, not a dead end.

            The row sits OUTSIDE the `seriesDetectionEnabled` block above,
            unlike the checkbox and the button. Turning detection off does not
            un-delete anything, and a user who deleted a series, switched
            detection off and then changed their mind must still be able to
            reach the list that undoes it. `summarizeSeriesRestore` says so in
            words when they do.

            IT EXPANDS IN PLACE rather than pushing a screen. A dedicated route
            was built first and replaced: restoring only lifts a veto, so the
            thing that makes the series reappear — detection — belongs within
            reach of the button asking for it, and here `Restore` and
            `Detect Series in Existing Books` sit inches apart in one card. It
            also keeps §A9's sketch, which puts this row inside this card, and
            it removes a push whose direction contradicted the group's own
            slide (the settings Stack's `slide_from_right` versus the group's
            `slide_from_left`).

            THE BLOCK CARRIES marginBottom: -16 ON PURPOSE. `SettingsCard`'s
            content adds 16 under its last child on top of this row's own 12,
            so the row sat 28 below the text and 16 above it and read as pushed
            up. Cancelling the card's padding restores 12/12 — the same
            geometry `Library Folders`' rows already have, since
            CollapsibleSettingsSection's content has no bottom padding.
          */}
          <View style={styles.removedSeriesBlock}>
            <CompactSettingsRow
              label={
                removedSeries.length > 0
                  ? `Removed Series (${removedSeries.length})`
                  : 'Removed Series'
              }
              showDivider={false}
              onPress={toggleRemovedSeries}
              control={
                <Animated.View style={removedChevronStyle}>
                  <ChevronRight size={20} color={themeColors.icon} />
                </Animated.View>
              }
            />

            {/*
              Always mounted, height-clipped — the list has to be laid out for
              `onLayout` to know how tall to animate to. `pointerEvents` is the
              one addition over CollapsibleSettingsSection: this content holds
              buttons that write to the database, and a clipped-but-live
              `Restore` is a worse failure than a clipped-but-live folder row.
            */}
            <Animated.View
              style={[styles.removedSeriesWrapper, removedContentStyle]}
              pointerEvents={removedExpanded ? 'auto' : 'none'}
            >
              <View
                onLayout={(event) => {
                  const { height } = event.nativeEvent.layout;
                  if (height !== removedContentHeight) {
                    setRemovedContentHeight(height);
                  }
                }}
                style={styles.removedSeriesContent}
              >
                <Text
                  style={[
                    styles.removedSeriesCaption,
                    { color: themeColors.textMuted },
                  ]}
                >
                  {removedSeries.length > 0
                    ? REMOVED_SERIES_DESCRIPTION
                    : REMOVED_SERIES_EMPTY}
                </Text>

                {removedSeries.map((entry) => (
                  <View key={entry.name} style={styles.removedSeriesRow}>
                    <Text
                      style={[
                        styles.removedSeriesName,
                        { color: themeColors.text },
                      ]}
                      numberOfLines={2}
                    >
                      {entry.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => runRestore([entry])}
                      disabled={isRestoring}
                      accessibilityRole='button'
                      accessibilityLabel={`Restore ${entry.name}`}
                      style={[
                        styles.restorePill,
                        {
                          backgroundColor: withOpacity(
                            themeColors.primary,
                            0.1,
                          ),
                          opacity: isRestoring ? 0.5 : 1,
                        },
                      ]}
                    >
                      <Undo2 size={16} color={themeColors.primary} />
                      <Text
                        style={[
                          styles.restorePillText,
                          { color: themeColors.primary },
                        ]}
                      >
                        Restore
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {/*
                  Right-aligned and pill-shaped, deliberately NOT a third
                  full-width accent button: 07 already logged that this card's
                  button reads as visually identical to `Apply to Existing
                  Books` above it, and a third would compound that. This is a
                  list utility, so it wears the list's control rather than the
                  card's. Shown only above one entry — over a list of one it
                  duplicates the button two lines above it.
                */}
                {removedSeries.length > 1 && (
                  <View style={styles.restoreAllRow}>
                    <TouchableOpacity
                      onPress={handleRestoreAll}
                      disabled={isRestoring}
                      accessibilityRole='button'
                      accessibilityLabel='Restore all removed series'
                      style={[
                        styles.restorePill,
                        {
                          backgroundColor: withOpacity(
                            themeColors.primary,
                            0.1,
                          ),
                          opacity: isRestoring ? 0.5 : 1,
                        },
                      ]}
                    >
                      <ArchiveRestore
                        size={16}
                        color={themeColors.primary}
                      />
                      <Text
                        style={[
                          styles.restorePillText,
                          { color: themeColors.primary },
                        ]}
                      >
                        Restore All ({removedSeries.length})
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </Animated.View>
          </View>
        </SettingsCard>

        {libraryFolders.length > 0 && (
          <CollapsibleSettingsSection
            title='Library Folders'
            icon={FolderOpen}
            defaultExpanded={false}
          >
            {libraryFolders.map((folder, index) => (
              <CompactSettingsRow
                key={folder}
                label={folder}
                showDivider={index < libraryFolders.length - 1}
                control={
                  <TouchableOpacity
                    onPress={() => handleRemoveFolder(folder)}
                    style={[
                      styles.removeButton,
                      {
                        backgroundColor: withOpacity(
                          themeColors.danger,
                          0.1,
                        ),
                      },
                    ]}
                  >
                    <Trash2 size={18} color={themeColors.danger} />
                    <Text
                      style={[
                        styles.removeButtonText,
                        { color: themeColors.danger },
                      ]}
                    >
                      Remove
                    </Text>
                  </TouchableOpacity>
                }
              />
            ))}
          </CollapsibleSettingsSection>
        )}
      </ScrollView>

      <ProFeaturePopup
        isVisible={showProPopup}
        onClose={() => setShowProPopup(false)}
      />

      <InfoDialogPopup
        isVisible={detectionInfoVisible}
        onClose={() => setDetectionInfoVisible(false)}
        title='Series Detection'
        message={SERIES_DETECTION_INFO}
      />
    </View>
  );
};

export default LibrarySettingsScreen;

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    flex: 1,
  },
  scrollView: {
    paddingTop: 20,
  },
  scrollContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingBottom: 300,
    flexGrow: 1,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  removeButtonText: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: 14,
  },
  addFolderContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 12,
  },
  addFolderDescription: {
    fontFamily: 'Rubik',
    fontSize: 14,
    lineHeight: 18,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonText: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: 16,
  },
  autoChapterContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 12,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerLabel: {
    fontFamily: 'Rubik',
    fontSize: 16,
  },
  seriesDetectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  seriesDetectionOptions: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  // Square, unlike the round bubble the author picker uses for multi-select:
  // this is one independent option, not one of a set.
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Optical alignment with the label's cap height rather than its line box.
    marginTop: 1,
  },
  checkboxTextColumn: {
    flex: 1,
  },
  // Label and caption mirror CompactSettingsRow's own label/description pair,
  // so the sub-option reads as the same kind of thing as the row above it.
  checkboxLabel: {
    fontFamily: 'Rubik',
    fontSize: 16,
  },
  checkboxCaption: {
    fontFamily: 'Rubik',
    fontSize: 13,
    lineHeight: 17,
    marginTop: 4,
  },
  // Copies CompactSettingsRow's own divider, drawn above this row instead of
  // below it. Same hairline, same 16 inset, so it reads as one rule system.
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  // Cancels SettingsCard's content paddingBottom for this last child — see the
  // comment at the block. Without it the row reads as pushed up: 16dp of space
  // above the label and 28dp below it.
  removedSeriesBlock: {
    marginBottom: -16,
  },
  // The clipping half of the animated expansion. Mirrors
  // CollapsibleSettingsSection's `contentWrapper`/`content` pair exactly: the
  // wrapper's height is animated and hides the overflow, and the child is
  // absolutely positioned so it keeps its natural height to be measured
  // instead of being squashed by its parent.
  removedSeriesWrapper: {
    overflow: 'hidden',
  },
  // Restores the card's bottom padding for the expanded state, which the
  // negative margin above has just cancelled.
  removedSeriesContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  removedSeriesCaption: {
    fontFamily: 'Rubik',
    fontSize: 13,
    lineHeight: 17,
  },
  removedSeriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  removedSeriesName: {
    fontFamily: 'Rubik',
    fontSize: 16,
    // Long series names wrap rather than pushing the pill off the edge.
    flexShrink: 1,
  },
  restorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    // Never shrinks: the name beside it is the flexible half.
    flexShrink: 0,
  },
  restorePillText: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: 14,
  },
  restoreAllRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
