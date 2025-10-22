import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  ViewProps,
} from 'react-native';
import { useActiveTrack, useProgress } from 'react-native-track-player';
// import FastImage from '@d11/react-native-fast-image';
import { Image } from 'expo-image';

import { unknownBookImageUri } from '@/constants/images';
import { defaultStyles } from '@/styles';
import {
  PlayPauseButton,
  SeekBackButton,
} from '@/components/PlayerControls';
import { useLastActiveTrack } from '@/hooks/useLastActiveTrack';
import { MovingText } from '@/components/MovingText';
import { useRouter } from 'expo-router';
import { formatSecondsToMinutes } from '@/helpers/miscellaneous';
import { colors } from '@/constants/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const FloatingPlayer = ({ style }: ViewProps) => {
  const { duration, position } = useProgress(250);
  const trackRemainingTime = formatSecondsToMinutes(duration - position);
  const { bottom } = useSafeAreaInsets();

  const router = useRouter();
  const activeBook = useActiveTrack();
  // const isActiveBook =
  //   useActiveTrack()?.url ===
  //   activeBook?.chapters[activeBook?.bookProgress.currentChapterIndex].url;
  const lastActiveBook = useLastActiveTrack();
  const displayedBook = activeBook ?? lastActiveBook;

  if (!displayedBook) {
    return null;
  }

  const handlePress = () => {
    router.navigate('/player');
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handlePress}
      style={[
        styles.parentContainer,
        style,
        {
          marginBottom: bottom - 12,
          borderColor: colors.primary,
          borderWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <>
        <Image
          contentFit='contain'
          source={{
            uri: displayedBook.artwork ?? unknownBookImageUri,
          }}
          style={styles.bookArtworkImage}
        />

        <View style={styles.bookTitleContainer}>
          <MovingText
            style={styles.bookTitle}
            text={displayedBook.title ?? ''}
            animationThreshold={25}
          />
          <Text style={styles.bookTimeRemaining}>
            {trackRemainingTime} left
          </Text>
        </View>
        <View style={styles.bookControlsContainer}>
          <SeekBackButton iconSize={32} top={14} right={19} fontSize={12} />
          <PlayPauseButton iconSize={40} top={6} left={6} />
        </View>
      </>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  parentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2226ff', // 3B4252
    borderRadius: 6,
  },
  bookArtworkImage: {
    height: 50,
    width: 50,
    borderRadius: 3,
  },
  bookTitleContainer: {
    flex: 1,
    overflow: 'hidden',
    margin: 4,
  },
  bookTitle: {
    ...defaultStyles.text,
    fontSize: 18,
    fontWeight: '600',
  },
  bookTimeRemaining: {
    ...defaultStyles.text,
    fontSize: 12,
    fontWeight: '400',
  },
  bookControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // columnGap: 14,
    paddingVertical: 4,
    // paddingHorizontal: 8,
  },
});
