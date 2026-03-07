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
import { replaceBookArtwork } from '@/helpers/replaceBookArtwork';
import { PressableScale } from 'pressto';

const NUM_COLUMNS = 2;
const GRID_GAP = 10;

type SearchState = 'idle' | 'searching' | 'processing';

function keyExtractor(item: DuckDuckGoImageResult, index: number): string {
  return `${item.image}-${index}`;
}

const CoverArtSearch = () => {
  const { colors: themeColors } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  const { bookId, author, bookTitle } = useLocalSearchParams<{
    bookId: string;
    author: string;
    bookTitle: string;
  }>();

  const [query, setQuery] = useState(`${author} ${bookTitle} cover`);
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

  const handleSelectImage = useCallback(
    async (imageUrl: string) => {
      setState('processing');
      try {
        await replaceBookArtwork(bookId, imageUrl, bookTitle, author);
        router.back();
      } catch {
        setState('idle');
        Alert.alert(
          'Failed to update cover',
          'The image could not be downloaded or processed. Try a different image.',
        );
      }
    },
    [bookId, bookTitle, author],
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
    fontFamily: 'Rubik-SemiBold',
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
    fontFamily: 'Rubik-SemiBold',
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
    fontFamily: 'Rubik-SemiBold',
    fontSize: 16,
    marginTop: 16,
  },
});
