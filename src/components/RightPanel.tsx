import React from "react";
import { Brain, Users, MessageSquare, MoreHorizontal, CheckCircle, Clock, Check, Loader2 } from "lucide-react";
import { Conversation } from "../firebase/chatTypes";
import { motion } from "motion/react";

interface RightPanelProps {
  key?: React.Key;
  className?: string;
  recentChats?: Conversation[];
  themeColor?: string;
  onMemoryClick?: () => void;
  onChatClick?: () => void;
  onSelectChat?: (id: string, type: "voice" | "text") => void;
  onViewAllChatsClick?: () => void;
  onTaskClick?: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({ className = "", recentChats = [], themeColor = "indigo", onMemoryClick, onChatClick, onSelectChat, onViewAllChatsClick, onTaskClick }) => {
  return (
    <motion.div 
      initial={{ x: 50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 50, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`w-[340px] h-full flex flex-col gap-4 py-8 px-5 bg-transparent overflow-y-auto no-scrollbar ${className}`}
    >
      
      {/* Removed Voice ID box */ }

      {/* Top Nav Buttons */}
      <div className="flex items-center justify-center gap-4 mb-2">
        <TopNavBtn icon={<Brain size={20} />} label="Memory" onClick={onMemoryClick} />
        <TopNavBtn icon={<CheckCircle size={20} />} label="Tasks" onClick={onTaskClick} />
        <TopNavBtn icon={<MessageSquare size={20} />} label="Chat" onClick={onChatClick} />
      </div>

      {/* Recent Chats */}
      <div className="flex flex-col gap-3 p-4 rounded-3xl bg-white/5 backdrop-blur-[40px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-semibold text-slate-100 tracking-wide">Recent Chats</h3>
          <span onClick={onViewAllChatsClick} className="text-[11px] text-indigo-300 cursor-pointer hover:text-indigo-200 transition">View all</span>
        </div>
        
        {recentChats.slice(0, 2).map(chat => {
          let displayTime = 'Just now';
          try {
            if (chat.updatedAt && typeof chat.updatedAt.toDate === 'function') {
              displayTime = chat.updatedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
          } catch (e) {
            console.warn("Time parse error", e);
          }
          return (
            <ChatItem 
              key={chat.id} 
              text={chat.title} 
              time={displayTime}
              type={chat.type || "text"}
              onClick={() => onSelectChat && onSelectChat(chat.id, chat.type || "text")}
            />
          );
        })}
        {recentChats.length === 0 && (
          <p className="text-xs text-slate-500 py-2 text-center">No recent chats.</p>
        )}
      </div>

    </motion.div>
  );
};

function TopNavBtn({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 backdrop-blur-[40px] border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.1)] hover:bg-white/10 transition">
      <div className="text-slate-200">{icon}</div>
      <span className="text-[10px] text-slate-300 font-medium tracking-wide">{label}</span>
    </button>
  );
}

import { Mic } from "lucide-react";

function ChatItem({ text, time, type, onClick }: { key?: React.Key; text: string; time: string; type: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="flex items-center gap-2 py-1.5 cursor-pointer group">
      {type === "voice" ? (
        <Mic size={12} className="text-slate-500 group-hover:text-indigo-300 transition" />
      ) : (
        <MessageSquare size={12} className="text-slate-500 group-hover:text-indigo-300 transition" />
      )}
      <p className="text-xs text-slate-300 truncate flex-1 group-hover:text-white transition">{text}</p>
      <span className="text-[10px] text-slate-500 whitespace-nowrap">{time}</span>
    </div>
  );
}
