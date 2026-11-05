import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Note } from '../types/note';
import { filterNotes } from '../utils/notes';
import { NoteList } from '../components/NoteList';
import { ScreenHeader } from '../components/ScreenHeader';
import { SearchField } from '../components/SearchField';

type Props = {
  notes: Note[];
  isLoading: boolean;
  onEdit: (note: Note) => void;
  onTogglePinned: (note: Note) => void;
  onDelete: (note: Note) => void;
};

export function PinnedScreen({
  notes,
  isLoading,
  onEdit,
  onTogglePinned,
  onDelete,
}: Props) {
  const [search, setSearch] = useState('');
  const pinnedNotes = useMemo(
    () => filterNotes(notes, search, true),
    [notes, search],
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow="KEEP CLOSE"
        title="Pinned"
        subtitle="Your favorite thoughts, all together."
      />
      <SearchField value={search} onChange={setSearch} />
      <NoteList
        notes={pinnedNotes}
        isLoading={isLoading}
        emptyTitle={search ? 'No thoughts found' : 'Nothing pinned yet'}
        emptyCopy={search ? 'Try another search.' : 'Pin a note to keep it close.'}
        emptyIcon="☆"
        onEdit={onEdit}
        onTogglePinned={onTogglePinned}
        onDelete={onDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
  },
});
