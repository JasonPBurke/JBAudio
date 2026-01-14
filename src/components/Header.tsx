import { useEffect } from 'react';
import { colors } from '@/constants/tokens';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Grip, Library, List, Settings2 } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import TabScreen, { CustomTabs } from '@/components/TabScreen';
import { useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { useScanProgressStore } from '@/helpers/useScanProgressStore';
import Reanimated, {
  FadeIn,
  SlideInLeft,
  SlideOutLeft,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

type headerProps = {
  setToggleView: React.Dispatch<React.SetStateAction<number>>;
  toggleView: number;
  selectedTab: CustomTabs;
  setSelectedTab: (tab: CustomTabs) => void;
  bookCounts: {
    all: number;
    unplayed: number;
    playing: number;
    finished: number;
  };
};

const AnimatedText = Reanimated.createAnimatedComponent(Text);
const AnimatedView = Reanimated.createAnimatedComponent(View);

// Animation Configuration
const DOT_INTERVAL = 300; // Time between each dot appearing (Speed)
const FADE_IN_DURATION = 300; // should match dot interval
const FADE_OUT_DURATION = 600;
const LOOP_PAUSE = 500; // Pause before restarting the loop
const HOLD_TIME = 400; // How long the last dot waits before fading out
const SYNC_BASE = DOT_INTERVAL * 2 + HOLD_TIME; // Ensures all dots fade out together

const Dot = ({ delay, style }: { delay: number; style: any }) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    setTimeout(() => {}, 500);
    opacity.value = withRepeat(
      withSequence(
        withDelay(delay, withTiming(1, { duration: FADE_IN_DURATION })),
        withDelay(
          SYNC_BASE - delay,
          withTiming(0, { duration: FADE_OUT_DURATION })
        ),
        withDelay(LOOP_PAUSE, withTiming(0, { duration: 0 }))
        //  withDelay(delay, withTiming(1, { duration: 300 })),
        // withDelay(1000 - delay, withTiming(0, { duration: 600 })),
        // withDelay(500, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );
  }, [delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <AnimatedText style={[style, animatedStyle]}>.</AnimatedText>;
};

const AnimatedEllipsis = ({ style }: { style: any }) => {
  return (
    <View style={{ flexDirection: 'row' }}>
      <Dot delay={0} style={style} />
      <Dot delay={DOT_INTERVAL} style={style} />
      <Dot delay={DOT_INTERVAL * 2} style={style} />
    </View>
  );
};

const Header = (props: headerProps) => {
  const {
    toggleView,
    setToggleView,
    selectedTab,
    setSelectedTab,
    bookCounts,
  } = props;
  const navigation = useNavigation();
  const { colors: themeColors } = useTheme();
  const { isScanning, processedBooks, totalBooks, scanJustCompleted } =
    useScanProgressStore();

  const openSettingsDrawer = () => {
    navigation.dispatch(DrawerActions.toggleDrawer());
  };
  const handleToggleView = () => {
    setToggleView((prevState) => (prevState + 1) % 3);
  };
  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerGroup}>
          <Pressable hitSlop={15} onPress={openSettingsDrawer}>
            <Settings2
              size={20}
              color={themeColors.icon}
              strokeWidth={1.0}
              absoluteStrokeWidth
            />
          </Pressable>

          <View style={styles.titleWrapper}>
            <Text style={[styles.titleStaticS, { color: themeColors.primary }]}>
              S
            </Text>
            <View style={styles.titleContainer}>
              {isScanning ? (
                <AnimatedView
                  key='scanning'
                  entering={SlideInLeft.delay(100).duration(1500)}
                  exiting={SlideOutLeft.delay(2000).duration(1500)}
                  style={[
                    styles.scanningText,
                    { flexDirection: 'row', alignItems: 'flex-end' },
                  ]}
                >
                  <Text style={[styles.titleText, { color: themeColors.icon }]}>
                    canning books
                  </Text>
                  <AnimatedEllipsis style={[styles.titleText, { color: themeColors.icon }]} />
                  {totalBooks !== 0 && (
                    <AnimatedText
                      entering={FadeIn}
                      style={[styles.titleText, { color: themeColors.icon }]}
                    >
                      {`${processedBooks} of ${totalBooks}`}
                    </AnimatedText>
                  )}
                </AnimatedView>
              ) : scanJustCompleted ? (
                <AnimatedText
                  key='onicbooks'
                  entering={SlideInLeft.delay(2100).duration(1500)}
                  exiting={SlideOutLeft.duration(1500)}
                  style={[styles.titleText, { color: themeColors.icon }]}
                >
                  onicbooks
                </AnimatedText>
              ) : (
                <Text key='onicbooks-static' style={[styles.titleText, { color: themeColors.icon }]}>
                  onicbooks
                </Text>
              )}
            </View>
          </View>
        </View>
        <View style={styles.headerGroup}>
          <Pressable hitSlop={15} onPress={handleToggleView}>
            {toggleView === 0 && (
              <Library
                style={{ transform: [{ rotateY: '180deg' }] }}
                size={24}
                color={themeColors.icon}
                strokeWidth={1.5}
                absoluteStrokeWidth
              />
            )}
            {toggleView === 1 && (
              <List
                size={24}
                color={themeColors.icon}
                strokeWidth={1.5}
                absoluteStrokeWidth
                style={{ transform: [{ rotateY: '180deg' }] }}
              />
            )}
            {toggleView === 2 && (
              <Grip
                size={24}
                color={themeColors.icon}
                strokeWidth={1.5}
                absoluteStrokeWidth
              />
            )}
          </Pressable>
        </View>
      </View>
      <TabScreen
        selectedTab={selectedTab}
        setSelectedTab={setSelectedTab}
        bookCounts={bookCounts}
      />
    </View>
  );
};

export default Header;

const styles = StyleSheet.create({
  container: {
    gap: 16,
    // backgroundColor moved to inline for theme support
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingHorizontal: 16,
  },
  headerGroup: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleStaticS: {
    // color: '#FFB606',
    fontSize: 20,
    zIndex: 1,
    backgroundColor: 'transparent',
  },

  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    width: 300,
  },
  scanningContainer: {
    minWidth: 200, // Set a minimum width to prevent clipping
  },
  titleText: {
    fontSize: 20,
    // color moved to inline for theme support
  },
  scanningText: {
    width: '100%',
  },
  bookStatusLinkText: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    // colors moved to inline for theme support
  },
});
