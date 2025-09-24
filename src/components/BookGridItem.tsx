import { unknownBookImageUri } from '@/constants/images';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import TrackPlayer, {
  Track,
  useActiveTrack,
  useIsPlaying,
} from 'react-native-track-player';
import { Feather } from '@expo/vector-icons';
import LoaderKitView from 'react-native-loader-kit';
import { useRouter } from 'expo-router';

export type BookListItemProps = {
  book: Track;
  // onBookSelect: (book: Track) => void;
};

export const BookGridItem = ({
  book,
  // onBookSelect: handleBookSelect,
}: BookListItemProps) => {
  const isActiveBook = useActiveTrack()?.url === book.url;
  const { playing } = useIsPlaying();
  const router = useRouter();

  const handlePressPlay = async (track: Track) => {
    if (isActiveBook && playing) return;
    await TrackPlayer.load(track);
    await TrackPlayer.play();
  };

  const handlePress = () => {
    router.navigate('/titleDetails');
  };

  return (
    <TouchableHighlight onPress={handlePress}>
      <View style={[styles.bookItemContainer, { height: 200 }]}>
        <View style={{}}>
          <FastImage
            resizeMode='contain' //TODO: I want this here, but need to fix the absolute images below to reposition based on image size??
            //! JUST PLACE THE ABSOLUTE POSITIONING AT HE BOTTOM LEFT AND PLACE EVERY IMG AT THE BOTTOM LEFT AS WELL
            source={{
              uri: book.artwork ?? unknownBookImageUri,
              priority: FastImage.priority.normal,
            }}
            style={{
              ...styles.bookArtworkImage,
              opacity: isActiveBook ? 0.6 : 1,
            }}
          />
          {isActiveBook && playing ? (
            <LoaderKitView
              style={styles.trackPlayingImageIcon}
              name={'LineScaleParty'}
              color={colors.icon}
            />
          ) : (
            <Pressable hitSlop={35}>
              <Feather
                style={styles.trackPausedIcon}
                name='headphones'
                size={18}
                color={
                  isActiveBook && playing ? colors.primary : colors.icon
                }
                onPress={() => handlePressPlay(book)}
                // onPress={() => handleBookSelect(book)}
              />
            </Pressable>
          )}
        </View>
        <View style={styles.bookInfoContainer}>
          <View style={{ width: '100%' }}>
            <Text
              numberOfLines={1}
              style={{
                ...styles.bookTitleText,
                color: isActiveBook ? colors.primary : colors.text,
              }}
            >
              {book.title}
            </Text>

            {book.author && (
              <Text numberOfLines={1} style={styles.bookAuthorText}>
                {book.author}
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableHighlight>
  );
};

const styles = StyleSheet.create({
  bookItemContainer: {
    gap: 12,
    maxWidth: 155,
    // height: 200,
    // columnGap: 14,
    // alignItems: 'center',
    // justifyContent: 'center',
    // paddingLeft: 20,
    // marginBottom: 12,
  },
  bookArtworkImage: {
    //* height and width will need to be variable based on the cover img used
    height: 150,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 4,
  },
  bookInfoContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookTitleText: {
    ...defaultStyles.text,
    fontSize: fontSize.xs,
    fontWeight: '600',
    maxWidth: '90%',
  },
  bookAuthorText: {
    ...defaultStyles.text,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
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
