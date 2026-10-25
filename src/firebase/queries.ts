import { collection } from 'firebase/firestore';
import { db } from './config';

export const MEMORIES_COLLECTION = 'memories';
export const TOOL_MEMORIES_COLLECTION = 'tool_memories';

export const getMemoriesCollection = () => collection(db, MEMORIES_COLLECTION);
export const getToolMemoriesCollection = () => collection(db, TOOL_MEMORIES_COLLECTION);
