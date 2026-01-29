import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { Logs } from 'lucide-react-native';
import { MovingText } from '../components/MovingText';
import { useCurrentChapterStable } from '@/hooks/useCurrentChapterStable';
import { useTheme } from '@/hooks/useTheme';

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

  const handleTitleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    setTitleContainerWidth(event.nativeEvent.layout.width);
  }, []);

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

      <View style={styles.trackTitleContainer} onLayout={handleTitleContainerLayout}>
        <MovingText
          text={currentChapter.chapterTitle ?? ''}
          animationThreshold={34}
          style={{ ...styles.trackTitleText, color: themeColors.lightIcon }}
          containerWidth={titleContainerWidth}
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
    gap: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  trackTitleContainer: {
    overflow: 'hidden',
    maxWidth: '80%',
  },
  trackTitleText: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Rubik-Medium',
  },
});
