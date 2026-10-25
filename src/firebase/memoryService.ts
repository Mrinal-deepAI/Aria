import { getDocs, setDoc, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from './config';
import { getMemoriesCollection, TOOL_MEMORIES_COLLECTION } from './queries';
import { Memory, convertDocToMemory } from './models';

// In-memory cache for the current session (as per requirements)
let memoryCache: Memory[] | null = null;

export async function getAllMemories(forceRefresh = false): Promise<Memory[]> {
  try {
    if (memoryCache !== null && !forceRefresh) {
      return memoryCache;
    }
    const snapshot = await getDocs(getMemoriesCollection());
    const memories = snapshot.docs.map(d => convertDocToMemory(d.id, d.data()));
    
    // Sort by createdAt (oldest first, or newest first depending on preference)
    // Here we preserve insertion order or sort by date
    memories.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    memoryCache = memories;
    return memories;
  } catch (error) {
    console.error("[Firebase Service] Error getting memories:", error);
    return memoryCache || [];
  }
}

export async function addMemory(memory: Memory): Promise<void> {
  try {
    const docRef = doc(db, 'memories', memory.id);
    await setDoc(docRef, {
      id: memory.id,
      category: memory.category,
      text: memory.text,
      createdAt: Timestamp.fromDate(new Date(memory.createdAt)),
      updatedAt: Timestamp.fromDate(new Date(memory.updatedAt))
    });
    
    if (memoryCache !== null) {
      memoryCache.push(memory);
    }
  } catch (error) {
    console.error("[Firebase Service] Error adding memory:", error);
    throw error; // Rethrow to let caller handle retry or failure
  }
}

export async function addToolMemory(memory: Memory): Promise<void> {
  try {
    const docRef = doc(db, TOOL_MEMORIES_COLLECTION, memory.id);
    await setDoc(docRef, {
      id: memory.id,
      category: memory.category,
      text: memory.text,
      createdAt: Timestamp.fromDate(new Date(memory.createdAt)),
      updatedAt: Timestamp.fromDate(new Date(memory.updatedAt))
    });
  } catch (error) {
    console.error("[Firebase Service] Error adding tool memory:", error);
    throw error;
  }
}

export async function updateMemory(memory: Memory): Promise<void> {
  try {
    const docRef = doc(db, 'memories', memory.id);
    await setDoc(docRef, {
      category: memory.category,
      text: memory.text,
      updatedAt: Timestamp.fromDate(new Date(memory.updatedAt))
    }, { merge: true });
    
    if (memoryCache !== null) {
      const index = memoryCache.findIndex(m => m.id === memory.id);
      if (index !== -1) {
        memoryCache[index] = memory;
      }
    }
  } catch (error) {
    console.error("[Firebase Service] Error updating memory:", error);
    throw error;
  }
}

export async function deleteMemory(id: string): Promise<void> {
  try {
    const docRef = doc(db, 'memories', id);
    await deleteDoc(docRef);
    
    if (memoryCache !== null) {
      memoryCache = memoryCache.filter(m => m.id !== id);
    }
  } catch (error) {
    console.error("[Firebase Service] Error deleting memory:", error);
    throw error;
  }
}
