import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ArtworkColors } from '@/helpers/gradientColorSorter';

const COLOR_TYPE_ORDER: (keyof ArtworkColors)[] = [
  'vibrant',
  'darkVibrant',
  'lightVibrant',
  'muted',
  'darkMuted',
  'lightMuted',
  'dominantAndroid',
];

interface AccentColorSwatchesProps {
  artworkColors: ArtworkColors;
  selectedColorType: string;
  onSelectColorType: (colorType: string) => void;
}

const AccentColorSwatches = ({
  artworkColors,
  selectedColorType,
  onSelectColorType,
}: AccentColorSwatchesProps) => {
  const { colors: themeColors } = useTheme();

  // Filter to only non-null colors, preserving order
  const availableColors = COLOR_TYPE_ORDER.filter(
    (key) => artworkColors[key] != null,
  );

  if (availableColors.length === 0) return null;

  return (
    <View style={[styles.container, { borderRadius: 8 }]}>
      {availableColors.map((colorType, index) => {
        const isFirst = index === 0;
        const isLast = index === availableColors.length - 1;
        const isSelected = colorType === selectedColorType;

        return (
          <Pressable
            key={colorType}
            onPress={() => onSelectColorType(colorType)}
            style={[
              styles.swatch,
              { backgroundColor: artworkColors[colorType]! },
              isFirst && styles.firstSwatch,
              isLast && styles.lastSwatch,
              isSelected && {
                borderWidth: 3,
                borderColor: themeColors.text,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

export default AccentColorSwatches;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  swatch: {
    width: 44,
    height: 44,
  },
  firstSwatch: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  lastSwatch: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
});
