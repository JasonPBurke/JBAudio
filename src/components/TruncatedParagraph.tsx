import { colors, fontSize } from '@/constants/tokens';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const TruncatedParagraph = ({
  content,
  maxLines = 4,
}: {
  content: string | undefined | null;
  maxLines?: number;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReadMoreButton, setShowReadMoreButton] = useState(false);

  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  const handleTextLayout = (event: any) => {
    if (event.nativeEvent.lines.length > maxLines && !isExpanded) {
      setShowReadMoreButton(true);
    } else {
      setShowReadMoreButton(false);
    }
  };

  return (
    <View>
      <Text
        numberOfLines={isExpanded ? 0 : maxLines}
        ellipsizeMode='tail'
        onTextLayout={handleTextLayout}
        style={styles.paragraph}
      >
        {content}
      </Text>
      {showReadMoreButton && (
        <TouchableOpacity onPress={toggleExpansion}>
          <Text style={styles.readMoreText}>
            {isExpanded ? 'Read less' : 'Read more'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  paragraph: {
    fontSize: 18,
    color: colors.text,
    lineHeight: 26,
    letterSpacing: 0.2,
  },
  readMoreText: {
    color: colors.textMuted,
    marginTop: 5,
    textAlign: 'right',
  },
});

export default TruncatedParagraph;
