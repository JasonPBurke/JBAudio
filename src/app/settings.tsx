import { StyleSheet, Text, View } from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { colors, screenPadding } from '@/constants/tokens';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { getNumColumns, updateNumColumns } from '@/db/settingsQueries';

const SettingsScreen = ({ navigation }: any) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchNumColumns = async () => {
        try {
          const value = await getNumColumns();
          if (isActive && value) {
            setSelectedIndex(value - 1); // -1 because segmented control is 0-indexed
          }
        } catch (error) {
          console.error('Failed to fetch number of columns:', error);
        }
      };

      fetchNumColumns();

      return () => {
        isActive = false;
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerStyle}>Settings</Text>
      <View>
        <Text style={styles.sectionHeaderStyle}>General</Text>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 30,
            alignItems: 'center',
            // borderColor: 'red',
            // borderWidth: 1,
          }}
        >
          <Text style={styles.content}>Number of Columns:</Text>
          <SegmentedControl
            style={{ flex: 1, height: 40 }}
            activeFontStyle={{ color: colors.primary }}
            // tintColor='#ffb406d1'
            values={['One', 'Two', 'Three']}
            selectedIndex={selectedIndex}
            onChange={(event) => {
              const numberOfColumns =
                event.nativeEvent.selectedSegmentIndex + 1;
              setSelectedIndex(event.nativeEvent.selectedSegmentIndex);
              //! save to db
              updateNumColumns(numberOfColumns);
            }}
          />
        </View>
      </View>
      <View>
        <Text style={styles.sectionHeaderStyle}>Sleep Timer</Text>
        <View>
          <Text style={styles.content}>Fadeout Duration</Text>
        </View>
      </View>
      <View>
        <Text style={styles.sectionHeaderStyle}>UI</Text>
      </View>
    </View>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    flex: 1,
    gap: 20,
    backgroundColor: '#252525',
    paddingHorizontal: screenPadding.horizontal,
  },
  headerStyle: {
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 50,
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.text,
  },
  sectionHeaderStyle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  content: {
    fontSize: 16,
    color: colors.textMuted,
    marginVertical: 10,
  },
});
