import { View, StyleSheet, Text } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Pressable } from 'react-native-gesture-handler';
import {
  X,
  Sun,
  Moon,
  RefreshCcw,
  BookOpenText,
  ChartNoAxesCombined,
  FileQuestionMark,
  PencilRuler,
  Timer,
  CassetteTape,
  Crown,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors } from '@/constants/tokens';
import { scanLibrary } from '@/helpers/scanLibrary';
import { useThemeStore } from '@/store/themeStore';
import { useTheme } from '@/hooks/useTheme';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = DrawerContentComponentProps;

type DrawerRowProps = {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  iconColor: string;
  labelColor: string;
  dividerColor: string;
  disabled?: boolean;
};

const SPACING = 12;

const DrawerRow = ({
  label,
  icon: Icon,
  onPress,
  iconColor,
  labelColor,
  dividerColor,
  disabled,
}: DrawerRowProps) => (
  <Pressable onPress={onPress}>
    <View style={[styles.drawerItem, { opacity: disabled ? 0.4 : 1 }]}>
      <Icon size={24} color={iconColor} strokeWidth={1} />
      <View style={styles.labelWrapper}>
        <Text
          numberOfLines={1}
          style={[styles.labelText, { color: labelColor }]}
        >
          {label}
        </Text>
      </View>
    </View>
    <View style={[styles.divider, { backgroundColor: dividerColor }]} />
  </Pressable>
);

const DrawerContent = (props: Props) => {
  const { colors: themeColors } = useTheme();
  const mode = useThemeStore((state) => state.mode);
  const activeScheme = useThemeStore((state) => state.activeColorScheme);
  const setMode = useThemeStore((state) => state.setMode);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleThemeToggle = () => {
    if (mode === 'system') {
      setMode('light');
    } else if (mode === 'light') {
      setMode('dark');
    } else {
      setMode('system');
    }
  };

  const iconColor = themeColors.text;
  const labelColor = themeColors.text;
  const dividerColor = themeColors.divider;

  return (
    <View
      style={{
        backgroundColor: themeColors.modalBackground,
        flex: 1,
        paddingTop: SPACING + insets.top,
        paddingBottom: SPACING + insets.bottom,
        paddingStart: SPACING + insets.left,
        paddingEnd: SPACING,
      }}
    >
      <View style={styles.drawerHeader}>
        <Pressable onPress={() => props.navigation.closeDrawer()}>
          <X size={30} color={themeColors.text} strokeWidth={1} />
        </Pressable>
        <Pressable
          onPress={handleThemeToggle}
          style={styles.themeToggleContainer}
        >
          {activeScheme === 'dark' ? (
            <Sun size={30} color={themeColors.text} strokeWidth={1} />
          ) : (
            <Moon size={30} color={themeColors.text} strokeWidth={1} />
          )}
          {mode === 'system' && (
            <View
              style={[
                styles.modeBadge,
                {
                  backgroundColor: themeColors.primary,
                },
              ]}
            />
          )}
        </Pressable>
      </View>
      <DrawerRow
        label='Rescan Library'
        icon={RefreshCcw}
        onPress={() => {
          scanLibrary();
          props.navigation.closeDrawer();
        }}
        iconColor={iconColor}
        labelColor={labelColor}
        dividerColor={dividerColor}
      />
      <DrawerRow
        label='Manage Library'
        icon={BookOpenText}
        onPress={() => router.navigate('/library')}
        iconColor={iconColor}
        labelColor={labelColor}
        dividerColor={dividerColor}
      />
      <DrawerRow
        label='Book Stats'
        icon={ChartNoAxesCombined}
        onPress={() => router.navigate('/bookStats')}
        iconColor={iconColor}
        labelColor={labelColor}
        dividerColor={dividerColor}
        disabled
      />
      <DrawerRow
        label='Help'
        icon={FileQuestionMark}
        onPress={() => router.navigate('/help')}
        iconColor={iconColor}
        labelColor={labelColor}
        dividerColor={dividerColor}
      />
      <DrawerRow
        label='Appearance'
        icon={PencilRuler}
        onPress={() => router.navigate('/general')}
        iconColor={iconColor}
        labelColor={labelColor}
        dividerColor={dividerColor}
      />
      <DrawerRow
        label='Timer'
        icon={Timer}
        onPress={() => router.navigate('/timer')}
        iconColor={iconColor}
        labelColor={labelColor}
        dividerColor={dividerColor}
      />
      <DrawerRow
        label='Player Options'
        icon={CassetteTape}
        onPress={() => router.navigate('/playerOptions')}
        iconColor={iconColor}
        labelColor={labelColor}
        dividerColor={dividerColor}
      />
      <DrawerRow
        label='Get Pro'
        icon={Crown}
        onPress={() => router.navigate('/subscription')}
        iconColor={iconColor}
        labelColor={labelColor}
        dividerColor={dividerColor}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  drawerHeader: {
    padding: 10,
    marginBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  themeToggleContainer: {
    position: 'relative',
  },
  modeBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.modalBackground,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    paddingVertical: 11,
    paddingStart: 16,
    paddingEnd: 24,
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  labelWrapper: {
    marginStart: 12,
    marginEnd: 12,
    marginVertical: 4,
    flex: 1,
  },
  labelText: {
    fontFamily: 'Rubik-Medium',
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'center',
  },
});

export default DrawerContent;
