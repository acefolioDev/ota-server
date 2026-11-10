import React from 'react';
import { StyleSheet, View } from 'react-native';

const ART = { x: 3.42, y: 8.01, width: 162.58, height: 157.99 };

type Props = {
  size?: number;
};

export function MikiMark({ size = 56 }: Props) {
  const scale = size / ART.height;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Miki"
      style={{ width: ART.width * scale, height: size }}>
      <View
        style={[
          styles.sheet,
          {
            left: (14 - ART.x) * scale,
            top: (18 - ART.y) * scale,
            width: 124 * scale,
            height: 132 * scale,
            borderRadius: 32 * scale,
            backgroundColor: '#FCE8D5',
            transform: [{ rotate: '-8deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.sheet,
          {
            left: (46 - ART.x) * scale,
            top: (40 - ART.y) * scale,
            width: 118 * scale,
            height: 124 * scale,
            borderRadius: 32 * scale,
            backgroundColor: '#242620',
          },
        ]}
      />
      <View
        style={[
          styles.sheet,
          {
            left: (117 - ART.x) * scale,
            top: (115 - ART.y) * scale,
            width: 30 * scale,
            height: 30 * scale,
            borderRadius: 15 * scale,
            backgroundColor: '#E48A64',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
  },
});
