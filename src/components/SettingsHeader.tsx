import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

type SettingsHeaderProps = {
  title: string;
};

const SettingsHeader = ({ title }: SettingsHeaderProps) => {
  const { colors: themeColors } = useTheme();
  const router = useRouter();

  return (
    <View>
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
    </View>
  );
};

export default SettingsHeader;

const styles = StyleSheet.create({
  backButton: {
    paddingLeft: 13,
    paddingTop: 13,
  },
  headerStyle: {
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 50,
    fontSize: 36,
    fontFamily: 'Rubik-SemiBold',
  },
});
