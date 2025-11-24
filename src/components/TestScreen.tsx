import React, { useState } from 'react';
import { Button, Text, View, StyleSheet, ScrollView } from 'react-native';
import { pick } from '@react-native-documents/picker';

// Import the helper function
import { analyzeFileWithMediaInfo } from '../helpers/mediainfo';

export default function MediaInfoTester() {
  const [mediaInfo, setMediaInfo] = useState('');
  const [error, setError] = useState('');

  const handleGetMediaInfo = async () => {
    try {
      const fileUri = '/storage/emulated/0/Audiobooks/testing/Lamora.m4b';

      console.log(`Requesting media info in TestScreen for: ${fileUri}`);
      setMediaInfo('');
      setError('');

      // Use the helper function to get and process media info
      const mediaInfoResult = await analyzeFileWithMediaInfo(fileUri);

      // Pretty-print the JSON for display
      const formattedResult = JSON.stringify(mediaInfoResult, null, 2);

      console.log('Media Info Received:', formattedResult);
      setMediaInfo(formattedResult);
    } catch (e: any) {
      console.error('Error getting media info:', e);
      setError(e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Button
        title='Get Media Info for hardcoded path'
        onPress={handleGetMediaInfo}
      />
      <ScrollView style={styles.scrollView}>
        {mediaInfo ? (
          <Text selectable style={styles.text}>
            {mediaInfo}
          </Text>
        ) : null}
        {error ? (
          <Text selectable style={styles.errorText}>
            Error: {error}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#252525',
  },
  scrollView: {
    marginTop: 16,
    width: '100%',
  },
  text: {
    fontFamily: 'monospace',
    textAlign: 'left',
    color: '#fff',
  },
  errorText: {
    color: 'red',
  },
});
