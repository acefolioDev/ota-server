import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Note } from '../types/note';
import { formatUpdatedAt } from '../utils/notes';

type Props = {
  note: Note;
  onEdit: (note: Note) => void;
  onTogglePinned: (note: Note) => void;
  onDelete: (note: Note) => void;
};

export function NoteCard({ note, onEdit, onTogglePinned, onDelete }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit note: ${note.title}`}
      onPress={() => onEdit(note)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: note.color },
        pressed && styles.pressed,
      ]}>
      <View style={styles.topline}>
        <Text style={styles.date}>{formatUpdatedAt(note.updatedAt)}</Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={note.pinned ? 'Unpin note' : 'Pin note'}
            hitSlop={10}
            onPress={event => {
              event.stopPropagation();
              onTogglePinned(note);
            }}>
            <Text style={styles.pin}>{note.pinned ? '★' : '☆'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${note.title}`}
            hitSlop={10}
            onPress={event => {
              event.stopPropagation();
              onDelete(note);
            }}>
            <Text style={styles.delete}>···</Text>
          </Pressable>
        </View>
      </View>
      <Text numberOfLines={2} style={styles.title}>{note.title}</Text>
      {note.body ? <Text numberOfLines={4} style={styles.body}>{note.body}</Text> : null}
      <Text style={styles.hint}>Tap to edit</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    marginBottom: 13,
    minHeight: 150,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  pressed: {
    opacity: 0.76,
  },
  topline: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  date: {
    color: '#64655F',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  pin: {
    color: '#44463F',
    fontSize: 19,
  },
  delete: {
    color: '#64655F',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    color: '#252721',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  body: {
    color: '#50524B',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },
  hint: {
    color: '#797A73',
    fontSize: 10,
    marginTop: 12,
  },
});
