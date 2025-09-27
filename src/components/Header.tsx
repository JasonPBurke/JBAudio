import { colors } from '@/constants/tokens';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  FontAwesome6,
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';

type headerProps = {
  setToggleView: React.Dispatch<React.SetStateAction<boolean>>;
  toggleView: boolean;
};

const Header = ({ toggleView, setToggleView }: headerProps) => {
  const handleToggleView = () => {
    setToggleView((prevState) => !prevState);
  };
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerGroup}>
          {/* 'bars' as alt for 'grip-lines' */}
          <FontAwesome6 name='bars' size={20} color={colors.icon} />
          <Text style={{ color: colors.icon, fontSize: 20 }}>
            SonicBooks
          </Text>
        </View>
        <View style={styles.headerGroup}>
          <Ionicons name='search-sharp' size={24} color={colors.icon} />
          <Pressable hitSlop={10} style={{ padding: 4 }}>
            <MaterialCommunityIcons
              name='dots-grid'
              size={24}
              color={colors.icon}
              onPress={handleToggleView}
            />
          </Pressable>
        </View>
      </View>
      <View
        style={[styles.header, { justifyContent: 'space-between', gap: 8 }]}
      >
        <TouchableOpacity>
          <Text style={styles.bookStatusLinkText}>All(1)</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={styles.bookStatusLinkText}>Unread(1)</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={styles.bookStatusLinkText}>In Progress(1)</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={styles.bookStatusLinkText}>Finished(1)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Header;

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    marginBottom: 12,
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
    gap: 16,
    alignItems: 'center',
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
