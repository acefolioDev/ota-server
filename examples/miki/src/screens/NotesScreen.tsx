import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Note } from '../types/note';
import { filterNotes } from '../utils/notes';
import { NoteList } from '../components/NoteList';
import { ScreenHeader } from '../components/ScreenHeader';
import { SearchField } from '../components/SearchField';

type Props = {
  notes: Note[];
  isLoading: boolean;
  storageError: string | null;
  onCreate: () => void;
  onEdit: (note: Note) => void;
  onTogglePinned: (note: Note) => void;
  onDelete: (note: Note) => void;
};

export function NotesScreen({
  notes,
  isLoading,
  storageError,
  onCreate,
  onEdit,
  onTogglePinned,
  onDelete,
}: Props) {
  const [search, setSearch] = useState('');
  const visibleNotes = useMemo(() => filterNotes(notes, search), [notes, search]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow="YOUR QUIET CORNER"
        title="Miki"
        subtitle="A simple note-taking app for your thoughts"
      />
      {storageError ? (
        <View accessibilityRole="alert" style={styles.errorBanner}>
          <Text style={styles.errorText}>{storageError}</Text>
        </View>
      ) : null}
      <SearchField value={search} onChange={setSearch} />
      <View style={styles.listHeading}>
        <View>
          <Text style={styles.sectionTitle}>Your notes</Text>
          <Text style={styles.noteCount}>
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </Text>
        </View>
      </View>
      <NoteList
        notes={visibleNotes}
        isLoading={isLoading}
        emptyTitle={search ? 'No thoughts found' : 'A fresh page'}
        emptyCopy={search ? 'Try another search.' : 'Tap New note and write your first thought.'}
        emptyIcon={search ? '⌕' : '✳'}
        onEdit={onEdit}
        onTogglePinned={onTogglePinned}
        onDelete={onDelete}
      />
      <Pressable
        accessibilityRole="button"
        onPress={onCreate}
        style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
        <Text style={styles.addIcon}>＋</Text>
        <Text style={styles.addText}>New note</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
  },
  errorBanner: {
    backgroundColor: '#FCE4E0',
    borderRadius: 12,
    marginBottom: 14,
    padding: 12,
  },
  errorText: {
    color: '#8E352A',
    fontSize: 13,
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#242620',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  noteCount: {
    color: '#85877F',
    fontSize: 12,
    marginTop: 3,
  },
  addButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#252721',
    borderRadius: 18,
    bottom: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 23,
    position: 'absolute',
  },
  pressed: {
    opacity: 0.76,
  },
  addIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    marginRight: 8,
  },
  addText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
