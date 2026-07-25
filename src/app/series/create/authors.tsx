import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';

import { useTheme } from '@/hooks/useTheme';
import { useLibraryStore } from '@/store/library';
import { useSeriesDraftStore } from '@/store/seriesDraftStore';
import { fontSize, screenPadding } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';

export default function SeriesCreateAuthors() {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const authors = useLibraryStore((state) => state.authors);
  const selected = useSeriesDraftStore((s) => s.selectedAuthorNames);
  const toggleAuthor = useSeriesDraftStore((s) => s.toggleAuthor);
  const resetForCreate = useSeriesDraftStore((s) => s.resetForCreate);

  const canProceed = selected.length > 0;

  const handleExit = useCallback(() => {
    resetForCreate();
    router.back();
  }, [resetForCreate, router]);

  const renderItem = useCallback(
    ({ item }: { item: { name: string } }) => {
      const isSelected = selected.includes(item.name);
      return (
        <Pressable
          style={[
            styles.authorRow,
            {
              borderColor: isSelected
                ? themeColors.primary
                : themeColors.divider,
            },
          ]}
          android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
          onPress={() => toggleAuthor(item.name)}
        >
          <Text
            numberOfLines={1}
            style={[styles.authorName, { color: themeColors.text }]}
          >
            {item.name}
          </Text>
          <View
            style={[
              styles.bubble,
              {
                borderColor: isSelected
                  ? themeColors.primary
                  : themeColors.icon,
                backgroundColor: isSelected
                  ? themeColors.primary
                  : 'transparent',
              },
            ]}
          >
            {isSelected && <Check size={16} color={themeColors.background} />}
          </View>
        </Pressable>
      );
    },
    [selected, themeColors, toggleAuthor],
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themeColors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>
          New Series
        </Text>
        <Text style={[styles.instruction, { color: themeColors.textMuted }]}>
          Select the author(s) whose books make up this series.
        </Text>
      </View>

      <FlatList
        data={authors}
        keyExtractor={(a) => a.name}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <View style={[styles.footer, { borderTopColor: themeColors.divider }]}>
        <Pressable onPress={handleExit} style={styles.footerButton} hitSlop={8}>
          <Text style={[styles.exitText, { color: themeColors.textMuted }]}>
            Exit
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.navigate('/series/create/books' as any)}
          disabled={!canProceed}
          style={[
            styles.nextButton,
            {
              backgroundColor: canProceed
                ? themeColors.primary
                : themeColors.divider,
            },
          ]}
        >
          <Text
            style={[
              styles.nextText,
              { color: canProceed ? themeColors.background : themeColors.textMuted },
            ]}
          >
            Next
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 6,
  },
  title: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.lg,
  },
  instruction: {
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
  },
  listContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: 8,
    gap: 8,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderRadius: 8,
  },
  authorName: {
    fontFamily: 'Rubik',
    fontSize: fontSize.base,
    flex: 1,
    marginRight: 12,
  },
  bubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: { paddingVertical: 12, paddingHorizontal: 8 },
  exitText: {
    fontFamily: 'Rubik',
    fontSize: fontSize.base,
  },
  nextButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  nextText: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.base,
  },
});
