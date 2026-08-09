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
import { useSharedValue } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import {
  Check,
  ChevronRight,
  FolderOpen,
  Trash2,
  FolderPlus,
  Layers,
  TableOfContents,
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
  loadSuppressedSeriesNames,
  normalizeSortName,
} from '@/db/seriesQueries';
import { runSeriesDetection } from '@/db/seriesDetectionRun';
import { summarizeDetectionRun } from '@/helpers/seriesDetectionSummary';
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
  const [removedSeriesCount, setRemovedSeriesCount] = useState(0);
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
        const suppressedNames = await loadSuppressedSeriesNames();

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
          // leave two rows for one name. Counting them raw would show
          // `Removed Series (2)` over a list of one, so the count is of
          // distinct series identities: `normalizeSortName` is the same key
          // series identity uses everywhere else (A15).
          setRemovedSeriesCount(
            new Set(suppressedNames.map(normalizeSortName)).size,
          );
        }
      };
      fetchSettings();

      return () => {
        isActive = false;
      };
    }, []),
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
                    Finds series that have no series tags, using folder names.
                    May occasionally group a folder that isn&apos;t a series.
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
                  style={[styles.addButtonText, { color: themeColors.primary }]}
                >
                  {isDetecting
                    ? 'Detecting...'
                    : 'Detect Series in Existing Books'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/*
            The count is suppressed at zero rather than reading `(0)`, but the
            row itself always shows: A12 rejected the delete-dialog checkbox
            because a modifier asking for foresight fails exactly when foresight
            is absent, and the same argument applies to an entry point that only
            appears once you already need it.

            TICKET 09 OWNS THE LIST AND THIS ROW'S `onPress`. It is deliberately
            not pressable yet — a chevron that goes nowhere is better than a
            ripple that goes nowhere, and nothing writes a suppression row until
            09 lands, so the count is 0 on every device until then.
          */}
          <CompactSettingsRow
            label={
              removedSeriesCount > 0
                ? `Removed Series (${removedSeriesCount})`
                : 'Removed Series'
            }
            showDivider={false}
            control={<ChevronRight size={20} color={themeColors.icon} />}
          />
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
    fontFamily: 'Rubik', fontWeight: '600',
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
    fontFamily: 'Rubik', fontWeight: '600',
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
    paddingBottom: 4,
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
});
