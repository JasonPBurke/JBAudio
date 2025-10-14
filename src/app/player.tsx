import { colors, screenPadding } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import {
  StyleSheet,
  View,
  Text,
  // TouchableHighlight,
  ActivityIndicator,
  Pressable,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useActiveTrack } from 'react-native-track-player';
// import FastImage from '@d11/react-native-fast-image';
import { Image } from 'expo-image';
import { unknownBookImageUri } from '@/constants/images';
import { MovingText } from '@/components/MovingText';
import { PlayerControls } from '@/components/PlayerControls';
import { PlayerProgressBar } from '@/components/PlayerProgressBar';
import { usePlayerBackground } from '@/hooks/usePlayerBackground';
import { LinearGradient } from 'expo-linear-gradient';
import ModalComponent from '@/components/ModalComponent';
import { useState } from 'react';
import { useBook } from '@/store/library';
import { Book } from '@/types/Book';
import { Logs } from 'lucide-react-native';

const PlayerScreen = () => {
  const [showModal, setShowModal] = useState(false);

  const activeTrack = useActiveTrack();
  const book = useBook(activeTrack?.artist ?? '', activeTrack?.album ?? '');

  const { imageColors } = usePlayerBackground(
    activeTrack?.artwork ?? unknownBookImageUri
  );

  const { top, bottom } = useSafeAreaInsets();

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
              // imageColors.vibrant,
              // imageColors.lightVibrant,
              // imageColors.darkMuted,
              // imageColors.darkVibrant,
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
          style={{ flex: 1, marginTop: top + 70, marginBottom: bottom }}
        >
          <View style={styles.artworkImageContainer}>
            <Image
              contentFit='contain'
              source={{
                uri: activeTrack?.artwork ?? unknownBookImageUri,
                // priority: FastImage.priority.high,
              }}
              // resizeMode={FastImage.resizeMode.contain}
              style={styles.artworkImage}
            />
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ marginTop: 70 }}>
              <View>
                <Pressable
                  onPress={() => setShowModal(true)}
                  style={styles.chapterTitleContainer}
                >
                  <Logs
                    size={24}
                    style={{ transform: [{ rotateY: '180deg' }] }}
                    color={colors.icon}
                    strokeWidth={1.5}
                    absoluteStrokeWidth
                  />

                  <View style={styles.trackTitleContainer}>
                    <MovingText
                      text={activeTrack.title ?? ''}
                      animationThreshold={34}
                      style={styles.trackTitleText}
                    />
                  </View>
                </Pressable>
                <PlayerProgressBar style={{ marginTop: 70 }} />

                <PlayerControls style={{ marginTop: 50 }} />
              </View>
              <ModalComponent
                propagateSwipe
                isVisible={showModal}
                onBackdropPress={() => setShowModal(false)}
                onBackButtonPress={() => setShowModal(false)}
                hideModal={() => setShowModal(false)}
                swipeDirection={'up'}
                onSwipeComplete={() => setShowModal(false)}
                animationIn='slideInUp'
                animationOut='slideOutDown'
                style={{
                  // ...styles.metadataModal,
                  backgroundColor: '#1C1C1C',
                }}
              >
                <ChapterList book={book} />
              </ModalComponent>
            </View>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
};

export default PlayerScreen;

const ChapterList = ({ book }: { book: Book | undefined }) => {
  return (
    <View style={{ flex: 1, width: '100%', padding: 20 }}>
      <Text
        style={{
          color: colors.text,
          fontSize: 20,
          textAlign: 'center',
          marginBottom: 20,
        }}
      >
        Chapters
      </Text>
      {book?.chapters && book.chapters.length > 0 ? (
        <FlatList
          data={book.chapters}
          keyExtractor={(item) => item.chapterTitle}
          renderItem={({ item }) => {
            return (
              <View style={styles.chapterItem}>
                <Text style={styles.chapterTitle}>{item.chapterTitle}</Text>
                {/* <Text style={styles.chapterDuration}>{item.duration}</Text> */}
              </View>
            );
          }}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <Text
          style={{
            color: colors.textMuted,
            textAlign: 'center',
          }}
        >
          No chapters found for this book.
        </Text>
      )}
    </View>
  );
};

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

const styles = StyleSheet.create({
  overlayContainer: {
    ...defaultStyles.container,
    paddingHorizontal: screenPadding.horizontal,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  artworkImageContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    height: '55%',
    width: '100%',
  },
  artworkImage: {
    height: '100%',
    width: '100%',
    borderRadius: 6,
  },
  chapterTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  trackTitleContainer: {
    overflow: 'hidden',
    maxWidth: '80%',
  },
  trackTitleText: {
    flex: 1,
    ...defaultStyles.text,
    fontSize: 18,
    fontWeight: '500',
  },
  backButton: {
    width: 55,
    height: 7,
    backgroundColor: '#1c1c1ca9',
    borderRadius: 50,
    borderColor: colors.textMuted,
    borderWidth: 1,
    justifyContent: 'center',
    alignSelf: 'center',
    // position: 'absolute',
    // left: 16,
    // right: 0,
    // flexDirection: 'row',
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
