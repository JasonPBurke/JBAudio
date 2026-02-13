import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { PressableScale } from 'pressto';
import { useActiveTrack } from 'react-native-track-player';
import TrackPlayer from 'react-native-track-player';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleX } from 'lucide-react-native';
import { useBookById } from '@/store/library';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
import { formatSecondsToMinutes } from '@/helpers/miscellaneous';
import { FlashList } from '@shopify/flash-list';
import {
  getFootprints,
  formatRelativeTime,
  TRIGGER_LABELS,
} from '@/db/footprintQueries';
import { useRequiresPro } from '@/hooks/useRequiresPro';
import ProFeaturePopup from '@/modals/ProFeaturePopup';

type FootprintItem = {
  id: string;
  chapterIndex: number;
  positionMs: number;
  triggerType: 'play' | 'seek' | 'chapter_change' | 'timer_activation';
  createdAt: number;
};

const FootprintListScreen = () => {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  const { isProUser } = useRequiresPro();
  const [showProPopup, setShowProPopup] = useState(false);

  const activeTrack = useActiveTrack();
  const book = useBookById(activeTrack?.bookId ?? '');

  const [footprints, setFootprints] = useState<FootprintItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load footprints when screen mounts
  useEffect(() => {
    const loadFootprints = async () => {
      if (!activeTrack?.bookId) {
        setLoading(false);
        return;
      }

      try {
        const fps = await getFootprints(activeTrack.bookId);
        setFootprints(
          fps.map((fp) => ({
            id: fp.id,
            chapterIndex: fp.chapterIndex,
            positionMs: fp.positionMs,
            triggerType: fp.triggerType,
            createdAt: fp.createdAt,
          })),
        );
      } catch (error) {
        console.error('Failed to load footprints:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFootprints();
  }, [activeTrack?.bookId]);

  const handleFootprintSelect = useCallback(
    async (footprint: FootprintItem) => {
      if (!isProUser) {
        setShowProPopup(true);
        return;
      }

      if (!book?.chapters) return;

      const targetChapter = book.chapters[footprint.chapterIndex];
      if (!targetChapter) return;

      const isSingleFileBook =
        book.chapters.length > 1 &&
        book.chapters.every((c) => c.url === book.chapters[0].url);

      if (isSingleFileBook) {
        // Seek to chapter start + footprint position
        const seekTime =
          ((targetChapter.startMs || 0) + footprint.positionMs) / 1000;
        await TrackPlayer.seekTo(seekTime);
      } else {
        // Skip to chapter, then seek within it
        await TrackPlayer.skip(footprint.chapterIndex);
        await TrackPlayer.seekTo(footprint.positionMs / 1000);
      }

      await TrackPlayer.play();
      router.back();
    },
    [book, router, isProUser],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: FootprintItem; index: number }) => {
      const isFirstItem = index === 0;
      const isLastItem = index === footprints.length - 1;

      const borderStyle = {
        borderBottomLeftRadius: isLastItem ? 14 : 0,
        borderBottomRightRadius: isLastItem ? 14 : 0,
        borderTopLeftRadius: isFirstItem ? 14 : 0,
        borderTopRightRadius: isFirstItem ? 14 : 0,
      };

      const chapterTitle =
        book?.chapters?.[item.chapterIndex]?.chapterTitle ??
        `Chapter ${item.chapterIndex + 1}`;
      const positionFormatted = formatSecondsToMinutes(
        item.positionMs / 1000,
      );
      const triggerLabel = TRIGGER_LABELS[item.triggerType];
      const relativeTime = formatRelativeTime(item.createdAt);

      return (
        <PressableScale
          onPress={() => handleFootprintSelect(item)}
          style={{
            ...styles.footprintItem,
            backgroundColor: themeColors.chapterInactive,
            ...borderStyle,
          }}
        >
          <View style={styles.footprintContent}>
            <Text
              style={[styles.chapterTitle, { color: themeColors.text }]}
              numberOfLines={1}
            >
              {chapterTitle}
            </Text>
            <Text
              style={[
                styles.positionText,
                { color: themeColors.textMuted },
              ]}
            >
              @ {positionFormatted}
            </Text>
          </View>
          <View style={styles.footprintMeta}>
            <Text
              style={[styles.triggerText, { color: themeColors.primary }]}
            >
              {triggerLabel}
            </Text>
            <Text
              style={[styles.timeText, { color: themeColors.textMuted }]}
            >
              {relativeTime}
            </Text>
          </View>
        </PressableScale>
      );
    },
    [book?.chapters, footprints.length, handleFootprintSelect, themeColors],
  );

  const keyExtractor = useCallback((item: FootprintItem) => item.id, []);

  const ItemSeparator = useCallback(
    () => <View style={styles.separator} />,
    [],
  );

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: withOpacity(themeColors.background, 0.92) },
        ]}
      >
        <ActivityIndicator color={themeColors.icon} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottom,
          backgroundColor: withOpacity(themeColors.background, 0.95),
        },
      ]}
    >
      <Text style={[styles.headerText, { color: themeColors.text }]}>
        Where Was I...
      </Text>

      {footprints.length > 0 ? (
        <FlashList
          data={footprints}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={ItemSeparator}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text
            style={[styles.emptyText, { color: themeColors.textMuted }]}
          >
            No footprints recorded yet.
          </Text>
          <Text
            style={[styles.emptySubtext, { color: themeColors.textMuted }]}
          >
            Footprints are saved when you play, seek, change chapters, or
            activate the sleep timer.
          </Text>
        </View>
      )}

      <Pressable
        onPress={handleClose}
        hitSlop={10}
        style={styles.handleIndicator}
      >
        <CircleX color={themeColors.icon} size={42} strokeWidth={1} />
      </Pressable>

      <ProFeaturePopup
        isVisible={showProPopup}
        onClose={() => setShowProPopup(false)}
      />
    </View>
  );
};

export default FootprintListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 4,
    paddingTop: 36,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 18,
    fontFamily: 'Rubik-SemiBold',
    textAlign: 'center',
    marginBottom: 16,
  },
  handleIndicator: {
    marginTop: 24,
    marginBottom: 12,
    alignSelf: 'center',
  },
  list: {
    flex: 1,
    borderRadius: 7,
  },
  listContent: {
    paddingBottom: 12,
  },
  footprintItem: {
    paddingVertical: 12,
    paddingHorizontal: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footprintContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chapterTitle: {
    fontSize: 15,
    fontFamily: 'Rubik-Medium',
    maxWidth: '60%',
  },
  positionText: {
    fontFamily: 'Rubik',
    fontSize: 14,
  },
  footprintMeta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  triggerText: {
    fontSize: 12,
    fontFamily: 'Rubik-Medium',
  },
  timeText: {
    fontFamily: 'Rubik',
    fontSize: 11,
  },
  separator: {
    height: 3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontFamily: 'Rubik',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontFamily: 'Rubik',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
