import {
  Text,
  View,
  StyleSheet,
  // useWindowDimensions,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FastImage from '@d11/react-native-fast-image';
import { unknownBookImageUri } from '@/constants/images';
import { colors, fontSize } from '@/constants/tokens';
import { Feather } from '@expo/vector-icons';
import { defaultStyles } from '@/styles';
import { usePlayerBackground } from '@/hooks/usePlayerBackground';
import { LinearGradient } from 'expo-linear-gradient';
import {
  testImage1,
  testImage2,
} from '/home/jason/Development/JBAudio/assets/images/testImage';

const TitleDetails = () => {
  const router = useRouter();
  // const { width, height } = useWindowDimensions();
  const { author, bookTitle } = useLocalSearchParams<{
    author: string;
    bookTitle: string;
  }>();

  const testImage = Math.random() > 0.5 ? testImage1 : testImage2;

  const { imageColors } = usePlayerBackground(
    testImage || unknownBookImageUri
  );

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
      locations={[0.15, 0.2, 0.65, 0.8]}
      style={{ flex: 1 }}
      colors={
        imageColors
          ? [
              imageColors.vibrant,
              imageColors.lightVibrant,
              imageColors.darkMuted,
              imageColors.darkVibrant,
            ]
          : [
              colors.primary,
              colors.primary,
              colors.background,
              colors.background,
            ]
      }
    >
      <View style={styles.bookInfoContainer}>
        <View style={styles.bookArtworkContainer}>
          <FastImage
            resizeMode={FastImage.resizeMode.contain}
            source={{
              uri: testImage || unknownBookImageUri,
              priority: FastImage.priority.normal,
            }}
            style={styles.bookArtworkImage}
          />
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Feather name='arrow-left-circle' size={32} />
          </Pressable>
        </View>

        <View>
          <Text style={styles.bookTitleText}>{bookTitle}</Text>
          <Text style={styles.bookAuthorText}>{author}</Text>
        </View>
      </View>
    </LinearGradient>
  );
};

export default TitleDetails;

const styles = StyleSheet.create({
  bookInfoContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginVertical: 50,
    width: '100%',
    gap: 24,
    // backgroundColor: '#1c1c1c',
  },
  bookArtworkContainer: {
    width: '100%',
    height: '60%',
  },
  bookArtworkImage: {
    height: '100%',
    width: 'auto',
    borderRadius: 4,
  },
  bookTitleText: {
    ...defaultStyles.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  bookAuthorText: {
    ...defaultStyles.text,
    fontSize: fontSize.sm,
  },
  backButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    color: colors.icon,
  },
  trackPlayingImageIcon: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    width: 20,
    height: 20,
  },
  trackPausedIcon: {
    position: 'absolute',
    bottom: 10,
    left: 10,
  },
});
