import { collection, doc, setDoc, getDocs, updateDoc, query, where, Timestamp } from 'firebase/firestore';
import { db } from './config';

export interface Reminder {
  id: string;
  userId: string;
  message: string;
  dueTime: Timestamp;
  completed: boolean;
  createdAt: Timestamp;
}

const REMINDERS_COLLECTION = 'reminders';

export async function createReminder(userId: string, message: string, dueTimeMillis: number): Promise<Reminder> {
  const newRef = doc(collection(db, REMINDERS_COLLECTION));
  
  const reminder: Reminder = {
    id: newRef.id,
    userId,
    message,
    dueTime: Timestamp.fromMillis(dueTimeMillis),
    completed: false,
    createdAt: Timestamp.now()
  };

  await setDoc(newRef, reminder);
  return reminder;
}

export async function getActiveReminders(userId: string): Promise<Reminder[]> {
  const q = query(
    collection(db, REMINDERS_COLLECTION),
    where("userId", "==", userId),
    where("completed", "==", false)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Reminder);
}

export async function markReminderCompleted(reminderId: string): Promise<void> {
  const ref = doc(db, REMINDERS_COLLECTION, reminderId);
  await updateDoc(ref, { completed: true }).catch(e => console.error("Failed to dismiss reminder", e));
}
