import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { Note } from '../types/note';
import { NoteCard } from './NoteCard';

type Props = {
  notes: Note[];
  isLoading: boolean;
  emptyTitle: string;
  emptyCopy: string;
  emptyIcon?: string;
  onEdit: (note: Note) => void;
  onTogglePinned: (note: Note) => void;
  onDelete: (note: Note) => void;
};

export function NoteList({
  notes,
  isLoading,
  emptyTitle,
  emptyCopy,
  emptyIcon = '✳',
  onEdit,
  onTogglePinned,
  onDelete,
}: Props) {
  if (isLoading) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Getting your notes…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={notes}
      keyExtractor={note => note.id}
      contentContainerStyle={[styles.list, notes.length === 0 && styles.emptyList]}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.icon}>{emptyIcon}</Text>
          <Text style={styles.title}>{emptyTitle}</Text>
          <Text style={styles.copy}>{emptyCopy}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <NoteCard
          note={item}
          onEdit={onEdit}
          onTogglePinned={onTogglePinned}
          onDelete={onDelete}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: 18,
  },
  emptyList: {
    flexGrow: 1,
  },
  empty: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  icon: {
    color: '#E48A64',
    fontSize: 42,
    marginBottom: 8,
  },
  title: {
    color: '#292B25',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  copy: {
    color: '#81837C',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
    textAlign: 'center',
  },
});
