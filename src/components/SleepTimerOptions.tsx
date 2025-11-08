import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { colors, screenPadding } from '@/constants/tokens';
import { useState } from 'react';
import { TimerPickerModal } from 'react-native-timer-picker';
import { Settings, CirclePlus, CircleMinus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { RefObject } from 'react';
import {
  updateTimerDuration,
  updateCustomTimer,
  updateChapterTimer,
  updateTimerActive,
} from '@/db/settingsQueries';
import UserSettings from '@/db/models/Settings';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useEffect } from 'react';
import TrackPlayer from 'react-native-track-player';

const SleepTimerOptions = ({
  bottomSheetModalRef,
}: {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
}) => {
  const [showSlider, setShowSlider] = useState(false);
  const [customTimer, setCustomTimer] = useState({ hours: 0, minutes: 0 });
  const [activeTimerDuration, setActiveTimerDuration] = useState<
    number | null
  >(null);
  const [chapterTimerActive, setChapterTimerActive] = useState(false);
  const [chaptersToEnd, setChaptersToEnd] = useState(0);
  const [maxChapters, setMaxChapters] = useState(0);
  const { bottom } = useSafeAreaInsets();

  const db = useDatabase();
  useEffect(() => {
    const fetchSettings = async () => {
      const settingsCollection =
        db.collections.get<UserSettings>('settings');
      const settings = await settingsCollection.query().fetch();
      if (settings.length > 0) {
        setActiveTimerDuration(settings[0].timerDuration);
        setChapterTimerActive(settings[0].timerChapters !== null);
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
        setActiveTimerDuration(timerDuration);

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
      const currentTrackIndex = await TrackPlayer.getActiveTrackIndex();
      if (currentTrackIndex === undefined) {
        setMaxChapters(0);
      } else {
        setMaxChapters(queue.length - 1 - currentTrackIndex);
      }
    };

    fetchSettings();
    updateMaxChapters();
    return () => subscription.unsubscribe();
  }, [db]);

  const handleChapterPlus = async () => {
    setChaptersToEnd((prev) => Math.min(prev + 1, maxChapters));
  };

  const handleChapterMinus = () => {
    setChaptersToEnd((prev) => Math.max(prev - 1, 0));
  };

  const handlePresetPress = async (duration: number) => {
    if (activeTimerDuration === duration) {
      await updateTimerActive(false);
      await updateTimerDuration(null);
      setActiveTimerDuration(null);
    } else {
      await updateTimerActive(true);
      await updateTimerDuration(duration);
      await updateChapterTimer(null);
      setChapterTimerActive(false);
      setActiveTimerDuration(duration);
      // setTimeout(() => {
      //   bottomSheetModalRef.current?.close();
      // }, 500);
    }
  };

  const handleCustomTimerConfirm = async (value: {
    hours: number;
    minutes: number;
  }) => {
    const totalMinutes = value.hours * 60 + value.minutes;
    if (totalMinutes === 0) {
      await updateTimerActive(false);
      await updateTimerDuration(null);
      await updateCustomTimer(null, null);
      await updateChapterTimer(null);
      setActiveTimerDuration(null);
    } else {
      await updateTimerActive(true);
      await updateTimerDuration(totalMinutes);
      await updateCustomTimer(value.hours, value.minutes);
      setChapterTimerActive(false);
      setActiveTimerDuration(totalMinutes);
      // setTimeout(() => {
      //   bottomSheetModalRef.current?.close();
      // }, 500);
    }
    setCustomTimer(value);
    setShowSlider(false);
  };

  const handleChapterTimerPress = async () => {
    if (chapterTimerActive) {
      await updateTimerActive(false);
      await updateTimerDuration(null);
      await updateChapterTimer(null);
      setActiveTimerDuration(null);
    } else {
      await updateTimerActive(true);
      await updateTimerDuration(null);
      await updateChapterTimer(chaptersToEnd);
      setActiveTimerDuration(null);
      // setTimeout(() => {
      //   bottomSheetModalRef.current?.close();
      // }, 500);
    }
    setChapterTimerActive((prev) => !prev);
  };

  console.log('maxChapters', maxChapters);
  console.log('chaptersToEnd', chaptersToEnd);

  return (
    <View style={[styles.container, { marginBottom: bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Sleep Timer Options</Text>
        <TouchableOpacity>
          <Settings
            size={24}
            color={colors.primary}
            strokeWidth={1}
            absoluteStrokeWidth
          />
        </TouchableOpacity>
      </View>

      <View style={styles.buttonContainer}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.button,
              activeTimerDuration === 15 && styles.activeButton,
            ]}
            onPress={() => handlePresetPress(15)}
          >
            <Text style={styles.buttonText}>15 mins</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              activeTimerDuration === 30 && styles.activeButton,
            ]}
            onPress={() => handlePresetPress(30)}
          >
            <Text style={styles.buttonText}>30 mins</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              activeTimerDuration === 45 && styles.activeButton,
            ]}
            onPress={() => handlePresetPress(45)}
          >
            <Text style={styles.buttonText}>45 mins</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.button,
              activeTimerDuration === 60 && styles.activeButton,
            ]}
            onPress={() => handlePresetPress(60)}
          >
            <Text style={styles.buttonText}>1 hr</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              activeTimerDuration === 90 && styles.activeButton,
            ]}
            onPress={() => handlePresetPress(90)}
          >
            <Text style={styles.buttonText}>1.5 hrs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              activeTimerDuration === 120 && styles.activeButton,
            ]}
            onPress={() => handlePresetPress(120)}
          >
            <Text style={styles.buttonText}>2 hrs</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            onPress={handleChapterTimerPress}
            style={[
              styles.button,
              styles.chapterEndButton,
              chapterTimerActive && styles.activeButton,
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
                color={chaptersToEnd === 0 ? '#d8dee96f' : colors.textMuted}
                strokeWidth={1.5}
                absoluteStrokeWidth
              />
            </TouchableOpacity>
            <Text style={styles.buttonText}>
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
                    ? '#d8dee96f'
                    : colors.textMuted
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
                customTimer.hours * 60 + customTimer.minutes &&
              (customTimer.hours !== 0 || customTimer.minutes !== 0)
                ? styles.activeButton
                : null,
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
              const totalCustomMinutes =
                customTimer.hours * 60 + customTimer.minutes;
              if (totalCustomMinutes !== 0) {
                setShowSlider(true);
              }
            }}
          >
            <Text
              style={[
                styles.buttonText,
                customTimer.hours === 0 && customTimer.minutes === 0
                  ? { color: colors.textMuted }
                  : { color: '#d8dee96f' },
              ]}
            >
              Custom
            </Text>
            {customTimer.hours === 0 && customTimer.minutes === 0 ? null : (
              <Text style={styles.buttonText}>
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
        maximumHours={24} //! SET TO HOURS REMAINING IN QUEUE
        modalTitle='Custom Sleep Timer'
        confirmButtonText='   Set   '
        LinearGradient={LinearGradient}
        onCancel={() => setShowSlider(false)}
        onConfirm={handleCustomTimerConfirm}
        styles={{
          theme: 'dark',
          contentContainer: {},
          button: { borderRadius: 4 },
          cancelButton: { backgroundColor: colors.background },
          confirmButton: {
            backgroundColor: colors.background,
            borderColor: colors.primary,
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
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: 'bold',
    marginStart: 12,
  },

  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 15,
    borderRadius: 4,
    borderColor: colors.textMuted,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // boxShadow: '1px 1px 6px rgba(158, 128, 28, 0.541)',
  },
  buttonText: {
    color: colors.textMuted,
    alignSelf: 'center',
    fontSize: 16,
    fontWeight: 'bold',
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
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    marginHorizontal: 15,
    borderRadius: 4,
    borderColor: colors.textMuted,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    borderColor: colors.primary,
  },
});
