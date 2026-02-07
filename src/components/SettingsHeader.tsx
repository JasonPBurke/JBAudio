import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';

type SettingsHeaderProps = {
  title: string;
};

const FADE_HEIGHT = 20;

const SettingsHeader = ({ title }: SettingsHeaderProps) => {
  const { colors: themeColors } = useTheme();
  const router = useRouter();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: themeColors.modalBackground },
      ]}
    >
      <Pressable
        hitSlop={10}
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <ArrowLeft size={24} color={themeColors.textMuted} />
      </Pressable>
      <Text style={[styles.headerStyle, { color: themeColors.text }]}>
        {title}
      </Text>
      <LinearGradient
        colors={[
          themeColors.modalBackground,
          withOpacity(themeColors.modalBackground, 0),
        ]}
        style={styles.fadeGradient}
        pointerEvents='none'
      />
    </View>
  );
};

export default SettingsHeader;

const styles = StyleSheet.create({
  container: {
    zIndex: 1,
    overflow: 'visible',
  },
  backButton: {
    paddingLeft: 13,
    paddingTop: 13,
  },
  headerStyle: {
    alignSelf: 'center',
    marginBottom: 20,
    fontSize: 36,
    fontFamily: 'Rubik-SemiBold',
  },
  fadeGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -FADE_HEIGHT,
    height: FADE_HEIGHT,
  },
});
