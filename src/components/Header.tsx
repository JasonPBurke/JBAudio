import { colors } from '@/constants/tokens';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Grip,
  Library,
  List,
  Search,
  Settings2,
} from 'lucide-react-native';
import TabScreen from '@/components/TabScreen';
import { useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';

type headerProps = {
  setToggleView: React.Dispatch<React.SetStateAction<number>>;
  toggleView: number;
};

const Header = ({ toggleView, setToggleView }: headerProps) => {
  const navigation = useNavigation();

  const openSettingsDrawer = () => {
    // This will be updated to open the drawer
    navigation.dispatch(DrawerActions.toggleDrawer());
  };
  const handleToggleView = () => {
    setToggleView((prevState) => (prevState + 1) % 3);
  };
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerGroup}>
          <Pressable hitSlop={15} onPress={openSettingsDrawer}>
            <Settings2
              size={20}
              color={colors.icon}
              strokeWidth={1.0}
              absoluteStrokeWidth
            />
          </Pressable>

          <Text style={{ color: colors.icon, fontSize: 20 }}>
            <Text style={{ color: '#FFB606' }}>S</Text>onicbooks
          </Text>
        </View>
        <View style={styles.headerGroup}>
          <Pressable hitSlop={15} onPress={handleToggleView}>
            {toggleView === 0 && (
              <Library
                style={{ transform: [{ rotateY: '180deg' }] }}
                size={24}
                color={colors.icon}
                strokeWidth={1.5}
                absoluteStrokeWidth
              />
            )}
            {toggleView === 1 && (
              <List
                size={24}
                color={colors.icon}
                strokeWidth={1.5}
                absoluteStrokeWidth
              />
            )}
            {toggleView === 2 && (
              <Grip
                size={24}
                color={colors.icon}
                strokeWidth={1.5}
                absoluteStrokeWidth
              />
            )}
          </Pressable>
        </View>
      </View>
      <TabScreen />
    </View>
  );
};

export default Header;

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    gap: 16,
    backgroundColor: colors.background,
    elevation: 5,
    // borderBlockEndColor: colors.primary,
    // borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  headerGroup: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookStatusLinkText: {
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.textMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
});
