import { colors } from '@/constants/tokens';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Grip, Library, List, Settings2 } from 'lucide-react-native';
import TabScreen, { CustomTabs } from '@/components/TabScreen';
import { useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { useScanProgressStore } from '@/helpers/useScanProgressStore';
import Reanimated, {
  SlideInLeft,
  SlideOutLeft,
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

const Header = (props: headerProps) => {
  const {
    toggleView,
    setToggleView,
    selectedTab,
    setSelectedTab,
    bookCounts,
  } = props;
  const navigation = useNavigation();
  const { isScanning, processedBooks, totalBooks, scanJustCompleted } =
    useScanProgressStore();

  const AnimatedText = Reanimated.createAnimatedComponent(Text);
  const AnimatedView = Reanimated.createAnimatedComponent(View);

  const openSettingsDrawer = () => {
    // This will be updated to open the drawer
    navigation.dispatch(DrawerActions.toggleDrawer());
  };
  const handleToggleView = () => {
    setToggleView((prevState) => (prevState + 1) % 3);
  };
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerGroup}>
          <Pressable hitSlop={15} onPress={openSettingsDrawer}>
            <Settings2
              size={20}
              color={colors.icon}
              strokeWidth={1.0}
              absoluteStrokeWidth
            />
          </Pressable>

          <View style={styles.titleWrapper}>
            <Text style={styles.titleStaticS}>S</Text>
            <View style={styles.titleContainer}>
              {isScanning ? (
                <AnimatedText
                  key='scanning'
                  entering={SlideInLeft.delay(400).duration(1500)}
                  exiting={SlideOutLeft.delay(2000).duration(1500)}
                  style={[styles.titleText, styles.scanningText]}
                  numberOfLines={1}
                  ellipsizeMode='tail'
                >
                  canning books...{' '}
                  {totalBooks !== 0 && `${processedBooks} of ${totalBooks}`}
                </AnimatedText>
              ) : scanJustCompleted ? (
                <AnimatedText
                  key='onicbooks'
                  entering={SlideInLeft.delay(2100).duration(1500)}
                  exiting={SlideOutLeft.duration(1500)}
                  style={styles.titleText}
                >
                  onicbooks
                </AnimatedText>
              ) : (
                <Text key='onicbooks-static' style={styles.titleText}>
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
                color={colors.icon}
                strokeWidth={1.5}
                absoluteStrokeWidth
              />
            )}
            {toggleView === 1 && (
              <List
                size={24}
                color={colors.icon}
                strokeWidth={1.5}
                absoluteStrokeWidth
              />
            )}
            {toggleView === 2 && (
              <Grip
                size={24}
                color={colors.icon}
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
    paddingVertical: 4,
    gap: 16,
    backgroundColor: colors.background,
    // borderBlockEndColor: colors.primary,
    // borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
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
    color: '#FFB606',
    fontSize: 20,
    zIndex: 1, // Ensure 'S' is on top
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
    color: colors.icon,
    fontSize: 20,
  },
  scanningText: {
    width: '100%',
  },
  bookStatusLinkText: {
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.textMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
});
