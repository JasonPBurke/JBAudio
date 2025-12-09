import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { colors } from '@/constants/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const editTitleDetails = () => {
  const { top } = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <Text style={styles.header}>Edit Book Details</Text>
    </View>
  );
};

export default editTitleDetails;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.modalBackground,
    alignItems: 'center',
    paddingTop: 20,
    // justifyContent: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
});
