import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useActiveTrack } from 'react-native-track-player';
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
import { colors } from '@/constants/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueueStore } from '@/store/queue';
import { useBookById } from '@/store/library';
import { BookTimeRemaining } from '@/components/BookTimeRemaining';
import React from 'react';

export const FloatingPlayer = React.memo(() => {
  const { bottom } = useSafeAreaInsets();
  const isPlayerReady = useQueueStore((state) => state.isPlayerReady);

  const router = useRouter();
  const activeTrack = useActiveTrack();
  const lastActiveTrack = useLastActiveTrack();
  const displayedTrack = activeTrack ?? lastActiveTrack;

  const displayedBook = useBookById(displayedTrack?.bookId ?? '');

  if (!isPlayerReady || !displayedTrack || !displayedBook) {
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
            text={displayedBook.bookTitle ?? ''}
            animationThreshold={25}
          />
          <BookTimeRemaining />
        </View>
        <View style={styles.bookControlsContainer}>
          <SeekBackButton iconSize={32} top={4} right={9} fontSize={12} />
          <PlayPauseButton iconSize={40} top={6} left={6} />
        </View>
      </>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  parentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2226ff', // 3B4252
    borderRadius: 6,
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 10,
  },
  bookArtworkImage: {
    height: 50,
    width: 50,
    borderRadius: 3,
    marginLeft: 4,
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
  bookControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // columnGap: 14,
    paddingVertical: 4,
    // paddingHorizontal: 8,
  },
});
