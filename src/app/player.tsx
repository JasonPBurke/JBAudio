import { colors, screenPadding } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import {
  StyleSheet,
  View,
  TouchableHighlight,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useActiveTrack } from 'react-native-track-player';
import FastImage from '@d11/react-native-fast-image';
import { unknownBookImageUri } from '@/constants/images';
import { MovingText } from '@/components/MovingText';
import { PlayerControls } from '@/components/PlayerControls';
import { PlayerProgressBar } from '@/components/PlayerProgressBar';
import { usePlayerBackground } from '@/hooks/usePlayerBackground';
import { LinearGradient } from 'expo-linear-gradient';
import { useBookArtwork } from '@/store/library';

const PlayerScreen = () => {
  const activeTrack = useActiveTrack();
  const { imageColors } = usePlayerBackground(
    activeTrack?.artwork ?? unknownBookImageUri
  );

  console.log('artist', activeTrack?.artist);
  console.log('title', activeTrack?.title);

  const bookArtwork = useBookArtwork(
    activeTrack?.artist ?? 'Unknown Author',
    activeTrack?.title ?? 'Unknown Title'
  );

  // console.log('bookArtwork', bookArtwork);

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
            <FastImage
              source={{
                uri: activeTrack?.artwork ?? unknownBookImageUri,
                priority: FastImage.priority.high,
              }}
              resizeMode={FastImage.resizeMode.contain}
              style={styles.artworkImage}
            />
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ marginTop: 70 }}>
              <View>
                {/* onPress load chapter list...not implemented */}
                <Pressable
                  // onPress={() => console.log('pressed')}
                  style={styles.chapterTitleContainer}
                >
                  <Feather
                    style={{ transform: 'rotate(180deg)' }}
                    name='list'
                    size={24}
                    color={colors.icon}
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
            </View>
          </View>
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
    <TouchableHighlight
      style={{
        position: 'absolute',
        top: top + 8,
        left: 16,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'flex-start',
      }}
    >
      <Ionicons
        name='chevron-down-outline'
        size={24}
        color={colors.icon}
        onPress={handlePress}
      />
    </TouchableHighlight>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    ...defaultStyles.container,
    paddingHorizontal: screenPadding.horizontal,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  // container: {
  // 	flex: 1,
  // 	backgroundColor: 'red',
  // },
  // contentContainer: {
  // 	flex: 1,
  // 	padding: 36,
  // 	alignItems: 'center',
  // },
  artworkImageContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    height: '55%',
  },
  artworkImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
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
});
