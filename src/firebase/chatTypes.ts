import { Timestamp } from 'firebase/firestore';

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Timestamp;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMessage: string;
  totalMessages: number;
  pinned: boolean;
  archived: boolean;
  type?: "voice" | "text";
  messages?: ChatMessage[];
}
