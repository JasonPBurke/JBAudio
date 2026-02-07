import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Grip, Library, List, Settings2 } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { screenPadding } from '@/constants/tokens';
import TabScreen, { CustomTabs } from '@/components/TabScreen';
import { useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { useScanProgressStore } from '@/hooks/useScanProgressStore';
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

// Pulse Animation Configuration
const PULSE_DURATION = 1250;
const MIN_OPACITY = 0.3;

const PulsingText = ({
  style,
  children,
}: {
  style: any;
  children: string;
}) => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withDelay(
      1250,
      withRepeat(
        withSequence(
          withTiming(MIN_OPACITY, { duration: PULSE_DURATION }),
          withTiming(1, { duration: PULSE_DURATION }),
        ),
        -1,
        false,
      ),
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <AnimatedText style={[style, animatedStyle]}>{children}</AnimatedText>
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
  const { isScanning, totalBooks, scanJustCompleted } =
    useScanProgressStore();

  const openSettingsDrawer = () => {
    navigation.dispatch(DrawerActions.toggleDrawer());
  };
  const handleToggleView = () => {
    setToggleView((prevState) => (prevState + 1) % 3);
  };
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: themeColors.background },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.headerGroup, { flex: 1 }]}>
          <Pressable hitSlop={15} onPress={openSettingsDrawer}>
            <Settings2
              size={20}
              color={themeColors.icon}
              strokeWidth={1.0}
              absoluteStrokeWidth
            />
          </Pressable>

          <View style={styles.titleWrapper}>
            <Text
              style={[
                styles.titleStaticS,
                {
                  color: themeColors.primary,
                },
              ]}
            >
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
                    {
                      flexDirection: 'row',
                      alignItems: 'flex-end',
                      gap: 8,
                    },
                  ]}
                >
                  <PulsingText
                    style={[
                      styles.titleText,
                      {
                        color: themeColors.icon,
                      },
                    ]}
                  >
                    canning books...
                  </PulsingText>
                  {totalBooks !== 0 && (
                    <AnimatedText
                      entering={FadeIn}
                      style={[
                        styles.titleText,
                        { color: themeColors.icon },
                      ]}
                    >
                      {`${totalBooks} added`}
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
                <Text
                  key='onicbooks-static'
                  style={[
                    styles.titleText,
                    {
                      color: themeColors.icon,
                    },
                  ]}
                >
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
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding.horizontal,
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
    flex: 1,
  },
  titleStaticS: {
    fontFamily: 'Rubik-Medium',
    fontSize: 20,
    zIndex: 1,
    backgroundColor: 'transparent',
  },

  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    flex: 1,
  },
  scanningContainer: {
    minWidth: 200, // Set a minimum width to prevent clipping
  },
  titleText: {
    fontFamily: 'Rubik-Medium',
    fontSize: 20,
  },
  scanningText: {
    width: '100%',
  },
  bookStatusLinkText: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
});
