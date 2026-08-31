import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { colors, screenPadding, colorTokens } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
import { useState } from 'react';
import { TimerPickerModal } from 'react-native-timer-picker';
import { Settings, CirclePlus, CircleMinus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { RefObject } from 'react';
import { updateCustomTimer } from '@/db/settingsQueries';
import UserSettings from '@/db/models/Settings';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import {
  chapterStepperView,
  normalizeChapterCount,
} from '@/helpers/chapterTimerStepper';
import { remainingChapterCount } from '@/helpers/remainingChapterCount';
import {
  resolveTimerGesture,
  resolveTimerMode,
  type TimerGesture,
  type TimerSelection,
} from '@/helpers/sleepTimerSelection';
import { applyTimerCommand } from '@/setup/applyTimerCommand';

const SleepTimerOptions = ({
  bottomSheetModalRef,
}: {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
}) => {
  const [showSlider, setShowSlider] = useState(false);
  const [customTimer, setCustomTimer] = useState({ hours: 0, minutes: 0 });
  // WHICH option is highlighted, and the value it was dialed to. Two separate
  // questions, and conflating them is the bug this screen had: the highlight
  // used to be inferred from whether the value columns were non-null, so
  // dialing a chapter count lit the chapter row while a duration was selected.
  const [timerMode, setTimerMode] = useState<TimerSelection>(null);
  const [timerDuration, setTimerDuration] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  // Both start as `null` for "not known yet", and neither is seeded with a
  // placeholder. The count arrives from a local DB read, the ceiling from
  // async Player reads, and until each lands the stepper must not assert a
  // value it will have to correct a frame later.
  const [chaptersToEnd, setChaptersToEnd] = useState<number | null>(null);
  const [maxChapters, setMaxChapters] = useState<number | null>(null);
  // Distinguishes "the ceiling read has not come back" from "it came back
  // and could not know" — `maxChapters` is `null` for both, and the row must
  // say nothing in the first case and show the stored count in the second.
  const [ceilingResolved, setCeilingResolved] = useState(false);
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const { colors: themeColors, activeColorScheme } = useTheme();

  const db = useDatabase();

  // Helper functions to get inverted colors for active buttons
  const getActiveButtonBackground = () => {
    return activeColorScheme === 'dark'
      ? colorTokens.light.background
      : colorTokens.dark.background;
  };

  const getActiveButtonTextColor = () => {
    return activeColorScheme === 'dark'
      ? colorTokens.light.text
      : colorTokens.dark.text;
  };

  useEffect(() => {
    const fetchSettings = async () => {
      const settingsCollection =
        db.collections.get<UserSettings>('settings');
      const settings = await settingsCollection.query().fetch();
      if (settings.length > 0) {
        const healedChapters = normalizeChapterCount(settings[0].timerChapters);
        setTimerMode(
          resolveTimerMode(
            settings[0].timerMode,
            settings[0].timerDuration,
            healedChapters,
          ),
        );
        setTimerDuration(settings[0].timerDuration);
        setTimerActive(settings[0].timerActive === true);
        setChaptersToEnd(healedChapters ?? 0);
        if (settings[0].customTimer !== null) {
          const hours = Math.floor(settings[0].customTimer / 60);
          const minutes = settings[0].customTimer % 60;
          setCustomTimer({ hours, minutes });
        }
      } else {
        // No settings row: the count is now known, and it is zero. Leaving it
        // unknown would hold the row's label empty for the sheet's lifetime.
        setChaptersToEnd(0);
      }
    };

    const observeSettings = db.collections
      .get<UserSettings>('settings')
      .query()
      .observe();

    const subscription = observeSettings.subscribe((settings) => {
      if (settings.length > 0) {
        const durationValue = settings[0].timerDuration;
        const customTimerValue = settings[0].customTimer;
        // Healed before it reaches state: a negative count read back raw is
        // what let the modal display an armed chapter timer holding one.
        const timerChaptersValue = normalizeChapterCount(
          settings[0].timerChapters,
        );

        setTimerDuration(durationValue);
        setTimerActive(settings[0].timerActive === true);
        setTimerMode(
          resolveTimerMode(
            settings[0].timerMode,
            durationValue,
            timerChaptersValue,
          ),
        );
        if (timerChaptersValue !== null) {
          setChaptersToEnd(timerChaptersValue);
        }

        if (customTimerValue !== null) {
          const hours = Math.floor(customTimerValue / 60);
          const minutes = customTimerValue % 60;
          setCustomTimer({ hours, minutes });
        } else {
          setCustomTimer({ hours: 0, minutes: 0 });
        }
      }
    });

    const updateMaxChapters = async () => {
      // `null` is carried through rather than answered with a number. It used
      // to become 0 here, which the stepper could not tell from a real ceiling
      // of 0, so every count flattened to "End of Chapter" for the width of
      // these reads and a press inside that window wrote a zero to the DB.
      //
      // One of the two ways to get `null` is unreachable here: the player
      // screen cannot be opened with no Book loaded, and this sheet is a child
      // of that screen. The other — a Player read that threw with a Book
      // loaded — is real, and the sheet then shows the stored count with both
      // presses dead until the next open recomputes: it mounts on open and
      // unmounts on dismiss (@gorhom/bottom-sheet gates its children behind
      // `mount`), so a transient failure does not persist for the screen's
      // lifetime.
      setMaxChapters(await remainingChapterCount());
      setCeilingResolved(true);
    };

    fetchSettings();
    updateMaxChapters();
    return () => subscription.unsubscribe();
  }, [db]);

  // The row says nothing until both facts have landed. The settings read is
  // one local DB query and the ceiling is two to four native Player
  // round-trips, so the count reliably arrives first — and showing it, then
  // bounding it a beat later when the ceiling lands, is the flicker this
  // ticket is about rather than a fix for it. Silence costs the width of the
  // sheet's entrance animation; a wrong number costs the user's trust in it.
  const ready = chaptersToEnd !== null && ceilingResolved;

  // One derivation feeds the label, the dimming and the press, so the number
  // the row names is the number a press steps from.
  const stepper = chapterStepperView(ready ? chaptersToEnd : null, maxChapters);

  // Every highlight on this sheet reads `timerMode` and nothing else. That is
  // the whole fix: one field cannot say two options are chosen, so no press
  // anywhere can light a second one.
  const durationSelected = (presetMs: number) =>
    timerMode === 'duration' && timerDuration === presetMs;
  const chapterSelected = timerMode === 'chapter';
  const customMs =
    customTimer.hours * 60 * 60 * 1000 + customTimer.minutes * 60 * 1000;
  const customSelected = customMs > 0 && durationSelected(customMs);

  /**
   * Every press on this sheet goes through here: one decision function, one
   * writer. The modal used to persist from four different handlers and only one
   * of them enforced "a single option is selected", which is precisely how two
   * ended up highlighted.
   */
  const press = async (gesture: TimerGesture) => {
    const command = resolveTimerGesture(
      {
        mode: timerMode,
        durationMs: timerDuration,
        chapters: ready ? chaptersToEnd : null,
        active: timerActive,
      },
      gesture,
      // The modal arms on selection; the settings screen does not. This flag is
      // the ONLY sanctioned difference between the two surfaces.
      'modal',
    );

    const action = await applyTimerCommand(command);

    // Optimistic local echo. The observer above will confirm it, but the sheet
    // is dismissed on the next line and a one-frame stale highlight on the way
    // out is exactly the flicker this component keeps trying to avoid.
    if (command.patch.mode !== undefined) setTimerMode(command.patch.mode);
    if (command.patch.durationMs !== undefined) {
      setTimerDuration(command.patch.durationMs);
    }
    if (command.patch.chapters !== undefined) {
      setChaptersToEnd(command.patch.chapters);
    }
    if (action.kind === 'arm') setTimerActive(true);
    if (action.kind === 'cancel') setTimerActive(false);

    // Closes on ARM only. A press that deselects has removed the user's timer,
    // and dismissing on it would read as confirmation of setting one.
    if (action.kind === 'arm') {
      setTimeout(() => bottomSheetModalRef.current?.close(), 250);
    }
  };

  const stepChapters = (delta: number) => {
    // Dead until both facts have arrived. Stepping from an unread count, or
    // against a ceiling that is still a guess, writes a number the user never
    // asked for.
    if (!ready || maxChapters === null) return;
    press({
      kind: 'stepChapter',
      delta,
      displayedCount: stepper.count,
      maxChapters,
    });
  };

  const handleChapterPlus = () => stepChapters(1);

  const handleChapterMinus = () => stepChapters(-1);

  const handlePresetPress = (minutes: number) =>
    press({ kind: 'pickDuration', durationMs: minutes * 60 * 1000 });

  const handleCustomTimerConfirm = async (value: {
    hours: number;
    minutes: number;
  }) => {
    const totalMinutes = value.hours * 60 + value.minutes;
    if (totalMinutes === 0) {
      // Zero clears the custom VALUE. It deselects only if the custom timer is
      // what is currently selected — resolving it as a press on the lit option
      // unconditionally would select and arm a zero-length duration timer
      // whenever something else was selected.
      if (timerMode === 'duration' && timerDuration !== null) {
        await press({ kind: 'pickDuration', durationMs: timerDuration });
      }
      await updateCustomTimer(null, null);
    } else {
      await updateCustomTimer(value.hours, value.minutes);
      await press({ kind: 'pickDuration', durationMs: totalMinutes * 60 * 1000 });
    }
    setCustomTimer(value);
    setShowSlider(false);
  };

  const handleChapterTimerPress = () => {
    // Nothing to arm while the row is still blank: a press on a label that
    // names no number is a write the user cannot have intended. Deselecting
    // stays available either way, and `pickChapter` resolves to that whenever
    // the row is already lit.
    if (!ready && timerMode !== 'chapter') return;
    press({ kind: 'pickChapter', count: stepper.count });
  };

  return (
    <View style={[styles.container, { marginBottom: bottom }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.textMuted }]}>
          Timer Options
        </Text>
        <TouchableOpacity>
          <Settings
            size={24}
            color={themeColors.primary}
            strokeWidth={1}
            absoluteStrokeWidth
            onPress={() => {
              bottomSheetModalRef.current?.close();
              router.navigate('/timer');
            }}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.buttonContainer}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.button,
              //! check in milliseconds
              durationSelected(15 * 60 * 1000) && styles.activeButton,
              {
                backgroundColor:
                  durationSelected(15 * 60 * 1000)
                    ? getActiveButtonBackground()
                    : themeColors.background,
                borderColor:
                  durationSelected(15 * 60 * 1000)
                    ? themeColors.primary
                    : themeColors.textMuted,
              },
            ]}
            onPress={() => handlePresetPress(15)}
          >
            <Text
              style={[
                styles.buttonText,
                {
                  color:
                    durationSelected(15 * 60 * 1000)
                      ? getActiveButtonTextColor()
                      : themeColors.textMuted,
                },
              ]}
            >
              15 mins
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              //! check in milliseconds
              durationSelected(30 * 60 * 1000) && styles.activeButton,
              {
                backgroundColor:
                  durationSelected(30 * 60 * 1000)
                    ? getActiveButtonBackground()
                    : themeColors.background,
                borderColor:
                  durationSelected(30 * 60 * 1000)
                    ? themeColors.primary
                    : themeColors.textMuted,
              },
            ]}
            onPress={() => handlePresetPress(30)}
          >
            <Text
              style={[
                styles.buttonText,
                {
                  color:
                    durationSelected(30 * 60 * 1000)
                      ? getActiveButtonTextColor()
                      : themeColors.textMuted,
                },
              ]}
            >
              30 mins
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              //! check in milliseconds
              durationSelected(45 * 60 * 1000) && styles.activeButton,
              {
                backgroundColor:
                  durationSelected(45 * 60 * 1000)
                    ? getActiveButtonBackground()
                    : themeColors.background,
                borderColor:
                  durationSelected(45 * 60 * 1000)
                    ? themeColors.primary
                    : themeColors.textMuted,
              },
            ]}
            onPress={() => handlePresetPress(45)}
          >
            <Text
              style={[
                styles.buttonText,
                {
                  color:
                    durationSelected(45 * 60 * 1000)
                      ? getActiveButtonTextColor()
                      : themeColors.textMuted,
                },
              ]}
            >
              45 mins
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.button,
              //! check in milliseconds
              durationSelected(60 * 60 * 1000) && styles.activeButton,
              {
                backgroundColor:
                  durationSelected(60 * 60 * 1000)
                    ? getActiveButtonBackground()
                    : themeColors.background,
                borderColor:
                  durationSelected(60 * 60 * 1000)
                    ? themeColors.primary
                    : themeColors.textMuted,
              },
            ]}
            onPress={() => handlePresetPress(60)}
          >
            <Text
              style={[
                styles.buttonText,
                {
                  color:
                    durationSelected(60 * 60 * 1000)
                      ? getActiveButtonTextColor()
                      : themeColors.textMuted,
                },
              ]}
            >
              1 hr
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              //! check in milliseconds
              durationSelected(90 * 60 * 1000) && styles.activeButton,
              {
                backgroundColor:
                  durationSelected(90 * 60 * 1000)
                    ? getActiveButtonBackground()
                    : themeColors.background,
                borderColor:
                  durationSelected(90 * 60 * 1000)
                    ? themeColors.primary
                    : themeColors.textMuted,
              },
            ]}
            onPress={() => handlePresetPress(90)}
          >
            <Text
              style={[
                styles.buttonText,
                {
                  color:
                    durationSelected(90 * 60 * 1000)
                      ? getActiveButtonTextColor()
                      : themeColors.textMuted,
                },
              ]}
            >
              1.5 hrs
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              //! check in milliseconds
              durationSelected(120 * 60 * 1000) &&
                styles.activeButton,
              {
                backgroundColor:
                  durationSelected(120 * 60 * 1000)
                    ? getActiveButtonBackground()
                    : themeColors.background,
                borderColor:
                  durationSelected(120 * 60 * 1000)
                    ? themeColors.primary
                    : themeColors.textMuted,
              },
            ]}
            onPress={() => handlePresetPress(120)}
          >
            <Text
              style={[
                styles.buttonText,
                {
                  color:
                    durationSelected(120 * 60 * 1000)
                      ? getActiveButtonTextColor()
                      : themeColors.textMuted,
                },
              ]}
            >
              2 hrs
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            onPress={handleChapterTimerPress}
            style={[
              styles.button,
              styles.chapterEndButton,
              chapterSelected && styles.activeButton,
              {
                backgroundColor: chapterSelected
                  ? getActiveButtonBackground()
                  : themeColors.background,
                borderColor: chapterSelected
                  ? themeColors.primary
                  : themeColors.textMuted,
              },
            ]}
          >
            <TouchableOpacity
              style={{
                padding: 10,
                paddingEnd: stepper.count > 0 ? 0 : 10,
                borderRadius: 4,
              }}
              onPress={handleChapterMinus}
            >
              <CircleMinus
                size={28}
                color={
                  !stepper.canStepDown
                    ? withOpacity(
                        chapterSelected
                          ? getActiveButtonTextColor()
                          : themeColors.textMuted,
                        0.43,
                      )
                    : chapterSelected
                      ? getActiveButtonTextColor()
                      : themeColors.textMuted
                }
                strokeWidth={1.5}
                absoluteStrokeWidth
              />
            </TouchableOpacity>
            <Text
              style={[
                styles.buttonText,
                {
                  color: chapterSelected
                    ? getActiveButtonTextColor()
                    : themeColors.textMuted,
                },
              ]}
            >
              {stepper.label}
            </Text>
            <TouchableOpacity
              style={{
                padding: 10,
                paddingStart: stepper.count > 0 ? 0 : 10,
                borderRadius: 4,
              }}
              onPress={handleChapterPlus}
            >
              <CirclePlus
                size={28}
                color={
                  !stepper.canStepUp
                    ? withOpacity(
                        chapterSelected
                          ? getActiveButtonTextColor()
                          : themeColors.textMuted,
                        0.43,
                      )
                    : chapterSelected
                      ? getActiveButtonTextColor()
                      : themeColors.textMuted
                }
                strokeWidth={1.5}
                absoluteStrokeWidth
              />
            </TouchableOpacity>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.customButton,
              customSelected
                ? styles.activeButton
                : null,
              {
                backgroundColor:
                  customSelected
                    ? getActiveButtonBackground()
                    : themeColors.background,
                borderColor:
                  customSelected
                    ? themeColors.primary
                    : themeColors.textMuted,
              },
            ]}
            onPress={() => {
              const totalCustomMinutes =
                customTimer.hours * 60 + customTimer.minutes;
              if (totalCustomMinutes === 0) {
                setShowSlider(true);
              } else {
                handlePresetPress(totalCustomMinutes);
              }
            }}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const totalCustomMinutes =
                customTimer.hours * 60 + customTimer.minutes;
              if (totalCustomMinutes !== 0) {
                setShowSlider(true);
              }
            }}
            delayLongPress={400}
          >
            <Text
              style={[
                styles.buttonText,
                {
                  color:
                    customSelected
                      ? getActiveButtonTextColor()
                      : themeColors.textMuted,
                },
              ]}
            >
              Custom
            </Text>
            {customTimer.hours === 0 && customTimer.minutes === 0 ? null : (
              <Text
                style={[
                  styles.buttonText,
                  {
                    color:
                      customSelected
                        ? getActiveButtonTextColor()
                        : themeColors.textMuted,
                  },
                ]}
              >
                {customTimer.hours}:
                {customTimer.minutes < 10
                  ? `0${customTimer.minutes}`
                  : `${customTimer.minutes}`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <TimerPickerModal
        visible={showSlider}
        setIsVisible={setShowSlider}
        closeOnOverlayPress
        hideSeconds
        initialValue={{
          hours: customTimer.hours,
          minutes: customTimer.minutes,
        }}
        maximumHours={12} //! SET TO HOURS REMAINING IN QUEUE
        modalTitle='Custom Timer'
        modalTitleProps={{ style: { color: themeColors.text } }}
        confirmButtonText='   Set   '
        LinearGradient={LinearGradient}
        onCancel={() => setShowSlider(false)}
        onConfirm={handleCustomTimerConfirm}
        styles={{
          text: { fontFamily: 'Rubik' },
          pickerLabel: { paddingBottom: 4, fontFamily: 'Rubik' },
          // pickerAmPmLabel: { paddingBottom: 10 },
          theme: activeColorScheme,
          contentContainer: {
            backgroundColor: themeColors.modalBackground,
          },
          backgroundColor: themeColors.modalBackground,
          button: { borderRadius: 4, fontFamily: 'Rubik', fontWeight: '500' },
          cancelButton: {
            backgroundColor: themeColors.background,
            color: themeColors.text,
          },
          confirmButton: {
            backgroundColor: themeColors.background,
            borderColor: themeColors.primary,
            color: themeColors.text,
          },
          modalTitle: {
            color: themeColors.text,
            fontFamily: 'Rubik',
          },
        }}
      />
    </View>
  );
};

export default SleepTimerOptions;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: screenPadding.horizontal,
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginRight: 6,
  },
  title: {
    fontFamily: 'Rubik', fontWeight: '600',
    fontSize: 18,
    marginStart: 12,
  },

  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 15,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'Rubik', fontWeight: '600',
    alignSelf: 'center',
    fontSize: 16,
  },
  chapterEndButton: {
    flex: 2.8, // Span two buttons
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  customButton: {
    flex: 1, // Span one button
    paddingHorizontal: 8,
    marginHorizontal: 15,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    borderColor: colors.primary,
  },
});
