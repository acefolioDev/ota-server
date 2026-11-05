import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type Note = {
  id: string;
  title: string;
  body: string;
  color: string;
  pinned: boolean;
  updatedAt: number;
};

const STORAGE_KEY = '@miki/notes/v1';
const COLORS = ['#FCE8D5', '#E6E9FF', '#DDF3E4', '#F8DFE6', '#F8F0CB'];

function isNote(value: unknown): value is Note {
  if (typeof value !== 'object' || value === null) return false;
  const note = value as Record<string, unknown>;
  return (
    typeof note.id === 'string' &&
    typeof note.title === 'string' &&
    typeof note.body === 'string' &&
    typeof note.color === 'string' &&
    typeof note.pinned === 'boolean' &&
    typeof note.updatedAt === 'number'
  );
}

function parseNotes(value: string | null): Note[] {
  if (value === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error('Your saved notes could not be read. The local data is invalid.', {
      cause: error,
    });
  }
  if (!Array.isArray(parsed) || !parsed.every(isNote)) {
    throw new Error('Your saved notes have an unsupported format.');
  }
  return parsed;
}

function formatUpdatedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const notesRef = useRef<Note[]>([]);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showPinned, setShowPinned] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(value => {
        const loadedNotes = parseNotes(value);
        if (active) {
          notesRef.current = loadedNotes;
          setNotes(loadedNotes);
          setStorageError(null);
        }
      })
      .catch(error => {
        if (active) {
          setStorageError(
            error instanceof Error ? error.message : 'Could not load your notes.',
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notes
      .filter(note => !showPinned || note.pinned)
      .filter(
        note =>
          !query ||
          note.title.toLowerCase().includes(query) ||
          note.body.toLowerCase().includes(query),
      )
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  }, [notes, search, showPinned]);

  function commitNotes(nextNotes: Note[]) {
    notesRef.current = nextNotes;
    setNotes(nextNotes);

    const write = writeQueue.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextNotes)));
    writeQueue.current = write;
    write
      .then(() => setStorageError(null))
      .catch(error => {
        setStorageError(
          error instanceof Error ? error.message : 'Could not save your notes.',
        );
      });
  }

  function openEditor(note?: Note) {
    setEditingNote(note ?? null);
    setDraftTitle(note?.title ?? '');
    setDraftBody(note?.body ?? '');
    setEditorVisible(true);
  }

  function saveDraft() {
    const title = draftTitle.trim();
    const body = draftBody.trim();
    if (!title && !body) {
      Alert.alert('Empty note', 'Add a title or a few words before saving.');
      return;
    }

    const timestamp = Date.now();
    const nextNote: Note = editingNote
      ? { ...editingNote, title: title || 'Untitled note', body, updatedAt: timestamp }
      : {
          id: `${timestamp.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          title: title || 'Untitled note',
          body,
          color: COLORS[notesRef.current.length % COLORS.length] ?? COLORS[0]!,
          pinned: false,
          updatedAt: timestamp,
        };
    const nextNotes = editingNote
      ? notesRef.current.map(note => (note.id === editingNote.id ? nextNote : note))
      : [nextNote, ...notesRef.current];

    commitNotes(nextNotes);
    setEditorVisible(false);
  }

  function togglePinned(note: Note) {
    commitNotes(
      notesRef.current.map(item =>
        item.id === note.id ? { ...item, pinned: !item.pinned } : item,
      ),
    );
  }

  function confirmDelete(note: Note) {
    Alert.alert('Delete note?', `“${note.title}” will be removed from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => commitNotes(notesRef.current.filter(item => item.id !== note.id)),
      },
    ]);
  }

  async function checkForUpdate() {
    if (!Updates.isEnabled) {
      Alert.alert(
        'Updates unavailable',
        'Install a release build with the Miki OTA configuration to check for updates.',
      );
      return;
    }

    setIsCheckingUpdates(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      if (!update.isAvailable) {
        Alert.alert('You’re up to date', 'There are no new Miki updates right now.');
        return;
      }

      const result = await Updates.fetchUpdateAsync();
      if (result.isNew) {
        await Updates.reloadAsync();
      } else {
        Alert.alert('Update unavailable', 'The update could not be downloaded.');
      }
    } catch (error) {
      Alert.alert(
        'Update check failed',
        error instanceof Error ? error.message : 'Could not check for an update.',
      );
    } finally {
      setIsCheckingUpdates(false);
    }
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.screen}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>YOUR QUIET CORNER</Text>
              <Text style={styles.heading}>Miki<Text style={styles.headingDot}>.</Text></Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={checkForUpdate}
              disabled={isCheckingUpdates}
              style={({ pressed }) => [styles.updateButton, pressed && styles.pressed]}>
              <Text style={styles.updateButtonText}>
                {isCheckingUpdates ? 'Checking…' : '↻  Check updates'}
              </Text>
            </Pressable>
          </View>

          {/* <Text style={styles.subheading}>Little thoughts, kept close.</Text> */}
          <Text style={styles.subheading}>OTA test: update received.</Text>

          {storageError ? (
            <View accessibilityRole="alert" style={styles.errorBanner}>
              <Text style={styles.errorText}>{storageError}</Text>
            </View>
          ) : null}

          <View style={styles.searchBox}>
            <Text style={styles.searchGlyph}>⌕</Text>
            <TextInput
              accessibilityLabel="Search notes"
              value={search}
              onChangeText={setSearch}
              placeholder="Find a thought..."
              placeholderTextColor="#9A9B97"
              style={styles.searchInput}
              returnKeyType="search"
            />
            {search.length > 0 ? (
              <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')}>
                <Text style={styles.clearSearch}>×</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.listHeading}>
            <View>
              <Text style={styles.sectionTitle}>{showPinned ? 'Pinned' : 'Your notes'}</Text>
              <Text style={styles.noteCount}>
                {notes.length} {notes.length === 1 ? 'note' : 'notes'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: showPinned }}
              onPress={() => setShowPinned(value => !value)}
              style={[styles.filterButton, showPinned && styles.filterButtonActive]}>
              <Text style={[styles.filterText, showPinned && styles.filterTextActive]}>
                {showPinned ? '★  Pinned' : '☆  Pinned'}
              </Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Getting your notes…</Text>
            </View>
          ) : (
            <FlatList
              data={visibleNotes}
              keyExtractor={item => item.id}
              contentContainerStyle={[
                styles.listContent,
                visibleNotes.length === 0 && styles.emptyListContent,
              ]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>{search ? '⌕' : '✳'}</Text>
                  <Text style={styles.emptyTitle}>
                    {search
                      ? 'No thoughts found'
                      : showPinned
                        ? 'Nothing pinned yet'
                        : 'A fresh page'}
                  </Text>
                  <Text style={styles.emptyCopy}>
                    {search
                      ? 'Try another search.'
                      : showPinned
                        ? 'Pin a note to keep it close.'
                        : 'Tap the button below and write your first note.'}
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit note: ${item.title}`}
                  onPress={() => openEditor(item)}
                  style={({ pressed }) => [
                    styles.noteCard,
                    { backgroundColor: item.color },
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.noteTopline}>
                    <Text style={styles.noteDate}>{formatUpdatedAt(item.updatedAt)}</Text>
                    <View style={styles.noteActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={item.pinned ? 'Unpin note' : 'Pin note'}
                        hitSlop={10}
                        onPress={event => {
                          event.stopPropagation();
                          togglePinned(item);
                        }}>
                        <Text style={styles.pinIcon}>{item.pinned ? '★' : '☆'}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${item.title}`}
                        hitSlop={10}
                        onPress={event => {
                          event.stopPropagation();
                          confirmDelete(item);
                        }}>
                        <Text style={styles.deleteIcon}>···</Text>
                      </Pressable>
                    </View>
                  </View>
                  <Text numberOfLines={2} style={styles.noteTitle}>{item.title}</Text>
                  {item.body ? (
                    <Text numberOfLines={4} style={styles.noteBody}>{item.body}</Text>
                  ) : null}
                  <Text style={styles.editHint}>Tap to edit</Text>
                </Pressable>
              )}
            />
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => openEditor()}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Text style={styles.addButtonIcon}>＋</Text>
            <Text style={styles.addButtonText}>New note</Text>
          </Pressable>
        </View>

        <Modal
          visible={editorVisible}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setEditorVisible(false)}>
          <SafeAreaView style={styles.editorSafeArea}>
            <KeyboardAvoidingView
              style={styles.editorContainer}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={styles.editorHeader}>
                <Pressable accessibilityRole="button" onPress={() => setEditorVisible(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Text style={styles.editorLabel}>{editingNote ? 'EDIT NOTE' : 'NEW NOTE'}</Text>
                <Pressable accessibilityRole="button" onPress={saveDraft}>
                  <Text style={styles.saveText}>Save</Text>
                </Pressable>
              </View>
              <TextInput
                autoFocus
                accessibilityLabel="Note title"
                value={draftTitle}
                onChangeText={setDraftTitle}
                placeholder="Give it a title"
                placeholderTextColor="#A6A7A2"
                style={styles.titleInput}
                returnKeyType="next"
              />
              <TextInput
                accessibilityLabel="Note body"
                value={draftBody}
                onChangeText={setDraftBody}
                placeholder="Start wherever you are..."
                placeholderTextColor="#A6A7A2"
                style={styles.bodyInput}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.editorFootnote}>Saved privately on this device.</Text>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F7F3',
  },
  screen: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  eyebrow: {
    color: '#80837B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  heading: {
    color: '#20221E',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -2,
    marginTop: 3,
  },
  headingDot: {
    color: '#E48A64',
  },
  subheading: {
    color: '#777A73',
    fontSize: 15,
    marginTop: 2,
    marginBottom: 22,
  },
  updateButton: {
    backgroundColor: '#EBECE6',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  updateButtonText: {
    color: '#50534C',
    fontSize: 11,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.76,
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
  searchBox: {
    height: 50,
    backgroundColor: '#ECEDE8',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 27,
  },
  searchGlyph: {
    color: '#777A73',
    fontSize: 26,
    lineHeight: 28,
    marginRight: 9,
  },
  searchInput: {
    flex: 1,
    color: '#252721',
    fontSize: 15,
    paddingVertical: 0,
  },
  clearSearch: {
    color: '#777A73',
    fontSize: 24,
    paddingLeft: 8,
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
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
  filterButton: {
    borderColor: '#DADBD4',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterButtonActive: {
    backgroundColor: '#252721',
    borderColor: '#252721',
  },
  filterText: {
    color: '#555850',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 16,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  noteCard: {
    borderRadius: 20,
    marginBottom: 13,
    minHeight: 150,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  noteTopline: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  noteDate: {
    color: '#64655F',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  noteActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  pinIcon: {
    color: '#44463F',
    fontSize: 19,
  },
  deleteIcon: {
    color: '#64655F',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 1,
  },
  noteTitle: {
    color: '#252721',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  noteBody: {
    color: '#50524B',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },
  editHint: {
    color: '#797A73',
    fontSize: 10,
    marginTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 70,
  },
  emptyIcon: {
    color: '#E48A64',
    fontSize: 42,
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#292B25',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCopy: {
    color: '#81837C',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
    textAlign: 'center',
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
  addButtonIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    marginRight: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  editorSafeArea: {
    backgroundColor: '#F7F7F3',
    flex: 1,
  },
  editorContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  editorHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  cancelText: {
    color: '#73756E',
    fontSize: 14,
  },
  editorLabel: {
    color: '#8A8C84',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  saveText: {
    color: '#D87853',
    fontSize: 14,
    fontWeight: '700',
  },
  titleInput: {
    color: '#252721',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginTop: 30,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  bodyInput: {
    color: '#50524B',
    flex: 1,
    fontSize: 16,
    lineHeight: 25,
    paddingHorizontal: 0,
    paddingTop: 12,
  },
  editorFootnote: {
    color: '#999B94',
    fontSize: 11,
    paddingBottom: 12,
    textAlign: 'center',
  },
});

export default App;
