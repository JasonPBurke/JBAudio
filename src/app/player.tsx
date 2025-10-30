import { colors, screenPadding } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import TrackPlayer, { useActiveTrack } from 'react-native-track-player';
import { ShadowedView, shadowStyle } from 'react-native-fast-shadow';
import { Image } from 'expo-image';
import { unknownBookImageUri } from '@/constants/images';
import { PlayerControls } from '@/components/PlayerControls';
import { PlayerProgressBar } from '@/components/PlayerProgressBar';
import { usePlayerBackground } from '@/hooks/usePlayerBackground';
import { LinearGradient } from 'expo-linear-gradient';
import { PlayerChaptersModal } from '@/components/PlayerChaptersModal';
import { useCallback, useRef } from 'react';
import { useBook, useLibraryStore } from '@/store/library';
import { BottomSheetModal } from '@gorhom/bottom-sheet';

const PlayerScreen = () => {
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const activeTrack = useActiveTrack();
  const book = useBook(activeTrack?.artist ?? '', activeTrack?.album ?? '');
  const { updateBookChapterIndex } = useLibraryStore();

  const handlePresentPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const handleChapterSelect = useCallback(
    async (chapterIndex: number) => {
      if (!book?.bookId) return;

      await TrackPlayer.skip(chapterIndex);
      await TrackPlayer.play();

      //! update state store an rely on the observer to update the db is better??
      await updateBookChapterIndex(book.bookId, chapterIndex);

      bottomSheetModalRef.current?.close();
    },
    [book?.bookId, updateBookChapterIndex]
  );

  const imgHeight = book?.artworkHeight;
  const imgWidth = book?.artworkWidth;
  const { imageColors } = usePlayerBackground(
    activeTrack?.artwork ?? unknownBookImageUri
  );

  // const { top, bottom } = useSafeAreaInsets();

  if (!activeTrack) {
    return (
      <View style={[defaultStyles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.icon} />
      </View>
    );
  }

  //* LinearGradient imageColors options
  // 	{
  //   "average": "#393734",
  //   "platform": "android",
  //   "dominant": "#001820",
  //   "vibrant": "#E07008",
  //   "darkVibrant": "#001820",
  //   "lightVibrant": "#F8D068",
  //   "muted": "#905058",
  //   "darkMuted": "#302020",
  //   "lightMuted": "#2E3440"
  // }

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      locations={[0.15, 0.35, 0.45, 0.6]}
      style={{ flex: 1 }}
      colors={
        imageColors
          ? [
              imageColors.darkVibrant,
              imageColors.lightVibrant,
              imageColors.vibrant,
              imageColors.darkMuted,
            ]
          : [
              colors.primary,
              colors.primary,
              colors.background,
              colors.background,
            ]
      }
    >
      <View style={styles.overlayContainer}>
        <DismissPlayerSymbol />
        <View
          style={{
            ...styles.artworkImageContainer,
            width: imgHeight
              ? (imgWidth! / imgHeight) * FIXED_ARTWORK_HEIGHT
              : 0,
          }}
        >
          <ShadowedView
            style={shadowStyle({
              opacity: 0.4,
              radius: 12,
              offset: [5, 3],
            })}
          >
            <Image
              contentFit='contain'
              source={{
                uri: activeTrack?.artwork ?? unknownBookImageUri,
              }}
              style={styles.artworkImage}
            />
          </ShadowedView>
        </View>

        <View style={{ marginTop: 70 }}>
          <PlayerChaptersModal
            book={book}
            handlePresentPress={handlePresentPress}
            bottomSheetModalRef={bottomSheetModalRef}
            onChapterSelect={handleChapterSelect}
          />
          <PlayerProgressBar style={{ marginTop: 70 }} />

          <PlayerControls style={{ marginTop: 50 }} />
        </View>
      </View>
    </LinearGradient>
  );
};

export default PlayerScreen;

const DismissPlayerSymbol = () => {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const handlePress = () => {
    router.back();
  };

  return (
    <Pressable
      hitSlop={10}
      style={{ ...styles.backButton, top: top + 8 }}
      onPress={handlePress}
    />
  );
};

const FIXED_ARTWORK_HEIGHT = 350;

const styles = StyleSheet.create({
  overlayContainer: {
    ...defaultStyles.container,
    paddingHorizontal: screenPadding.horizontal,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  artworkImageContainer: {
    marginVertical: 60,
    alignSelf: 'center',
    height: FIXED_ARTWORK_HEIGHT,
  },
  artworkImage: {
    height: FIXED_ARTWORK_HEIGHT,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 6,
  },
  backButton: {
    marginBottom: 18,
    width: 55,
    height: 7,
    backgroundColor: '#1c1c1ca9',
    borderRadius: 50,
    borderColor: colors.textMuted,
    borderWidth: 1,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  chapterItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.textMuted,
  },
  chapterTitle: {
    ...defaultStyles.text,
    fontSize: 16,
  },
  chapterDuration: {
    ...defaultStyles.text,
    fontSize: 14,
    color: colors.textMuted,
  },
});
