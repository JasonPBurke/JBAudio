import { View, StyleSheet, Pressable } from 'react-native';
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
import {
  X,
  Sun,
  Moon,
  Settings,
  GalleryHorizontalEnd,
  RefreshCcw,
  BookOpenText,
  ChartNoAxesCombined,
  FileQuestionMark,
  TestTube,
  PencilRuler,
  Timer,
  CassetteTape,
} from 'lucide-react-native';
import { colors } from '@/constants/tokens';
import { scanLibrary } from '@/helpers/scanLibrary';
import { directoryPicker } from '@/helpers/directoryPicker';
import { useThemeStore } from '@/store/themeStore';
import { useTheme } from '@/hooks/useTheme';

type Props = DrawerContentComponentProps;

const DrawerContent = (props: Props) => {
  const { colors: themeColors } = useTheme();
  const mode = useThemeStore((state) => state.mode);
  const activeScheme = useThemeStore((state) => state.activeColorScheme);
  const setMode = useThemeStore((state) => state.setMode);

  const handleThemeToggle = () => {
    if (mode === 'system') {
      setMode('light');
    } else if (mode === 'light') {
      setMode('dark');
    } else {
      setMode('system');
    }
  };

  const handleSettingsPress = () => {
    // props.navigation.closeDrawer(); //? could leave the drawer open
    props.navigation.navigate('settings');
  };

  const handleTestScreenPress = () => {
    props.navigation.navigate('testScreen');
  };

  return (
    <DrawerContentScrollView
      {...props}
      style={[
        styles.drawerContainer,
        { backgroundColor: themeColors.modalBackground },
      ]}
    >
      <View style={styles.drawerHeader}>
        <X
          size={30}
          color={themeColors.text}
          strokeWidth={1}
          onPress={() => props.navigation.closeDrawer()}
        />
        <Pressable
          onPress={handleThemeToggle}
          style={styles.themeToggleContainer}
        >
          {activeScheme === 'dark' ? (
            <Sun size={30} color={themeColors.text} strokeWidth={1} />
          ) : (
            <Moon size={30} color={themeColors.text} strokeWidth={1} />
          )}
          {/* Badge indicator: shows only when in system mode */}
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
      {/* Custom drawer items */}
      <DrawerItem
        label={'Rescan Library'}
        onPress={() => {
          scanLibrary();
          props.navigation.closeDrawer();
        }}
        icon={() => (
          <RefreshCcw size={24} color={themeColors.text} strokeWidth={1} />
        )}
        labelStyle={[styles.labelStyle, { color: themeColors.text }]}
        style={[
          styles.drawerItem,
          { borderBottomColor: themeColors.divider },
        ]}
      />
      <DrawerItem
        label={'Manage Library'}
        onPress={async () => {
          props.navigation.closeDrawer();
          await directoryPicker();
        }}
        icon={() => (
          <BookOpenText
            size={24}
            color={themeColors.text}
            strokeWidth={1}
          />
        )}
        labelStyle={[styles.labelStyle, { color: themeColors.text }]}
        style={[
          styles.drawerItem,
          { borderBottomColor: themeColors.divider },
        ]}
      />
      <DrawerItem
        label={'FAQ'}
        onPress={() => {}}
        icon={() => (
          <FileQuestionMark
            size={24}
            color={themeColors.text}
            strokeWidth={1}
          />
        )}
        labelStyle={[styles.labelStyle, { color: themeColors.text }]}
        style={[
          styles.drawerItem,
          { borderBottomColor: themeColors.divider, opacity: 0.4 },
        ]}
      />
      <DrawerItem
        label={'Book Stats'}
        onPress={() => {}}
        icon={() => (
          <ChartNoAxesCombined
            size={24}
            color={themeColors.text}
            strokeWidth={1}
          />
        )}
        labelStyle={[styles.labelStyle, { color: themeColors.text }]}
        style={[
          styles.drawerItem,
          { borderBottomColor: themeColors.divider, opacity: 0.4 },
        ]}
      />
      <DrawerItem
        label={'Settings'}
        onPress={handleSettingsPress}
        icon={() => (
          <Settings size={24} color={themeColors.text} strokeWidth={1} />
        )}
        labelStyle={[styles.labelStyle, { color: themeColors.text }]}
        style={[
          styles.drawerItem,
          { borderBottomColor: themeColors.divider },
        ]}
      />
      <DrawerItem
        label={'General'}
        onPress={handleSettingsPress}
        icon={() => (
          <PencilRuler size={24} color={themeColors.text} strokeWidth={1} />
        )}
        labelStyle={[styles.labelStyle, { color: themeColors.text }]}
        style={[
          styles.drawerItem,
          { borderBottomColor: themeColors.divider },
        ]}
      />
      <DrawerItem
        label={'Timer'}
        onPress={handleSettingsPress}
        icon={() => (
          <Timer size={24} color={themeColors.text} strokeWidth={1} />
        )}
        labelStyle={[styles.labelStyle, { color: themeColors.text }]}
        style={[
          styles.drawerItem,
          { borderBottomColor: themeColors.divider },
        ]}
      />
      <DrawerItem
        label={'Player'}
        onPress={handleSettingsPress}
        icon={() => (
          <CassetteTape
            size={24}
            color={themeColors.text}
            strokeWidth={1}
          />
        )}
        labelStyle={[styles.labelStyle, { color: themeColors.text }]}
        style={[
          styles.drawerItem,
          { borderBottomColor: themeColors.divider },
        ]}
      />
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  drawerContainer: {
    // backgroundColor moved to inline for theme support
  },
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
  drawerHeaderText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  drawerItem: {
    paddingStart: 4,
    gap: 20,
    marginHorizontal: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    // borderBottomColor moved to inline for theme support
  },
  labelStyle: {
    fontSize: 16,
    // color moved to inline for theme support
  },
});

export default DrawerContent;
