import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchField({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.glyph}>⌕</Text>
      <TextInput
        accessibilityLabel="Search notes"
        value={value}
        onChangeText={onChange}
        placeholder="Find a thought..."
        placeholderTextColor="#9A9B97"
        style={styles.input}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable accessibilityLabel="Clear search" onPress={() => onChange('')}>
          <Text style={styles.clear}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#ECEDE8',
    borderRadius: 16,
    flexDirection: 'row',
    height: 50,
    marginBottom: 24,
    paddingHorizontal: 15,
  },
  glyph: {
    color: '#777A73',
    fontSize: 26,
    lineHeight: 28,
    marginRight: 9,
  },
  input: {
    color: '#252721',
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  clear: {
    color: '#777A73',
    fontSize: 24,
    paddingLeft: 8,
  },
});
