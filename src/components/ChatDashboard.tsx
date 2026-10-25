import React, { useState, useRef, useEffect } from "react";
import { GlassPanel } from "./GlassPanel";
import { motion, AnimatePresence } from "motion/react";
import { 
  MessageSquare, 
  Brain, 
  Users, 
  MoreHorizontal,
  Send,
  Paperclip,
  Mic,
  Search,
  SlidersHorizontal,
  Trash2,
  ChevronLeft
} from "lucide-react";

import { createConversation, addMessageToConversation, getConversationMessages } from "../firebase/chatService";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

interface ChatDashboardProps {
  key?: React.Key;
  isOpen: boolean;
  conversationId?: string | null;
  onClose: () => void;
  onMemoryClick: () => void;
  onConversationCreated?: (id: string) => void;
  themeColor: string;
}

export function ChatDashboard({
  isOpen,
  conversationId,
  onClose,
  onMemoryClick,
  onConversationCreated,
  themeColor
}: ChatDashboardProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load existing messages when conversationId changes
  useEffect(() => {
    if (conversationId) {
      setIsLoading(true);
      getConversationMessages("default-user", conversationId)
        .then(dbMessages => {
          if (dbMessages.length > 0) {
            setMessages(dbMessages.map(m => {
              let timeStr = 'Just now';
              try {
                if (m.timestamp && typeof m.timestamp.toDate === 'function') {
                  timeStr = m.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
              } catch(e) {}
              return {
                id: m.id,
                role: m.role,
                text: m.content,
                timestamp: timeStr
              };
            }));
          }
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Failed to load conversation", err);
          setIsLoading(false);
        });
    } else {
      // New conversation: show welcome message
      setMessages([
        {
          id: "init",
          role: "assistant",
          text: "Hi Mrinal! I'm Aria, your personal AI companion. How can I help you today?",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue.trim();
    let currentId = conversationId;

    // Create a new conversation if we don't have one
    if (!currentId) {
      try {
        const newConv = await createConversation("default-user", userText);
        currentId = newConv.id;
        if (onConversationCreated) {
          onConversationCreated(newConv.id);
        }
      } catch (err) {
        console.error("Failed to create conversation (proceeding without saving):", err);
      }
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Save User Message to Firestore (non-blocking)
      if (currentId) {
        addMessageToConversation("default-user", currentId, "user", userText).catch(e => console.error("Firestore user msg error:", e));
      }


      const historyPayload = messages.filter(m => m.id !== "init").map(m => ({
        role: m.role,
        text: m.text
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: historyPayload
        })
      });

      const data = await response.json();
      const aiReply = data.reply || "Sorry, I had trouble processing that.";
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiMessage]);

      // Save AI Message to Firestore (non-blocking)
      if (currentId) {
        addMessageToConversation("default-user", currentId, "assistant", aiReply).catch(e => console.error("Firestore ai msg error:", e));
      }

    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: "I'm having trouble connecting right now.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <GlassPanel
      title="Conversation"
      subtitle="Chat with Aria"
      icon={MessageSquare}
      themeColor={themeColor}
      width="w-[450px] lg:w-[500px] xl:w-[550px]"
      onClose={onClose}
    >
      {/* Header Actions */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div className="flex gap-3 text-slate-400">
          <Search size={14} className="hover:text-white cursor-pointer transition" />
          <SlidersHorizontal size={14} className="hover:text-white cursor-pointer transition" />
          <Trash2 
            size={14} 
            className="hover:text-rose-400 cursor-pointer transition" 
            onClick={() => setMessages([])} 
            title="Clear Chat"
          />
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 no-scrollbar"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex flex-col max-w-[85%] ${
                msg.role === "user" ? "self-end items-end" : "self-start items-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex items-center gap-2 mb-1.5 ml-1">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shadow-sm">
                    <Brain size={10} className="text-indigo-600" />
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold">Aria</span>
                </div>
              )}
              
              <div className={`px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-sm backdrop-blur-md ${
                msg.role === "user" 
                  ? "bg-indigo-500/90 text-white rounded-br-sm border border-indigo-400/50" 
                  : "bg-white/60 text-slate-800 rounded-bl-sm border border-white/60"
              }`}>
                {msg.text}
              </div>
              <span className={`text-[10px] text-slate-500 mt-1 font-semibold ${
                msg.role === "user" ? "mr-1" : "ml-1"
              }`}>
                {msg.timestamp} {msg.role === "user" ? "✓✓" : ""}
              </span>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="self-start flex gap-1 items-center bg-white/60 backdrop-blur-md px-4 py-3 rounded-2xl rounded-bl-sm border border-white/60 shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Input Area with layoutId */}
      <div className="p-4 pb-6 bg-transparent">
        <motion.div 
          layoutId="chat-input"
          className="flex items-center gap-3 p-2 bg-white/40 backdrop-blur-[40px] border border-white/50 rounded-[3rem] shadow-[0_8px_32px_rgba(0,0,0,0.05)] relative z-50 w-full"
        >
          <button className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-full transition cursor-pointer">
            <Paperclip size={18} />
          </button>
          
          <input 
            type="text" 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Aria..." 
            className="flex-1 bg-transparent text-slate-800 placeholder-slate-500 outline-none text-[15px] font-semibold"
            disabled={isLoading}
          />
          
          <button className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-full transition cursor-pointer">
            <Mic size={18} />
          </button>

          <button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className={`w-11 h-11 flex items-center justify-center rounded-full transition shadow-lg ${
              inputValue.trim() && !isLoading 
                ? "bg-indigo-500 hover:bg-indigo-600 text-white shadow-md cursor-pointer" 
                : "bg-white/20 text-slate-400 cursor-not-allowed border border-white/30"
            }`}
          >
            <Send size={18} className="translate-x-[1px] translate-y-[1px]" />
          </button>
        </motion.div>
      </div>
    </GlassPanel>
  );
}
