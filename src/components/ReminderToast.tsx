import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, Check, X } from "lucide-react";

export interface ReminderProps {
  key?: React.Key;
  id: string;
  message: string;
  onDismiss: (id: string) => void;
}

export function ReminderToast({ id, message, onDismiss }: ReminderProps) {
  // Auto-dismiss after 10 seconds if not clicked
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(id);
    }, 10000);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      className="flex items-start gap-4 p-4 w-[320px] rounded-2xl bg-white/40 backdrop-blur-[40px] border border-white/50 shadow-[0_10px_40px_rgba(0,0,0,0.1)] pointer-events-auto group relative overflow-hidden"
    >
      {/* Sparkle subtle highlight */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none opacity-50" />
      
      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-indigo-500/20 text-indigo-600 flex-shrink-0 shadow-sm relative z-10">
        <Bell size={20} className="animate-pulse" />
      </div>
      
      <div className="flex-1 min-w-0 pt-0.5 relative z-10">
        <h4 className="text-sm font-bold text-slate-800 tracking-wide">Reminder!</h4>
        <p className="text-sm text-slate-600 mt-1 leading-snug">{message}</p>
      </div>

      <button 
        onClick={() => onDismiss(id)}
        className="text-slate-400 hover:text-slate-800 transition-colors p-1 relative z-10"
      >
        <Check size={18} />
      </button>
    </motion.div>
  );
}
