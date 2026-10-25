import React from "react";
import { GlassPanel } from "./GlassPanel";
import { X, Search, MessageSquare, Plus, Clock, Trash2, Mic, History } from "lucide-react";
import { Conversation } from "../firebase/chatTypes";

interface HistoryDashboardProps {
  key?: React.Key;
  isOpen: boolean;
  onClose: () => void;
  recentChats: Conversation[];
  onSelectChat: (id: string, type: "voice" | "text") => void;
  onDeleteChat?: (id: string) => void;
  themeColor: string;
}

export function HistoryDashboard({
  isOpen,
  onClose,
  recentChats,
  onSelectChat,
  onDeleteChat,
  themeColor
}: HistoryDashboardProps) {
  if (!isOpen) return null;

  return (
    <GlassPanel
      title="History"
      subtitle="Your past conversations"
      icon={History}
      themeColor={themeColor}
      onClose={onClose}
    >

      {/* List */}
      <div className="p-6 h-[500px] overflow-y-auto no-scrollbar">
        {recentChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
            <MessageSquare size={32} className="mb-3" />
            <p>No conversation history found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recentChats.map((chat) => {
              let displayDate = 'Unknown date';
              try {
                if (chat.updatedAt && typeof chat.updatedAt.toDate === 'function') {
                  displayDate = chat.updatedAt.toDate().toLocaleDateString(undefined, { 
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                  });
                }
              } catch (e) {
                console.warn(e);
              }
              
              const chatType = chat.type || "text";

              return (
              <div 
                key={chat.id}
                onClick={() => onSelectChat(chat.id, chatType)}
                className="group relative p-4 rounded-2xl bg-white/40 border border-white/50 hover:bg-white/60 shadow-sm transition-all cursor-pointer overflow-hidden flex items-start gap-4"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-${themeColor}-500/20 text-${themeColor}-600 flex-shrink-0`}>
                  {chatType === "voice" ? <Mic size={16} /> : <MessageSquare size={16} />}
                </div>
                <div className="flex-1 min-w-0 pr-8">
                  <h3 className="text-sm font-semibold text-slate-700 truncate group-hover:text-slate-900 transition-colors">
                    {chat.title || "Untitled Chat"}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 font-medium">
                    <span>{displayDate}</span>
                    <span>•</span>
                    <span>{chat.totalMessages} messages</span>
                  </div>
                </div>
                {onDeleteChat && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete Chat"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
          </div>
        )}
      </div>

    </GlassPanel>
  );
}
