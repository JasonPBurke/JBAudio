import { View, StyleSheet } from 'react-native';
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
} from 'lucide-react-native';
import { colors } from '@/constants/tokens';
import { scanLibrary } from '@/helpers/scanLibrary';
import { directoryPicker } from '@/helpers/directoryPicker';
import { getLibraryPaths } from '@/db/settingsQueries';

type Props = DrawerContentComponentProps;

const DrawerContent = (props: Props) => {
  const handleSettingsPress = () => {
    // props.navigation.closeDrawer(); //? could leave the drawer open
    props.navigation.navigate('settings');
  };

  const handleTestScreenPress = () => {
    props.navigation.navigate('testScreen');
  };

  return (
    <DrawerContentScrollView {...props} style={styles.drawerContainer}>
      <View style={styles.drawerHeader}>
        <X
          size={30}
          color={colors.text}
          strokeWidth={1}
          onPress={() => props.navigation.closeDrawer()}
        />
        <Sun size={30} color={colors.text} strokeWidth={1} />
      </View>
      {/* Custom drawer items */}
      <DrawerItem
        label={'Scan Library'}
        onPress={() => {
          scanLibrary();
          props.navigation.closeDrawer();
        }}
        icon={() => (
          <RefreshCcw size={24} color={colors.text} strokeWidth={1} />
        )}
        labelStyle={[styles.labelStyle, {}]}
        style={styles.drawerItem}
      />
      <DrawerItem
        label={'Library Folder'}
        onPress={async () => {
          console.log('in library folder');
          await directoryPicker();
          props.navigation.closeDrawer();
        }}
        icon={() => (
          <BookOpenText size={24} color={colors.text} strokeWidth={1} />
        )}
        labelStyle={[styles.labelStyle, {}]}
        style={styles.drawerItem}
      />
      <DrawerItem
        label={'FAQ'}
        onPress={() => {}}
        icon={() => (
          <FileQuestionMark size={24} color={colors.text} strokeWidth={1} />
        )}
        labelStyle={[styles.labelStyle, {}]}
        style={[styles.drawerItem, { opacity: 0.4 }]}
      />
      <DrawerItem
        label={'Book Stats'}
        onPress={() => {}}
        icon={() => (
          <ChartNoAxesCombined
            size={24}
            color={colors.text}
            strokeWidth={1}
          />
        )}
        labelStyle={[styles.labelStyle, {}]}
        style={[styles.drawerItem, { opacity: 0.4 }]}
      />
      <DrawerItem
        label={'Settings'}
        onPress={handleSettingsPress}
        icon={() => (
          <Settings size={24} color={colors.text} strokeWidth={1} />
        )}
        labelStyle={[styles.labelStyle, {}]}
        style={styles.drawerItem}
      />
      <DrawerItem
        label={'Test Screen'}
        onPress={handleTestScreenPress}
        icon={() => (
          <TestTube size={24} color={colors.text} strokeWidth={1} />
        )}
        labelStyle={[styles.labelStyle, {}]}
        style={styles.drawerItem}
      />
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  drawerContainer: {
    backgroundColor: colors.modalBackground,
  },
  drawerHeader: {
    padding: 10,
    marginBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    borderBottomColor: '#ccc',
  },
  labelStyle: {
    fontSize: 16,
    color: colors.text,
  },
});

export default DrawerContent;
