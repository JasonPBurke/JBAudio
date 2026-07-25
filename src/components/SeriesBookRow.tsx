import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { Check, Minus } from 'lucide-react-native';

import { unknownBookImageUri } from '@/constants/images';
import { fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { withOpacity } from '@/helpers/colorUtils';
import { useTheme } from '@/hooks/useTheme';
import { useBookDisplayData } from '@/store/library';

export type SeriesBookRowProps = {
  /** Provide a bookId to resolve display data from the store... */
  bookId?: string;
  /** ...or pass explicit display fields (used when resolving by structural key). */
  title?: string;
  author?: string | null;
  artwork?: string | null;
  context: 'selection' | 'sortable';
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  /** In sortable context, the caller supplies a <Sortable.Handle> grip node. */
  dragHandle?: React.ReactNode;
};

/**
 * Presentational book row shared by the series selection step (bubble/outline)
 * and the sort/edit steps (drag handle + remove). Styled after BookListItem but
 * with NO playback hooks/state, so it is safe inside recycled/sortable cells.
 */
export const SeriesBookRow = memo(function SeriesBookRow({
  bookId,
  title,
  author,
  artwork,
  context,
  selected = false,
  onPress,
  onRemove,
  dragHandle,
}: SeriesBookRowProps) {
  const { colors: themeColors } = useTheme();
  const displayData = useBookDisplayData(bookId ?? '');

  const bookTitle = title ?? displayData?.bookTitle;
  const bookAuthor = author ?? displayData?.author;
  const bookArtwork = artwork ?? displayData?.artwork;

  const inner = (
    <View
      style={[
        styles.row,
        context === 'selection' && {
          borderColor: selected ? themeColors.primary : 'transparent',
        },
      ]}
    >
      <View style={styles.artwork}>
        <FastImage
          source={{
            uri: bookArtwork ?? unknownBookImageUri,
            priority: FastImage.priority.low,
            cache: FastImage.cacheControl.immutable,
          }}
          style={{ width: 60, height: 80 }}
          resizeMode={FastImage.resizeMode.contain}
        />
      </View>

      <View style={styles.info}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: themeColors.text }]}
        >
          {bookTitle}
        </Text>
        {!!bookAuthor && (
          <Text
            numberOfLines={1}
            style={[styles.author, { color: themeColors.textMuted }]}
          >
            {bookAuthor}
          </Text>
        )}
      </View>

      {context === 'selection' ? (
        <View
          style={[
            styles.bubble,
            {
              borderColor: selected ? themeColors.primary : themeColors.icon,
              backgroundColor: selected
                ? themeColors.primary
                : 'transparent',
            },
          ]}
        >
          {selected && <Check size={16} color={themeColors.background} />}
        </View>
      ) : (
        <View style={styles.sortableActions}>
          {onRemove && (
            <Pressable onPress={onRemove} hitSlop={10} style={styles.remove}>
              <Minus size={20} color={themeColors.textMuted} />
            </Pressable>
          )}
          {dragHandle}
        </View>
      )}
    </View>
  );

  if (context === 'selection') {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
      >
        {inner}
      </Pressable>
    );
  }
  return inner;
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    columnGap: 14,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderWidth: 2,
    borderRadius: 8,
  },
  artwork: {
    height: 80,
    aspectRatio: 0.75,
  },
  info: {
    flex: 1,
  },
  title: {
    ...defaultStyles.text,
    fontSize: fontSize.sm,
    fontFamily: 'Rubik',
    fontWeight: '600',
  },
  author: {
    fontFamily: 'Rubik',
    fontSize: 14,
    marginTop: 4,
  },
  bubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  sortableActions: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    paddingRight: 4,
  },
  remove: {
    padding: 4,
  },
});
