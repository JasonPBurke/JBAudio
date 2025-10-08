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
// import FastImage from '@d11/react-native-fast-image';
import { Image } from 'expo-image';
import { unknownBookImageUri } from '@/constants/images';
import { MovingText } from '@/components/MovingText';
import { PlayerControls } from '@/components/PlayerControls';
import { PlayerProgressBar } from '@/components/PlayerProgressBar';
import { usePlayerBackground } from '@/hooks/usePlayerBackground';
import { LinearGradient } from 'expo-linear-gradient';

const PlayerScreen = () => {
  const activeTrack = useActiveTrack();
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
          {/* <View style={styles.bookArtworkContainer}>
            <Image
              contentFit='contain'
              source={{
                uri: activeTrack?.artwork ?? unknownBookImageUri,
                // priority: FastImage.priority.normal,
              }}
              // resizeMode={FastImage.resizeMode.contain}
              style={styles.bookArtworkImage}
            />
          </View> */}

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
    <Pressable
      hitSlop={10}
      style={{ ...styles.backButton, top: top + 8 }}
      onPress={handlePress}
    />
    // <TouchableHighlight
    //   style={{
    //     position: 'absolute',
    //     top: top + 8,
    //     left: 16,
    //     right: 0,
    //     flexDirection: 'row',
    //     justifyContent: 'flex-start',
    //   }}
    // >
    /* <Ionicons
        name='chevron-down-outline'
        size={24}
        color={colors.icon}
        onPress={handlePress}
      /> */
    // </TouchableHighlight>
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

  // bookArtworkContainer: {
  //   width: '90%',
  //   height: '60%',
  //   // paddingTop: 5,
  //   flex: 1,
  //   alignSelf: 'center',
  //   marginBottom: 32,
  //   // borderColor: 'red',
  //   // borderWidth: 1,
  // },
  // bookArtworkImage: {
  //   height: '100%',
  //   width: 'auto',
  //   borderRadius: 12,
  // },
});
