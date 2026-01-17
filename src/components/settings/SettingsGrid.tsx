import { StyleSheet, View } from 'react-native';
import { ReactNode } from 'react';

type SettingsGridProps = {
  children: ReactNode;
};

/**
 * 2-column grid for related settings
 * Use for settings like bedtime start/end times
 */
const SettingsGrid = ({ children }: SettingsGridProps) => {
  return (
    <View style={styles.grid}>
      {children}
    </View>
  );
};

export default SettingsGrid;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
