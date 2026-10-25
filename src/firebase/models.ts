import { Timestamp } from 'firebase/firestore';
import { Memory } from '../lib/memoryTypes';

export type { Memory };

// Helper to convert Firestore document to Memory
export function convertDocToMemory(id: string, data: any): Memory {
  const parseTimestamp = (val: any) => {
    if (!val) return new Date().toISOString();
    if (val instanceof Timestamp) return val.toDate().toISOString();
    if (typeof val === 'string') return val;
    return new Date().toISOString();
  };

  return {
    id,
    category: data.category || 'identity',
    text: data.text || '',
    createdAt: parseTimestamp(data.createdAt),
    updatedAt: parseTimestamp(data.updatedAt)
  };
}
