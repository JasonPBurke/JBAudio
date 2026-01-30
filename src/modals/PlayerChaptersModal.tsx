import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { defaultStyles } from '@/styles';
import { Logs } from 'lucide-react-native';
import { MovingText } from '../components/MovingText';
import { useCurrentChapterStable } from '@/hooks/useCurrentChapterStable';
import { useTheme } from '@/hooks/useTheme';
// import { LinearGradient } from 'expo-linear-gradient';

const logsIconStyle = { transform: [{ rotateY: '180deg' as const }] };
const loadingContainerStyle = [
  defaultStyles.container,
  { justifyContent: 'center' as const },
];

/**
 * PlayerChaptersModal - Now a simple trigger that navigates to the chapter list screen.
 *
 * Uses native Stack.Screen modal presentation instead of BottomSheetModal for
 * more reliable scroll behavior.
 *
 * @param darkestColor - The darkest color from the book's artwork gradient (passed from parent)
 */
export const PlayerChaptersModal = React.memo(
  ({ darkestColor }: { darkestColor: string }) => {
    const router = useRouter();
    const { colors: themeColors } = useTheme();
    const currentChapter = useCurrentChapterStable();

    const handlePress = () => {
      router.push('/chapterList');
    };

    if (!currentChapter) {
      return (
        <View style={loadingContainerStyle}>
          <ActivityIndicator color={themeColors.icon} />
        </View>
      );
    }

    return (
      <Pressable onPress={handlePress} style={styles.chapterTitleContainer}>
        <Logs
          size={24}
          style={logsIconStyle}
          color={themeColors.lightIcon}
          strokeWidth={1.5}
          absoluteStrokeWidth
        />

        <View
          style={styles.trackTitleContainer}
          // onLayout={handleTitleContainerLayout}
        >
          <MovingText
            text={currentChapter.chapterTitle ?? ''}
            animationThreshold={35}
            style={{
              ...styles.trackTitleText,
              color: themeColors.lightIcon,
            }}
            // containerWidth={titleContainerWidth}
          />
          {/* <LinearGradient
            colors={['transparent', darkestColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fadeOverlay}
            pointerEvents='none'
          /> */}
        </View>
      </Pressable>
    );
  },
);

PlayerChaptersModal.displayName = 'PlayerChaptersModal';

const styles = StyleSheet.create({
  chapterTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    // alignSelf: 'center',
    // width: '100%',
  },
  trackTitleContainer: {
    overflow: 'hidden',
    maxWidth: '80%',
    // borderColor: 'red',
    // borderWidth: 1,
  },
  trackTitleText: {
    fontSize: 18,
    fontFamily: 'Rubik-Medium',
  },
  // fadeOverlay: {
  //   position: 'absolute',
  //   right: 0,
  //   top: 0,
  //   bottom: 0,
  //   width: 10,
  // },
});
