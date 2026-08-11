import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';

import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
import { screenPadding } from '@/constants/tokens';
import {
  searchImages,
  DuckDuckGoImageResult,
} from '@/helpers/duckDuckGoImageSearch';
import {
  replaceBookArtwork,
  replaceSeriesArtwork,
} from '@/helpers/replaceArtwork';
import { PressableScale } from 'pressto';

const NUM_COLUMNS = 2;
const GRID_GAP = 10;

type SearchState = 'idle' | 'searching' | 'processing';

function keyExtractor(item: DuckDuckGoImageResult, index: number): string {
  return `${item.image}-${index}`;
}

/**
 * The seed for the search field. A series says so in the query — `Mistborn
 * cover` returns book covers, `Mistborn series cover` returns the box sets and
 * collection art a pinned series cover actually wants. The author is dropped
 * rather than rendered blank when a series' books do not agree on one.
 */
function initialQuery(
  author: string | undefined,
  bookTitle: string | undefined,
  seriesName: string | undefined,
): string {
  const subject = seriesName ? `${seriesName} series` : bookTitle;
  return [author, subject, 'cover'].filter(Boolean).join(' ');
}

const CoverArtSearch = () => {
  const { colors: themeColors } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  /*
   * ONE SCREEN, TWO TARGETS — §D6: "the book artwork replacement helper
   * generalises to serve books and series", and this is the surface that
   * helper is reached through. `seriesId` present is a series pin; absent is a
   * book cover. Nothing else about the screen differs, which is the point:
   * this is the app's ONLY entry to cover-art search and a second copy of it
   * for series would be a second search UI to keep in step.
   */
  const { bookId, author, bookTitle, seriesId, seriesName } =
    useLocalSearchParams<{
      bookId?: string;
      author?: string;
      bookTitle?: string;
      seriesId?: string;
      seriesName?: string;
    }>();

  const [query, setQuery] = useState(() =>
    initialQuery(author, bookTitle, seriesName),
  );
  const [results, setResults] = useState<DuckDuckGoImageResult[]>([]);
  const [state, setState] = useState<SearchState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setState('searching');
    setError(null);
    setHasSearched(true);

    try {
      const images = await searchImages(trimmed);
      setResults(images);
    } catch {
      setError('Search failed. Check your connection and try again.');
      setResults([]);
    } finally {
      setState('idle');
    }
  }, [query]);

  useEffect(() => {
    handleSearch();
    return () => {
      FastImage.clearMemoryCache();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyImage = useCallback(
    async (imageUrl: string) => {
      setState('processing');
      try {
        if (seriesId) await replaceSeriesArtwork(seriesId, imageUrl);
        else await replaceBookArtwork(bookId ?? '', imageUrl, bookTitle ?? '', author ?? '');
        router.back();
      } catch {
        setState('idle');
        Alert.alert(
          'Failed to update cover',
          'The image could not be downloaded or processed. Try a different image.',
        );
      }
    },
    [seriesId, bookId, bookTitle, author],
  );

  /*
   * ⚠ K6 — THE CONFIRMATION COMES BEFORE APPLYING, NOT AS A NOTICE AFTERWARDS.
   *
   * Replacement unlinks the old file before the DB write, so the moment this
   * runs there is nothing to roll back to. §D6 keeps the immediate write and
   * pays for it with this dialog rather than by deferring the pin into the
   * editor's draft, which would be incoherent: the `Save` button would be
   * committing a column whose file was destroyed several taps ago, and
   * `Cancel` would leave the series pointing at nothing.
   *
   * SERIES ONLY, and that is a judgment call rather than a spec line. The book
   * path has shipped to testers without a confirmation and its cover control
   * has never read as part of the form — it lives outside the fields card and
   * navigates away to a full screen. The series control sits INSIDE the header
   * beside the name field, which is the most form-like position on its screen,
   * so the same act reads as deferred there and does not here. If the driver
   * wants parity it is one branch to delete.
   */
  const handleSelectImage = useCallback(
    (imageUrl: string) => {
      if (!seriesId) {
        void applyImage(imageUrl);
        return;
      }
      Alert.alert(
        'Use this cover?',
        'It is saved right away — the editor’s Cancel will not undo it.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Use cover', onPress: () => void applyImage(imageUrl) },
        ],
      );
    },
    [seriesId, applyImage],
  );

  const renderItem = useCallback(
    ({ item }: { item: DuckDuckGoImageResult }) => (
      <PressableScale
        style={styles.gridItem}
        onPress={() => handleSelectImage(item.image)}
      >
        <FastImage
          source={{
            uri: item.thumbnail,
            cache: FastImage.cacheControl.web,
          }}
          style={styles.thumbnail}
          resizeMode={FastImage.resizeMode.contain}
          transition={FastImage.transition.fade}
        />
      </PressableScale>
    ),
    [handleSelectImage],
  );

  const renderContent = () => {
    if (state === 'searching') {
      return (
        <View style={styles.centeredState}>
          <ActivityIndicator size='large' color={themeColors.primary} />
          <Text
            style={[styles.stateText, { color: themeColors.textMuted }]}
          >
            Searching...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centeredState}>
          <Text
            style={[styles.stateText, { color: themeColors.textMuted }]}
          >
            {error}
          </Text>
          <Pressable
            style={[
              styles.retryButton,
              { borderColor: themeColors.primary },
            ]}
            onPress={handleSearch}
          >
            <Text
              style={[styles.retryText, { color: themeColors.primary }]}
            >
              Retry
            </Text>
          </Pressable>
        </View>
      );
    }

    if (hasSearched && results.length === 0) {
      return (
        <View style={styles.centeredState}>
          <Text
            style={[styles.stateText, { color: themeColors.textMuted }]}
          >
            No images found. Try a different search.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={NUM_COLUMNS}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={[
          styles.gridContent,
          { paddingBottom: bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode='on-drag'
      />
    );
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: top + 8, backgroundColor: themeColors.background },
      ]}
    >
      <View style={styles.header}>
        <Text
          style={[styles.headerTitle, { color: themeColors.textMuted }]}
        >
          Search Cover Art
        </Text>
        <X
          size={30}
          color={themeColors.text}
          strokeWidth={1}
          onPress={() => router.back()}
        />
      </View>

      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: themeColors.modalBackground },
          ]}
        >
          <Search
            size={18}
            color={withOpacity(themeColors.textMuted, 0.6)}
            style={styles.searchIcon}
          />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: themeColors.text }]}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType='search'
            placeholderTextColor={withOpacity(themeColors.textMuted, 0.5)}
            placeholder='Search for cover art...'
            cursorColor={themeColors.primary}
            selectionColor={withOpacity(themeColors.primary, 0.56)}
            autoCorrect={false}
            editable={state !== 'processing'}
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              style={styles.clearButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X
                size={18}
                color={themeColors.textMuted}
                strokeWidth={1.5}
              />
            </Pressable>
          )}
        </View>
      </View>

      {renderContent()}

      {state === 'processing' && (
        <View
          style={[
            styles.processingOverlay,
            { backgroundColor: withOpacity(themeColors.background, 0.85) },
          ]}
        >
          <ActivityIndicator size='large' color={themeColors.primary} />
          <Text
            style={[styles.processingText, { color: themeColors.text }]}
          >
            Applying cover art...
          </Text>
        </View>
      )}
    </View>
  );
};

export default CoverArtSearch;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dragIndicatorContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: screenPadding.horizontal,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Rubik', fontWeight: '600',
    fontSize: 22,
  },
  searchRow: {
    paddingHorizontal: screenPadding.horizontal,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    height: 44,
  },
  searchIcon: {
    marginLeft: 12,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 15,
    fontFamily: 'Rubik',
    includeFontPadding: false,
  },
  clearButton: {
    padding: 10,
    marginRight: 2,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  stateText: {
    fontFamily: 'Rubik',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryText: {
    fontFamily: 'Rubik', fontWeight: '600',
    fontSize: 15,
  },
  columnWrapper: {
    gap: GRID_GAP,
    paddingHorizontal: screenPadding.horizontal,
  },
  gridContent: {
    gap: GRID_GAP,
    paddingTop: 4,
  },
  gridItem: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 1,
  },
  imageTitle: {
    fontFamily: 'Rubik',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    fontFamily: 'Rubik', fontWeight: '600',
    fontSize: 16,
    marginTop: 16,
  },
});
