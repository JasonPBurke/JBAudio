import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { defaultStyles } from '@/styles';
import { Logs } from 'lucide-react-native';
import { MovingText } from '../components/MovingText';
import { useCurrentChapterStable } from '@/hooks/useCurrentChapterStable';
import { useTheme } from '@/hooks/useTheme';
import { colorTokens } from '@/constants/tokens';
import { LinearGradient } from 'expo-linear-gradient';

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
 */
export const PlayerChaptersModal = React.memo(() => {
  const router = useRouter();
  const { colors: themeColors } = useTheme();
  const currentChapter = useCurrentChapterStable();
  const [titleContainerWidth, setTitleContainerWidth] = useState(0);

  const handleTitleContainerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setTitleContainerWidth(event.nativeEvent.layout.width);
    },
    [],
  );

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
        onLayout={handleTitleContainerLayout}
      >
        <MovingText
          text={currentChapter.chapterTitle ?? ''}
          animationThreshold={25}
          style={{ ...styles.trackTitleText, color: themeColors.lightIcon }}
          containerWidth={titleContainerWidth}
        />
        <LinearGradient
          colors={['transparent', colorTokens.dark.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fadeOverlay}
          pointerEvents='none'
        />
      </View>
    </Pressable>
  );
});

PlayerChaptersModal.displayName = 'PlayerChaptersModal';

const styles = StyleSheet.create({
  chapterTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    paddingVertical: 6,
    // width: '100%',
  },
  trackTitleContainer: {
    overflow: 'hidden',
    maxWidth: '80%',
    flexShrink: 1,
    flexGrow: 0,
  },
  trackTitleText: {
    fontSize: 18,
    fontFamily: 'Rubik-Medium',
  },
  fadeOverlay: {
    position: 'absolute',
    right: -1,
    top: 0,
    bottom: 0,
    width: 10,
  },
});
