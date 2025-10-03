import { unknownBookImageUri } from '@/constants/images';
import {
  Pressable,
  StyleSheet,
  Text,
  Touchable,
  TouchableHighlight,
  View,
  ViewToken,
} from 'react-native';
import { memo } from 'react';
import FastImage from '@d11/react-native-fast-image';
import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import TrackPlayer, {
  Track,
  useActiveTrack,
  useIsPlaying,
} from 'react-native-track-player';
import { Book } from '@/types/Book';
import { Entypo, Feather } from '@expo/vector-icons';
import LoaderKitView from 'react-native-loader-kit';
import { useRouter } from 'expo-router';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

export type BookListItemProps = {
  book: Book;
  viewableItems: SharedValue<ViewToken[]>;
  // onBookSelect: (book: Track) => void;
};

export const BookListItem = memo(function BookListItem({
  book,
  viewableItems,
  // onBookSelect: handleBookSelect,
}: BookListItemProps) {
  // const isActiveBook = useActiveTrack()?.url === book.url;
  // const { playing } = useIsPlaying();
  const router = useRouter();

  const handlePressPlay = async (book: Book) => {
    // if (isActiveBook && playing) return;
    // await TrackPlayer.load(track);
    // await TrackPlayer.play();
  };

  const author = book.chapters[0].author; //? add author to the book object
  const bookTitle = book.bookTitle;
  // const artwork = book.artwork;

  const handlePress = () => {
    router.navigate(
      `/titleDetails?author=${author}&bookTitle=${bookTitle}`
    );
  };

  //! for animated list
  // const rStyle = useAnimatedStyle(() => {
  //   const isVisible = Boolean(
  //     viewableItems.value
  //       .filter((item) => item.isViewable)
  //       .find(
  //         (viewableItem) =>
  //           viewableItem.item.chapters[0].url === book.chapters[0].url
  //       )
  //   );

  //   console.log('isVisible', isVisible);

  //   return {
  //     opacity: withTiming(isVisible ? 1 : 0),
  //     transform: [{ scale: withTiming(isVisible ? 1 : 0.8) }],
  //   };
  // }, []);

  // console.log(
  //   'viewableItems',
  //   JSON.stringify(viewableItems.value[0]?.isViewable, null, 2)
  // );

  return (
    // <TouchableHighlight onPress={() => handleBookSelect(book)}>

    <TouchableHighlight onPress={handlePress}>
      <View style={styles.bookItemContainer}>
        <View>
          <FastImage
            // resizeMode='contain'
            resizeMode={FastImage.resizeMode.contain}
            source={{
              uri: book.artwork ?? unknownBookImageUri,
              priority: FastImage.priority.normal,
            }}
            style={{
              ...styles.bookArtworkImage,
              // opacity: isActiveBook ? 0.6 : 1,
            }}
          />
        </View>
        <View style={styles.bookInfoContainer}>
          <View style={{ width: '100%' }}>
            <Text
              numberOfLines={1}
              style={{
                ...styles.bookTitleText,
                // color: isActiveBook ? colors.primary : colors.text,
              }}
            >
              {book.bookTitle}
            </Text>

            {book.chapters[0].author && (
              <Text numberOfLines={1} style={styles.bookAuthorText}>
                {book.chapters[0].author}
              </Text>
            )}
          </View>
          <View style={{ gap: 18 }}>
            <Entypo
              name='dots-three-vertical'
              size={18}
              color={colors.icon}
            />
            {/* {isActiveBook && playing ? (
                <LoaderKitView
                  style={styles.trackPlayingImageIcon}
                  name={'LineScaleParty'}
                  color={colors.icon}
                />
              ) : ( */}
            <Pressable hitSlop={35}>
              <Feather
                name='headphones'
                size={18}
                color={
                  // isActiveBook && playing ? colors.primary : colors.icon
                  colors.icon
                }
                onPress={() => handlePressPlay(book)}
                // onPress={() => handleBookSelect(book)}
              />
            </Pressable>
            {/* )} */}
          </View>
        </View>
      </View>
    </TouchableHighlight>
  );
});

const styles = StyleSheet.create({
  bookItemContainer: {
    flexDirection: 'row',
    columnGap: 14,
    alignItems: 'center',
    paddingRight: 20,
    // marginBottom: 12,
  },
  bookArtworkImage: {
    borderRadius: 4,
    //* height and width will need to be variable based on the cover img used Flex should work here
    height: 80,
    aspectRatio: 0.75,
  },
  bookInfoContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookTitleText: {
    ...defaultStyles.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
    maxWidth: '90%',
  },
  bookAuthorText: {
    ...defaultStyles.text,
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  // trackPlayingImageIcon: {
  // 	position: 'absolute',
  // 	left: 20,
  // 	top: 30,
  // 	width: 20,
  // 	height: 20,
  // },
  trackPlayingImageIcon: {
    width: 20,
    height: 20,
  },
});
