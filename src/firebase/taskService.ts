import { db } from './config';
import { collection, doc, setDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore';
import { Task, TaskPriority, TaskStatus } from './taskTypes';

const TASKS_COLLECTION = 'Tasks';

// Create a new task
export async function createTask(
  userId: string,
  title: string,
  description: string = '',
  priority: TaskPriority = 'Medium',
  dueDateMillis: number | null = null
): Promise<Task> {
  const newRef = doc(collection(db, TASKS_COLLECTION));
  
  const newTask: Task = {
    id: newRef.id,
    userId,
    title,
    description,
    status: 'Pending',
    priority,
    dueDate: dueDateMillis ? Timestamp.fromMillis(dueDateMillis) : null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  await setDoc(newRef, newTask);
  return newTask;
}

// Listen to tasks in real-time
export function listenToTasks(userId: string, callback: (tasks: Task[]) => void): () => void {
  const q = query(
    collection(db, TASKS_COLLECTION),
    where("userId", "==", userId)
  );

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => doc.data() as Task);
    
    // Sort in memory by createdAt descending
    tasks.sort((a, b) => {
      const timeA = (a.createdAt && typeof a.createdAt.toMillis === 'function') ? a.createdAt.toMillis() : 0;
      const timeB = (b.createdAt && typeof b.createdAt.toMillis === 'function') ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });

    callback(tasks);
  }, (error) => {
    console.error("Firestore listen error (Tasks):", error);
  });
}

// Update task status
export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await updateDoc(taskRef, { status, updatedAt: Timestamp.now() });
}

// Update full task
export async function updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await updateDoc(taskRef, { ...updates, updatedAt: Timestamp.now() });
}

// Delete task
export async function deleteTask(taskId: string): Promise<void> {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await deleteDoc(taskRef);
}

// Get all tasks for a user (for backend search)
export async function getTasksByUserId(userId: string): Promise<Task[]> {
  const q = query(
    collection(db, TASKS_COLLECTION),
    where("userId", "==", userId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Task);
}
