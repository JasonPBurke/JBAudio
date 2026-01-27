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
import {
  updateTimerDuration,
  updateCustomTimer,
  updateChapterTimer,
  updateTimerActive,
  updateSleepTime,
} from '@/db/settingsQueries';
import { recordFootprint } from '@/db/footprintQueries';
import UserSettings from '@/db/models/Settings';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useEffect } from 'react';
import TrackPlayer, { State } from 'react-native-track-player';
import { usePlayerStateStore } from '@/store/playerState';
import { useRouter } from 'expo-router';
import { useLibraryStore } from '@/store/library';
import { findChapterIndexByPosition } from '@/helpers/singleFileBook';

const SleepTimerOptions = ({
  bottomSheetModalRef,
  onOptimisticUpdate,
}: {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  onOptimisticUpdate?: (next: {
    active: boolean;
    endTimeMs: number | null;
    chapters: number | null;
  }) => void;
}) => {
  const [showSlider, setShowSlider] = useState(false);
  const [customTimer, setCustomTimer] = useState({ hours: 0, minutes: 0 });
  const [activeTimerDuration, setActiveTimerDuration] = useState<
    number | null
  >(null);
  const [chapterTimerActive, setChapterTimerActive] = useState(false);
  const [chaptersToEnd, setChaptersToEnd] = useState<number>(0);
  const [maxChapters, setMaxChapters] = useState(0);
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
        setActiveTimerDuration(settings[0].timerDuration);
        setChapterTimerActive(settings[0].timerChapters !== null);
        setChaptersToEnd(settings[0].timerChapters || 0);
        if (settings[0].customTimer !== null) {
          const hours = Math.floor(settings[0].customTimer / 60);
          const minutes = settings[0].customTimer % 60;
          setCustomTimer({ hours, minutes });
        }
      }
    };

    const observeSettings = db.collections
      .get<UserSettings>('settings')
      .query()
      .observe();

    const subscription = observeSettings.subscribe((settings) => {
      if (settings.length > 0) {
        const timerDuration = settings[0].timerDuration;
        const customTimerValue = settings[0].customTimer;
        const timerChaptersValue = settings[0].timerChapters;

        setActiveTimerDuration(timerDuration);

        setChapterTimerActive(timerChaptersValue !== null);
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
      const queue = await TrackPlayer.getQueue();
      const isSingleFile = queue.length === 1;

      if (isSingleFile) {
        // Single-file book: get chapter count from library store
        const activeTrack = await TrackPlayer.getActiveTrack();
        if (activeTrack?.bookId) {
          const book = useLibraryStore.getState().books[activeTrack.bookId];
          if (book?.chapters && book.chapters.length > 1) {
            const { position } = await TrackPlayer.getProgress();
            const currentChapterIndex = findChapterIndexByPosition(
              book.chapters,
              position,
            );
            setMaxChapters(book.chapters.length - 1 - currentChapterIndex);
            return;
          }
        }
        setMaxChapters(0);
      } else {
        // Multi-file book: use queue length
        const currentTrackIndex = await TrackPlayer.getActiveTrackIndex();
        if (currentTrackIndex === undefined) {
          setMaxChapters(0);
        } else {
          setMaxChapters(queue.length - 1 - currentTrackIndex);
        }
      }
    };

    fetchSettings();
    updateMaxChapters();
    return () => subscription.unsubscribe();
  }, [db]);

  const handleChapterPlus = async () => {
    updateChapterTimer(chaptersToEnd + 1);
    setChaptersToEnd((prev) => Math.min(prev + 1, maxChapters));
  };

  const handleChapterMinus = () => {
    updateChapterTimer(chaptersToEnd - 1);
    setChaptersToEnd((prev) => Math.max(prev - 1, 0));
  };

  // Helper to record timer activation footprint
  const recordTimerFootprintAsync = async () => {
    try {
      const activeTrack = await TrackPlayer.getActiveTrack();
      if (activeTrack?.bookId) {
        await recordFootprint(activeTrack.bookId, 'timer_activation');
      }
    } catch {
      // Silently fail if footprint recording fails
    }
  };

  const handlePresetPress = async (duration: number) => {
    //! convert to milliseconds (timestamp) before saving for timer calculation
    const totalMilliseconds = duration * 60 * 1000;

    if (activeTimerDuration === totalMilliseconds) {
      //! deactivate timer
      onOptimisticUpdate?.({
        active: false,
        endTimeMs: null,
        chapters: null,
      });
      await updateTimerActive(false);
      await updateTimerDuration(null);
      await updateSleepTime(null);
      setActiveTimerDuration(null);
    } else {
      //! activate timer
      // Check if player is currently playing
      const playbackState = await TrackPlayer.getPlaybackState();
      const isCurrentlyPlaying = playbackState.state === State.Playing;
      const { setRemainingSleepTimeMs } = usePlayerStateStore.getState();

      if (isCurrentlyPlaying) {
        // Player is playing - set sleepTime to start countdown
        onOptimisticUpdate?.({
          active: true,
          endTimeMs: Date.now() + totalMilliseconds,
          chapters: null,
        });
        await updateSleepTime(Date.now() + totalMilliseconds);
      } else {
        // Player is paused - freeze the timer by setting remainingSleepTimeMs
        onOptimisticUpdate?.({
          active: true,
          endTimeMs: null, // Pass null so CountdownTimer uses frozenTimeMs
          chapters: null,
        });
        setRemainingSleepTimeMs(totalMilliseconds);
        await updateSleepTime(null);
      }

      // Common activation steps
      await updateTimerActive(true);
      await updateTimerDuration(totalMilliseconds);
      await updateChapterTimer(null);
      setChapterTimerActive(false);
      setActiveTimerDuration(totalMilliseconds);
      await recordTimerFootprintAsync();
      setTimeout(() => {
        bottomSheetModalRef.current?.close();
      }, 250);
    }
  };

  const handleCustomTimerConfirm = async (value: {
    hours: number;
    minutes: number;
  }) => {
    //! convert to milliseconds before saving for timer calculation
    const totalMilliseconds =
      value.hours * 60 * 60 * 1000 + value.minutes * 60 * 1000;
    if (totalMilliseconds === 0) {
      //! deactivate timer
      onOptimisticUpdate?.({
        active: false,
        endTimeMs: null,
        chapters: null,
      });
      await updateTimerActive(false);
      await updateTimerDuration(null);
      await updateSleepTime(null);
      await updateCustomTimer(null, null);
      await updateChapterTimer(null);
      setActiveTimerDuration(null);
    } else {
      //! activate timer
      // Check if player is currently playing
      const playbackState = await TrackPlayer.getPlaybackState();
      const isCurrentlyPlaying = playbackState.state === State.Playing;
      const { setRemainingSleepTimeMs } = usePlayerStateStore.getState();

      if (isCurrentlyPlaying) {
        // Player is playing - set sleepTime to start countdown
        onOptimisticUpdate?.({
          active: true,
          endTimeMs: Date.now() + totalMilliseconds,
          chapters: null,
        });
        await updateSleepTime(Date.now() + totalMilliseconds);
      } else {
        // Player is paused - freeze the timer by setting remainingSleepTimeMs
        onOptimisticUpdate?.({
          active: true,
          endTimeMs: null, // Pass null so CountdownTimer uses frozenTimeMs
          chapters: null,
        });
        setRemainingSleepTimeMs(totalMilliseconds);
        await updateSleepTime(null);
      }

      // Common activation steps
      await updateTimerActive(true);
      await updateTimerDuration(totalMilliseconds);
      await updateCustomTimer(value.hours, value.minutes);
      setChapterTimerActive(false);
      setActiveTimerDuration(totalMilliseconds);
      await recordTimerFootprintAsync();
      setTimeout(() => {
        bottomSheetModalRef.current?.close();
      }, 250);
    }
    setCustomTimer(value);
    setShowSlider(false);
  };

  const handleChapterTimerPress = async () => {
    if (chapterTimerActive) {
      //! deactivate timer
      onOptimisticUpdate?.({
        active: false,
        endTimeMs: null,
        chapters: null,
      });
      await updateTimerActive(false);
      await updateTimerDuration(null);
      await updateChapterTimer(null);
      setActiveTimerDuration(null);
    } else {
      //! activate timer
      onOptimisticUpdate?.({
        active: true,
        endTimeMs: null,
        chapters: chaptersToEnd,
      });
      await updateTimerActive(true);
      await updateTimerDuration(null);
      await updateSleepTime(null);
      await updateChapterTimer(chaptersToEnd);
      setActiveTimerDuration(null);
      await recordTimerFootprintAsync();
      setTimeout(() => {
        bottomSheetModalRef.current?.close();
      }, 250);
    }
    setChapterTimerActive((prev) => !prev);
  };

  // console.log('maxChapters', maxChapters);
  // console.log('chaptersToEnd', chaptersToEnd);

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
              activeTimerDuration === 15 * 60 * 1000 && styles.activeButton,
              {
                backgroundColor:
                  activeTimerDuration === 15 * 60 * 1000
                    ? getActiveButtonBackground()
                    : themeColors.background,
                borderColor:
                  activeTimerDuration === 15 * 60 * 1000
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
                    activeTimerDuration === 15 * 60 * 1000
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
              activeTimerDuration === 30 * 60 * 1000 && styles.activeButton,
              {
                backgroundColor:
                  activeTimerDuration === 30 * 60 * 1000
                    ? getActiveButtonBackground()
                    : themeColors.background,
                borderColor:
                  activeTimerDuration === 30 * 60 * 1000
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
                    activeTimerDuration === 30 * 60 * 1000
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
              activeTimerDuration === 45 * 60 * 1000 && styles.activeButton,
              {
                backgroundColor:
                  activeTimerDuration === 45 * 60 * 1000
                    ? getActiveButtonBackground()
                    : themeColors.background,
                borderColor:
                  activeTimerDuration === 45 * 60 * 1000
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
                    activeTimerDuration === 45 * 60 * 1000
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
              activeTimerDuration === 60 * 60 * 1000 && styles.activeButton,
              {
                backgroundColor:
                  activeTimerDuration === 60 * 60 * 1000
                    ? getActiveButtonBackground()
                    : themeColors.background,
                borderColor:
                  activeTimerDuration === 60 * 60 * 1000
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
                    activeTimerDuration === 60 * 60 * 1000
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
              activeTimerDuration === 90 * 60 * 1000 && styles.activeButton,
              {
                backgroundColor:
                  activeTimerDuration === 90 * 60 * 1000
                    ? getActiveButtonBackground()
                    : themeColors.background,
                borderColor:
                  activeTimerDuration === 90 * 60 * 1000
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
                    activeTimerDuration === 90 * 60 * 1000
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
              activeTimerDuration === 120 * 60 * 1000 &&
                styles.activeButton,
              {
                backgroundColor:
                  activeTimerDuration === 120 * 60 * 1000
                    ? getActiveButtonBackground()
                    : themeColors.background,
                borderColor:
                  activeTimerDuration === 120 * 60 * 1000
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
                    activeTimerDuration === 120 * 60 * 1000
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
              chapterTimerActive && styles.activeButton,
              {
                backgroundColor: chapterTimerActive
                  ? getActiveButtonBackground()
                  : themeColors.background,
                borderColor: chapterTimerActive
                  ? themeColors.primary
                  : themeColors.textMuted,
              },
            ]}
          >
            <TouchableOpacity
              style={{
                padding: 10,
                paddingEnd: chaptersToEnd > 0 ? 0 : 10,
                borderRadius: 4,
              }}
              onPress={handleChapterMinus}
              // disabled={chaptersToEnd === 0}
            >
              <CircleMinus
                size={28}
                color={
                  chaptersToEnd === 0
                    ? withOpacity(
                        chapterTimerActive
                          ? getActiveButtonTextColor()
                          : themeColors.textMuted,
                        0.43,
                      )
                    : chapterTimerActive
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
                  color: chapterTimerActive
                    ? getActiveButtonTextColor()
                    : themeColors.textMuted,
                },
              ]}
            >
              {chaptersToEnd === maxChapters && maxChapters > 0
                ? 'End of Book'
                : chaptersToEnd > 0
                  ? `End of ${chaptersToEnd + 1} Chapters`
                  : 'End of Chapter'}
            </Text>
            <TouchableOpacity
              style={{
                padding: 10,
                paddingStart: chaptersToEnd > 0 ? 0 : 10,
                borderRadius: 4,
              }}
              onPress={handleChapterPlus}
              // disabled={chaptersToEnd >= maxChapters}
            >
              <CirclePlus
                size={28}
                color={
                  chaptersToEnd >= maxChapters
                    ? withOpacity(
                        chapterTimerActive
                          ? getActiveButtonTextColor()
                          : themeColors.textMuted,
                        0.43,
                      )
                    : chapterTimerActive
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
              activeTimerDuration ===
                customTimer.hours * 60 * 60 * 1000 +
                  customTimer.minutes * 60 * 1000 &&
              (customTimer.hours !== 0 || customTimer.minutes !== 0)
                ? styles.activeButton
                : null,
              {
                backgroundColor:
                  activeTimerDuration ===
                    customTimer.hours * 60 * 60 * 1000 +
                      customTimer.minutes * 60 * 1000 &&
                  (customTimer.hours !== 0 || customTimer.minutes !== 0)
                    ? getActiveButtonBackground()
                    : themeColors.background,
                borderColor:
                  activeTimerDuration ===
                    customTimer.hours * 60 * 60 * 1000 +
                      customTimer.minutes * 60 * 1000 &&
                  (customTimer.hours !== 0 || customTimer.minutes !== 0)
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
                    activeTimerDuration ===
                      customTimer.hours * 60 * 60 * 1000 +
                        customTimer.minutes * 60 * 1000 &&
                    (customTimer.hours !== 0 || customTimer.minutes !== 0)
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
                      activeTimerDuration ===
                        customTimer.hours * 60 * 60 * 1000 +
                          customTimer.minutes * 60 * 1000 &&
                      (customTimer.hours !== 0 || customTimer.minutes !== 0)
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
          button: { borderRadius: 4, fontFamily: 'Rubik-Medium' },
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
    fontFamily: 'Rubik-SemiBold',
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
    fontFamily: 'Rubik-SemiBold',
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
