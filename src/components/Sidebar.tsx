import React from "react";
import { 
  Home, 
  MessageSquare, 
  CheckSquare, 
  Users, 
  Brain, 
  BookOpen, 
  FolderOpen, 
  Wrench, 
  Settings,
  Activity
} from "lucide-react";
import { motion } from "motion/react";
import { VoiceAuthenticator } from "./VoiceAuthenticator";

interface SidebarProps {
  className?: string;
  activeTab?: "home" | "chat" | "tasks" | "memory" | "files";
  onHomeClick?: () => void;
  onMemoryClick?: () => void;
  onChatClick?: () => void;
  onTasksClick?: () => void;
  onFilesClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  className = "", 
  activeTab = "home",
  onHomeClick,
  onMemoryClick, 
  onChatClick, 
  onTasksClick,
  onFilesClick 
}) => {
  return (
    <aside className={`pointer-events-auto w-[300px] h-full flex flex-col gap-2 pt-2 pb-4 px-5 bg-transparent ${className}`}>
      
      {/* Top Section: Logo Card */}
      <div className="flex flex-col gap-1 p-4 rounded-3xl bg-white/5 backdrop-blur-[40px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 overflow-hidden rounded-full border border-indigo-400/50 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
            <img src="/aria-logo.png" alt="Aria Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-indigo-400 tracking-wide">Aria</h1>
            <p className="text-[10px] text-slate-300 font-medium tracking-wide">Your AI Assistant</p>
          </div>
        </div>
      </div>

      {/* Center Section: Nav Links — grows to fill space */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto no-scrollbar relative flex flex-col">
        <NavLink icon={<Home size={18} />} label="Home" active={activeTab === "home"} onClick={onHomeClick} />
        <NavLink icon={<MessageSquare size={18} />} label="Chat" active={activeTab === "chat"} onClick={onChatClick} />
        <NavLink icon={<CheckSquare size={18} />} label="Tasks" active={activeTab === "tasks"} onClick={onTasksClick} />
        <NavLink icon={<Brain size={18} />} label="Memory" active={activeTab === "memory"} onClick={onMemoryClick} />
        <NavLink icon={<FolderOpen size={18} />} label="File" active={activeTab === "files"} onClick={onFilesClick} />
      </nav>

      {/* Bottom Section: Voice Authenticator */}
      <div className="mt-auto pt-4">
        <VoiceAuthenticator />
      </div>

    </aside>
  );
};


function NavLink({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`relative flex items-center gap-3 px-4 py-2.5 rounded-2xl cursor-pointer transition-colors z-10 ${
      active ? "text-indigo-300 font-medium" : "text-slate-100 hover:text-white"
    }`}>
      {active && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className="absolute inset-0 bg-white/15 rounded-2xl shadow-[0_4px_15px_rgba(0,0,0,0.1)] border border-white/10 -z-10"
          initial={false}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
      )}
      {!active && (
        <div className="absolute inset-0 bg-white/10 rounded-2xl opacity-0 hover:opacity-100 transition-opacity -z-10" />
      )}
      <div className={active ? "text-indigo-400" : ""}>{icon}</div>
      <span className="text-[13px] tracking-wide drop-shadow-sm">{label}</span>
    </div>
  );
}
