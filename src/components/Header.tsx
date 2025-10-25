import { colors } from '@/constants/tokens';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  // Grip,
  Library,
  List,
  Search,
  Settings2,
  // TextAlignJustify,
} from 'lucide-react-native';
import TabScreen from '@/components/TabScreen';

type headerProps = {
  setToggleView: React.Dispatch<React.SetStateAction<boolean>>;
  toggleView: boolean;
};

const Header = ({ toggleView, setToggleView }: headerProps) => {
  const handleToggleView = () => {
    setToggleView((prevState) => !prevState);
    // setToggleView(toggleView === 0 ? 1 : toggleView === 1 ? 2 : 0);
  };
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerGroup}>
          <Settings2
            size={20}
            color={colors.icon}
            strokeWidth={1.0}
            absoluteStrokeWidth
          />

          <Text style={{ color: colors.icon, fontSize: 20 }}>
            <Text style={{ color: '#FFB606' }}>S</Text>onicbooks
          </Text>
        </View>
        <View style={styles.headerGroup}>
          <Search
            size={24}
            color={colors.icon}
            strokeWidth={1.5}
            absoluteStrokeWidth
          />
          <Pressable hitSlop={10} style={{ padding: 4 }}>
            {toggleView ? (
              <List
                size={24}
                color={colors.icon}
                strokeWidth={1.5}
                absoluteStrokeWidth
                onPress={handleToggleView}
              />
            ) : (
              <Library
                style={{ transform: [{ rotateY: '180deg' }] }}
                size={24}
                color={colors.icon}
                strokeWidth={1.5}
                absoluteStrokeWidth
                onPress={handleToggleView}
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
    marginBottom: 10,
    gap: 16,
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
