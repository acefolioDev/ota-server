import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { showMikiAlert } from '../components/MikiAlert';
import { NOTE_COLORS, NOTES_STORAGE_KEY } from '../constants/notes';
import type { Note } from '../types/note';
import { parseNotes } from '../utils/notes';

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const notesRef = useRef<Note[]>([]);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(NOTES_STORAGE_KEY)
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

  const commitNotes = useCallback((nextNotes: Note[]) => {
    notesRef.current = nextNotes;
    setNotes(nextNotes);

    const write = writeQueue.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(nextNotes)));
    writeQueue.current = write;
    write
      .then(() => setStorageError(null))
      .catch(error => {
        setStorageError(
          error instanceof Error ? error.message : 'Could not save your notes.',
        );
      });
  }, []);

  const saveNote = useCallback(
    (titleValue: string, bodyValue: string, editingNote: Note | null) => {
      const title = titleValue.trim();
      const body = bodyValue.trim();
      if (!title && !body) {
        showMikiAlert({
          title: 'A blank page',
          message: 'Add a title or a few words before Miki tucks this one away.',
          tone: 'note',
        });
        return false;
      }

      const timestamp = Date.now();
      const nextNote: Note = editingNote
        ? { ...editingNote, title: title || 'Untitled note', body, updatedAt: timestamp }
        : {
            id: `${timestamp.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            title: title || 'Untitled note',
            body,
            color: NOTE_COLORS[notesRef.current.length % NOTE_COLORS.length] ?? NOTE_COLORS[0]!,
            pinned: false,
            updatedAt: timestamp,
          };
      const nextNotes = editingNote
        ? notesRef.current.map(note => (note.id === editingNote.id ? nextNote : note))
        : [nextNote, ...notesRef.current];

      commitNotes(nextNotes);
      return true;
    },
    [commitNotes],
  );

  const togglePinned = useCallback(
    (note: Note) => {
      commitNotes(
        notesRef.current.map(item =>
          item.id === note.id ? { ...item, pinned: !item.pinned } : item,
        ),
      );
    },
    [commitNotes],
  );

  const deleteNote = useCallback(
    (note: Note) => {
      showMikiAlert({
        title: 'Let this one go?',
        message: `“${note.title}” will leave this device.`,
        tone: 'danger',
        buttons: [
          { text: 'Keep it', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => commitNotes(notesRef.current.filter(item => item.id !== note.id)),
          },
        ],
      });
    },
    [commitNotes],
  );

  return { notes, isLoading, storageError, saveNote, togglePinned, deleteNote };
}
