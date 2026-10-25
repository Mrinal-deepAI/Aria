import React, { useState } from "react";
import { Mic, Power, Send, Paperclip, FileText, Image, Mail, BarChart2, Calendar, Code } from "lucide-react";
import { LiveState } from "../lib/audio";
import { motion, AnimatePresence } from "motion/react";

interface CenterDashboardProps {
  onToggleConnection: () => void;
  connectionState: LiveState;
  userName: string;
  isChatOpen: boolean;
  onChatOpen: () => void;
}

export const CenterDashboard: React.FC<CenterDashboardProps> = ({ onToggleConnection, connectionState, isChatOpen }) => {
  return (
    <div className="flex-1 h-full relative pointer-events-none z-10">
      
      <AnimatePresence>
        {!isChatOpen && (
          <motion.div 
            className="fixed bottom-12 left-1/2 -translate-x-1/2 pointer-events-auto z-[100]"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0, y: 10, transition: { duration: 0.3 } }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
        <motion.button 
          onClick={onToggleConnection}
          animate={
            connectionState === "connecting" 
              ? { scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }
              : connectionState === "connected" || connectionState === "speaking" || connectionState === "listening"
              ? { scale: [1, 1.1, 1], opacity: [0.9, 1, 0.9], boxShadow: ["0px 0px 20px rgba(34,211,238,0.3)", "0px 0px 40px rgba(34,211,238,0.6)", "0px 0px 20px rgba(34,211,238,0.3)"] }
              : {}
          }
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className={`w-20 h-20 flex items-center justify-center rounded-full backdrop-blur-[40px] border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-colors duration-500 ${
            connectionState === "disconnected" 
              ? "bg-white/5 text-slate-300 hover:text-white hover:bg-white/15" 
              : connectionState === "connecting"
              ? "text-amber-400 bg-amber-400/20 border-amber-400/40"
              : "text-cyan-400 bg-cyan-400/20 border-cyan-400/40"
          }`}
          title="Start Voice Chat"
        >
          {connectionState === "disconnected" ? <Power size={36} /> : <Mic size={36} />}
        </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

function SuggestionItem({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/15 cursor-pointer transition text-slate-100 hover:text-white group drop-shadow-sm">
      <div className="text-indigo-300 group-hover:text-indigo-200 transition">{icon}</div>
      <span className="text-xs font-medium flex-1">{label}</span>
      <span className="text-slate-300 group-hover:text-white transition">›</span>
    </div>
  );
}
