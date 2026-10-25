import { db } from './config';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit, Timestamp, writeBatch, runTransaction, onSnapshot, arrayUnion } from 'firebase/firestore';
import { Conversation, ChatMessage } from './chatTypes';

const CONVERSATIONS_COLLECTION = 'Chat';

// Creates a new conversation
export async function createConversation(userId: string, firstMessage: string, type: "voice" | "text" = "text"): Promise<Conversation> {
  const newRef = doc(collection(db, CONVERSATIONS_COLLECTION));
  
  // Extract a short title from the first message
  let title = firstMessage.trim().split('\n')[0].substring(0, 40);
  if (firstMessage.length > 40) {
    title += '...';
  }

  const newConv: Conversation = {
    id: newRef.id,
    userId,
    title,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    lastMessage: title,
    totalMessages: 0,
    pinned: false,
    archived: false,
    type,
    messages: []
  };

  await setDoc(newRef, newConv);
  return newConv;
}

// Add a message to an existing conversation
export async function addMessageToConversation(
  userId: string,
  conversationId: string,
  role: "user" | "assistant",
  content: string
): Promise<ChatMessage> {
  const convRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
  
  const newMessage: ChatMessage = {
    id: Date.now().toString() + Math.random().toString(36).substring(7),
    role,
    content,
    timestamp: Timestamp.now()
  };

  await updateDoc(convRef, {
    messages: arrayUnion(newMessage),
    updatedAt: Timestamp.now(),
    lastMessage: role === 'user' ? content.substring(0, 60) : 'Assistant replied...'
  }).catch(e => console.warn("Could not update conversation metadata", e));

  return newMessage;
}

// Get recent conversations for a user
export async function getRecentConversations(userId: string, limitCount = 20): Promise<Conversation[]> {
  const q = query(
    collection(db, CONVERSATIONS_COLLECTION),
    where("userId", "==", userId),
    where("archived", "==", false),
    orderBy("updatedAt", "desc"),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Conversation);
}

// Listen to recent conversations in real-time
export function listenToRecentConversations(userId: string, limitCount: number, callback: (conversations: Conversation[]) => void): () => void {
  const q = query(
    collection(db, CONVERSATIONS_COLLECTION),
    where("userId", "==", userId)
    // Filter by archived and orderBy in memory to avoid composite index requirements
  );

  return onSnapshot(q, (snapshot) => {
    let conversations = snapshot.docs
      .map(doc => doc.data() as Conversation)
      .filter(conv => conv.archived === false);
    
    // Sort in memory by updatedAt descending
    conversations.sort((a, b) => {
      const timeA = (a.updatedAt && typeof a.updatedAt.toMillis === 'function') ? a.updatedAt.toMillis() : 0;
      const timeB = (b.updatedAt && typeof b.updatedAt.toMillis === 'function') ? b.updatedAt.toMillis() : 0;
      return timeB - timeA;
    });

    // Apply limit in memory
    if (limitCount > 0) {
      conversations = conversations.slice(0, limitCount);
    }

    callback(conversations);
  }, (error) => {
    console.error("Firestore listen error (Recent Chats):", error);
  });
}

// Get all messages for a specific conversation
export async function getConversationMessages(userId: string, conversationId: string): Promise<ChatMessage[]> {
  const convRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
  const snapshot = await getDoc(convRef);
  
  if (!snapshot.exists()) return [];
  
  const data = snapshot.data() as Conversation;
  const messages = data.messages || [];
  
  // Sort in memory to avoid missing index errors
  messages.sort((a, b) => {
    const timeA = (a.timestamp && typeof a.timestamp.toMillis === 'function') ? a.timestamp.toMillis() : 0;
    const timeB = (b.timestamp && typeof b.timestamp.toMillis === 'function') ? b.timestamp.toMillis() : 0;
    return timeA - timeB;
  });

  return messages;
}

// Update conversation title
export async function updateConversationTitle(userId: string, conversationId: string, newTitle: string): Promise<void> {
  const convRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
  await updateDoc(convRef, { title: newTitle, updatedAt: Timestamp.now() });
}

// Delete conversation
export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  // To fully delete, we should also delete subcollection messages.
  // In a client environment, deleting a document does NOT delete its subcollections automatically.
  // We'll fetch all messages and delete them in a batch.
  const convRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
  const messagesRef = collection(convRef, 'messages');
  
  const q = query(messagesRef);
  const snapshot = await getDocs(q);
  
  const batch = writeBatch(db);
  snapshot.docs.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });
  batch.delete(convRef);
  
  await batch.commit();
}
