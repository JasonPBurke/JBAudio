import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  TouchableOpacity,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import FastImage from '@d11/react-native-fast-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useBookById, refreshLibraryStore } from '@/store/library';
import { unknownBookImageUri } from '@/constants/images';
import { useEffect, useState } from 'react';
import { BookEditableFields } from '@/types/Book';
import { updateBookDetails } from '@/db/bookQueries';
import { ImagePlus } from 'lucide-react-native';
import { computeDetailsArtworkSize } from '@/helpers/artworkSizing';

/** Keeps this cover 5dp shorter than titleDetails' so the two screens align. */
const COVER_ALIGNMENT_OFFSET = 5;

const EditTitleDetails = () => {
  const { colors: themeColors } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { bookId } = useLocalSearchParams<{
    bookId: string;
  }>();
  const book = useBookById(bookId);

  const [formState, setFormState] = useState<BookEditableFields>({
    bookTitle: '',
    author: '',
    narrator: '',
    genre: '',
    year: '',
    description: '',
    copyright: '',
  });

  useEffect(() => {
    return () => {
      FastImage.clearMemoryCache();
    };
  }, []);

  useEffect(() => {
    if (book) {
      setFormState({
        bookTitle: book.bookTitle,
        author: book.author,
        narrator: book.metadata.narrator ?? '',
        genre: book.metadata.genre ?? '',
        year: book.metadata.year ?? '',
        description: book.metadata.description ?? '',
        copyright: book.metadata.copyright ?? '',
      });
    }
  }, [book]);

  const handleInputChange = (
    field: keyof BookEditableFields,
    value: string,
  ) => {
    setFormState((prevState) => ({ ...prevState, [field]: value }));
  };

  const handleCoverArtPress = () => {
    router.push({
      pathname: '/coverArtSearch',
      params: {
        bookId,
        author: book?.author ?? '',
        bookTitle: book?.bookTitle ?? '',
      },
    });
  };

  const handleSave = async () => {
    await updateBookDetails(bookId, formState);
    await refreshLibraryStore();
    router.back();
  };

  if (!book) {
    return (
      <View style={styles.container}>
        <Text
          style={[styles.header, { color: themeColors.textMuted }]}
        ></Text>
      </View>
    );
  }

  const aspectRatio =
    book.artworkHeight && book.artworkWidth
      ? book.artworkWidth / book.artworkHeight
      : 0;

  // Tracks titleDetails' cover, which scales with the window rather than a
  // hardcoded dp — otherwise this stays phone-sized on a tablet. The wrapper
  // is sized to the artwork itself rather than the full screen width: with a
  // full-width box, `resizeMode: contain` letterboxes the cover and leaves the
  // overlay icon stranded out in the gutter, since absolute positioning
  // resolves against the container, not the rendered pixels.
  const cover = computeDetailsArtworkSize({
    aspectRatio,
    windowWidth,
    windowHeight,
    horizontalPadding: 0, // this ScrollView has no horizontal padding
  });

  // Shrinking width by the same proportion keeps the aspect ratio exact, which
  // is what lets the overlay sit flush in the real corner.
  const imageHeight = cover.height - COVER_ALIGNMENT_OFFSET;
  const imageWidth = cover.width - COVER_ALIGNMENT_OFFSET * aspectRatio;

  return (
    // Android keyboard avoidance is handled natively by adjustPan
    // (softwareKeyboardLayoutMode: 'pan'); enabling KAV there too
    // double-shifts the focused field above the keyboard.
    <KeyboardAvoidingView
      behavior='padding'
      enabled={Platform.OS === 'ios'}
      style={{ flex: 1 }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={[
          styles.container,
          {
            flex: 1,
            paddingTop: top,
            paddingBottom: bottom + 50,
          },
        ]}
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: bottom + 24,
        }}
      >
        <Animated.Text
          entering={FadeInUp.duration(400).delay(100)}
          style={[styles.header, { color: themeColors.textMuted }]}
        >
          {/* Edit {book?.bookTitle} Details */}
          Edit Book Details
        </Animated.Text>
        <Pressable
          onPress={handleCoverArtPress}
          style={[
            styles.imageWrapper,
            { width: imageWidth, height: imageHeight },
          ]}
        >
          <FastImage
            source={{
              uri: book.artwork ?? unknownBookImageUri,
              priority: FastImage.priority.high,
              cache: FastImage.cacheControl.immutable,
            }}
            style={styles.image}
            resizeMode={FastImage.resizeMode.contain}
          />
          <View
            style={[
              styles.imageOverlayIcon,
              {
                backgroundColor: withOpacity(themeColors.background, 0.7),
              },
            ]}
          >
            <ImagePlus
              size={18}
              color={themeColors.textMuted}
              strokeWidth={1.5}
            />
          </View>
        </Pressable>
        <Animated.View
          entering={FadeInDown.duration(600).delay(400)}
          style={[
            styles.card,
            { backgroundColor: themeColors.modalBackgroundWithOpacity },
          ]}
        >
          <Text
            style={[styles.fieldTitle, { color: themeColors.textMuted }]}
          >
            Title
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: themeColors.background,
                color: themeColors.textMuted,
              },
            ]}
            value={formState.bookTitle}
            onChangeText={(text) => handleInputChange('bookTitle', text)}
            cursorColor={themeColors.primary}
            selectionColor={themeColors.primary}
          ></TextInput>
          <Text
            style={[styles.fieldTitle, { color: themeColors.textMuted }]}
          >
            Author
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: themeColors.background,
                color: themeColors.textMuted,
              },
            ]}
            value={formState.author}
            onChangeText={(text) => handleInputChange('author', text)}
            cursorColor={themeColors.primary}
            selectionColor={themeColors.primary}
          ></TextInput>
          <Text
            style={[styles.fieldTitle, { color: themeColors.textMuted }]}
          >
            Narrator
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: themeColors.background,
                color: themeColors.textMuted,
              },
            ]}
            placeholder={'Narrator'}
            placeholderTextColor={withOpacity(themeColors.textMuted, 0.5)}
            value={formState.narrator ?? ''}
            onChangeText={(text) => handleInputChange('narrator', text)}
            cursorColor={themeColors.primary}
            selectionColor={themeColors.primary}
          ></TextInput>
          <Text
            style={[styles.fieldTitle, { color: themeColors.textMuted }]}
          >
            Genre Tags
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: themeColors.background,
                color: themeColors.textMuted,
              },
            ]}
            placeholder={'Genre Tags (, / or & separated)'}
            placeholderTextColor={withOpacity(themeColors.textMuted, 0.5)}
            value={formState.genre ?? ''}
            onChangeText={(text) => handleInputChange('genre', text)}
            cursorColor={themeColors.primary}
            selectionColor={themeColors.primary}
          ></TextInput>
          <Text
            style={[styles.fieldTitle, { color: themeColors.textMuted }]}
          >
            Release Year
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: themeColors.background,
                color: themeColors.textMuted,
              },
            ]}
            placeholder={'Release Year'}
            placeholderTextColor={withOpacity(themeColors.textMuted, 0.5)}
            value={formState.year ?? ''}
            onChangeText={(text) => handleInputChange('year', text)}
            cursorColor={themeColors.primary}
            selectionColor={themeColors.primary}
            keyboardType='numeric'
          ></TextInput>
          <Text
            style={[styles.fieldTitle, { color: themeColors.textMuted }]}
          >
            Description
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: themeColors.background,
                color: themeColors.textMuted,
              },
            ]}
            placeholder={'Description'}
            placeholderTextColor={withOpacity(themeColors.textMuted, 0.5)}
            value={formState.description ?? ''}
            onChangeText={(text) => handleInputChange('description', text)}
            cursorColor={themeColors.primary}
            selectionColor={themeColors.primary}
            multiline
            textAlignVertical='top'
          ></TextInput>
          <Text
            style={[styles.fieldTitle, { color: themeColors.textMuted }]}
          >
            Copyright
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: themeColors.background,
                color: themeColors.textMuted,
              },
            ]}
            placeholder={'Copyright'}
            placeholderTextColor={withOpacity(themeColors.textMuted, 0.5)}
            value={formState.copyright ?? ''}
            onChangeText={(text) => handleInputChange('copyright', text)}
            cursorColor={themeColors.primary}
            selectionColor={themeColors.primary}
          ></TextInput>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: withOpacity(themeColors.textMuted, 0.3),
                },
              ]}
              onPress={() => router.back()}
            >
              <Text
                style={[styles.buttonText, { color: themeColors.text }]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.saveButton,
                {
                  backgroundColor: themeColors.background,
                  borderColor: themeColors.primary,
                },
              ]}
              onPress={handleSave}
            >
              <Text
                style={[styles.buttonText, { color: themeColors.text }]}
              >
                Save
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default EditTitleDetails;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 25,
  },
  header: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: 24,
    paddingBottom: 5,
  },
  imageWrapper: {
    // width/height are supplied per-render and match the artwork exactly, so
    // imageOverlayIcon's bottom/right land inside the cover's real corner.
    position: 'relative',
  },
  image: {
    // Fills the wrapper, which is already the artwork's aspect ratio — so
    // `contain` never letterboxes. Kept as a guard against bad metadata.
    width: '100%',
    height: '100%',
  },
  imageOverlayIcon: {
    position: 'absolute',
    // Equal insets so the badge sits evenly in the artwork's corner. Only
    // meaningful because imageWrapper is sized to the artwork — see above.
    bottom: 7,
    right: 7,
    borderRadius: 20,
    padding: 8,
  },
  card: {
    width: '100%',
    height: 'auto',
    padding: 20,
    paddingBottom: 40,
    marginTop: 20,
  },
  fieldTitle: {
    marginStart: 4,
    fontFamily: 'Rubik',
    fontSize: 16,
  },
  searchInput: {
    width: '100%',
    borderRadius: 8,
    padding: 12,
    paddingTop: 16,
    marginVertical: 10,

    fontFamily: 'Rubik',
    fontSize: 18,
    lineHeight: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    borderWidth: 1,
  },
  buttonText: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: 16,
  },
});
