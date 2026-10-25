import React, { useState } from "react";
import { createPortal } from "react-dom";
import { GlassPanel } from "./GlassPanel";
import { Memory, MemoryCategory } from "../lib/memoryTypes";
import { 
  Brain, 
  X, 
  Trash2, 
  Plus, 
  User, 
  Heart, 
  Target, 
  Briefcase, 
  Users, 
  Flame, 
  Sparkles,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MemoryDashboardProps {
  key?: React.Key;
  isOpen: boolean;
  onClose: () => void;
  memories: Memory[];
  onAddMemory: (category: MemoryCategory, text: string) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  themeColor: string;
}

export function MemoryDashboard({
  isOpen,
  onClose,
  memories,
  onAddMemory,
  onDeleteMemory,
  themeColor
}: MemoryDashboardProps) {
  const [activeTab, setActiveTab] = useState<MemoryCategory | "all">("all");
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryCategory>("identity");
  const [isAdding, setIsAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Category Configuration
  const categoryConfig: Record<MemoryCategory, { label: string; icon: any; color: string; bg: string }> = {
    identity: { 
      label: "Identity Core", 
      icon: User, 
      color: "text-amber-400 border-amber-500/25", 
      bg: "bg-amber-500/5 hover:bg-amber-500/10" 
    },
    preference: { 
      label: "Preferences", 
      icon: Heart, 
      color: "text-pink-400 border-pink-500/25", 
      bg: "bg-pink-500/5 hover:bg-pink-500/10" 
    },
    goal: { 
      label: "Life Goals", 
      icon: Target, 
      color: "text-emerald-400 border-emerald-500/25", 
      bg: "bg-emerald-500/5 hover:bg-emerald-500/10" 
    },
    project: { 
      label: "Active Projects", 
      icon: Briefcase, 
      color: "text-cyan-400 border-cyan-500/25", 
      bg: "bg-cyan-500/5 hover:bg-cyan-500/10" 
    },
    relationship: { 
      label: "Relationships", 
      icon: Users, 
      color: "text-purple-400 border-purple-500/25", 
      bg: "bg-purple-500/5 hover:bg-purple-500/10" 
    },
    emotional: { 
      label: "Milestones", 
      icon: Flame, 
      color: "text-red-400 border-red-500/25", 
      bg: "bg-red-500/5 hover:bg-red-500/10" 
    },
    behavior: { 
      label: "Behaviors & Habits", 
      icon: Brain, 
      color: "text-indigo-400 border-indigo-500/25", 
      bg: "bg-indigo-500/5 hover:bg-indigo-500/10" 
    },
  };

  const defaultCategoryConfig = { 
    label: "General Memory", 
    icon: Brain, 
    color: "text-cyan-400 border-cyan-500/25", 
    bg: "bg-cyan-500/5 hover:bg-cyan-500/10" 
  };

  const getCategoryConfig = (cat: string) => {
    const key = (cat || "").toLowerCase().trim() as MemoryCategory;
    if (categoryConfig[key]) return categoryConfig[key];
    if (key.includes("identity") || key.includes("personal") || key.includes("name")) return categoryConfig.identity;
    if (key.includes("preference") || key.includes("like") || key.includes("taste")) return categoryConfig.preference;
    if (key.includes("goal") || key.includes("aspire")) return categoryConfig.goal;
    if (key.includes("project") || key.includes("work")) return categoryConfig.project;
    if (key.includes("relation") || key.includes("friend") || key.includes("family")) return categoryConfig.relationship;
    if (key.includes("emotion") || key.includes("milestone")) return categoryConfig.emotional;
    if (key.includes("behavior") || key.includes("habit")) return categoryConfig.behavior;
    return defaultCategoryConfig;
  };

  const filteredMemories = activeTab === "all" 
    ? memories 
    : memories.filter(m => (m.category || "").toLowerCase() === activeTab.toLowerCase());

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;

    setSubmitting(true);
    try {
      await onAddMemory(newCategory, newText.trim());
      setNewText("");
      setIsAdding(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch (e) {
      return "Durable Record";
    }
  };

  return (
    <GlassPanel
      title="Aria Memory Core"
      subtitle={`Records (${memories.length})`}
      icon={Brain}
      themeColor={themeColor}
      onClose={onClose}
    >
      {/* Quick stats & action row */}
            <div className="px-4 py-3 bg-white/5 border-b border-white/5 flex items-center justify-between gap-2.5">
              <span className="text-[9px] text-slate-400 font-mono leading-tight">
                💡 Aria naturally remembers.
              </span>
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-[10px] font-mono tracking-wider text-cyan-300 transition shrink-0 cursor-pointer"
              >
                <Plus size={10} />
                <span>ADD MANUAL</span>
              </button>
            </div>

            {/* Manual entry full-screen popup modal (rendered via portal) */}
            {typeof document !== "undefined" && createPortal(
              <AnimatePresence>
                {isAdding && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                  >
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: 10 }}
                      className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 backdrop-blur-[40px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden"
                    >
                      {/* Modal Header */}
                      <div className="p-5 border-b border-white/10 flex items-center justify-between">
                        <h3 className="text-sm font-semibold tracking-wide text-white flex items-center gap-2">
                          <Brain size={16} className="text-cyan-400" />
                          Add Manual Memory
                        </h3>
                        <button onClick={() => setIsAdding(false)} className="p-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer">
                          <X size={14} />
                        </button>
                      </div>

                      <form onSubmit={handleManualAdd} className="p-5 space-y-5">
                        <div>
                          <label className="block text-[10px] font-mono tracking-wider text-slate-300 uppercase mb-2.5">
                            Category
                          </label>
                          <div className="grid grid-cols-2 gap-2.5">
                            {(Object.keys(categoryConfig) as MemoryCategory[]).map((cat) => {
                              const Icon = categoryConfig[cat].icon;
                              const active = newCategory === cat;
                              return (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => setNewCategory(cat)}
                                  className={`flex items-center gap-2.5 p-2 rounded-xl border text-[11px] tracking-wide transition cursor-pointer ${
                                    active 
                                      ? "border-cyan-400 bg-cyan-400/20 text-cyan-300"
                                      : "border-white/5 bg-white/5 text-slate-400 hover:bg-white/10"
                                  }`}
                                >
                                  <Icon size={14} />
                                  <span className="truncate">{categoryConfig[cat].label.split(" ")[0]}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono tracking-wider text-slate-300 uppercase mb-2.5">
                            Recollection (3rd Person)
                          </label>
                          <textarea
                            value={newText}
                            onChange={(e) => setNewText(e.target.value)}
                            placeholder="e.g. The user's startup is called Aria."
                            required
                            className="w-full h-24 text-xs p-3.5 rounded-xl border border-white/10 bg-black/40 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 resize-none font-sans"
                          />
                        </div>

                        <div className="flex gap-2.5 justify-end pt-2 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="px-4 py-2 rounded-xl border border-white/5 text-xs font-mono tracking-wide text-slate-400 hover:text-white transition cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 rounded-xl bg-cyan-500/90 hover:bg-cyan-400 text-white font-bold text-xs uppercase font-mono tracking-widest transition disabled:opacity-50 cursor-pointer backdrop-blur-md shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                          >
                            {submitting ? "Saving..." : "Commit Memory"}
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body
            )}

            {/* TAB SELECTOR SCROLLER */}
            <div 
              className="px-4 py-3 flex gap-1.5 overflow-x-auto no-scrollbar border-b border-light border-white/10 shrink-0"
              onWheel={(e) => {
                if (e.deltaY !== 0) {
                  e.currentTarget.scrollLeft += e.deltaY;
                }
              }}
            >
              <button
                onClick={() => setActiveTab("all")}
                className={`px-2.5 py-1 rounded-full border text-[9px] tracking-wider uppercase transition cursor-pointer shrink-0 ${
                  activeTab === "all"
                    ? "border-cyan-400/50 bg-cyan-400/20 text-cyan-100 font-bold"
                    : "border-white/5 bg-white/5 text-slate-400 hover:border-white/15"
                }`}
              >
                All Memories
              </button>
              {(Object.keys(categoryConfig) as MemoryCategory[]).map((cat) => {
                const config = categoryConfig[cat];
                const active = activeTab === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveTab(cat)}
                    className={`px-2.5 py-1 rounded-full border text-[9px] tracking-wider uppercase transition shrink-0 cursor-pointer ${
                      active
                        ? "border-cyan-400/50 bg-cyan-400/20 text-cyan-100 font-bold"
                        : "border-white/5 bg-white/5 text-slate-400 hover:border-white/15"
                    }`}
                  >
                    {config.label.split(" ")[0]}
                  </button>
                );
              })}
            </div>

            {/* RECOLLECTION ITEMS CARDS CONTAINER */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
              <AnimatePresence initial={false}>
                {filteredMemories.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-500"
                  >
                    <div className="p-3 rounded-full border border-dashed border-white/10 bg-white/[0.02] mb-3">
                      <Brain size={24} className="opacity-40" />
                    </div>
                    <h4 className="text-xs font-semibold tracking-wide text-slate-300">No memories yet</h4>
                    <p className="text-[10px] max-w-xs mt-1 leading-relaxed font-mono">
                      {activeTab === "all" 
                        ? "Talk to Aria to build memory."
                        : `No records in ${categoryConfig[activeTab as MemoryCategory]?.label}.`}
                    </p>
                  </motion.div>
                ) : (
                  filteredMemories.map((m) => {
                    const cfg = getCategoryConfig(m.category);
                    const Icon = cfg.icon;

                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`flex flex-col gap-2 p-3 rounded-xl border border-white/5 backdrop-blur-md bg-white/[0.02] ${cfg.bg} transition-colors group relative`}
                      >
                        <div className="flex items-start gap-2.5 pr-6">
                          <div className={`p-1.5 rounded-lg border shrink-0 bg-black/40 ${cfg.color}`}>
                            <Icon size={12} />
                          </div>
                          <div>
                            <span className={`text-[8px] font-mono uppercase tracking-wider block ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            <span className="text-[8px] font-mono text-slate-500 block mt-0.5">
                              {formatDate(m.createdAt)}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-[11px] text-slate-200 font-sans leading-snug break-words font-medium pl-1">
                          {m.text}
                        </p>

                        {/* Forget / Delete trigger button */}
                        <button
                          onClick={() => onDeleteMemory(m.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md border border-red-500/25 bg-red-950/15 text-red-400 hover:bg-red-500 hover:text-white transition duration-150 absolute top-3 right-3 cursor-pointer"
                          title="Forget this memory"
                        >
                          <Trash2 size={12} />
                        </button>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>

            {/* Technical visual core footprint footer */}
            <div className="p-3 border-t border-white/10 bg-black/40 flex flex-col items-center justify-center gap-1 text-[8px] font-mono text-slate-600 tracking-widest">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.7)] animate-pulse" />
                <span>MEM-SYNC ACTIVE</span>
              </span>
              <span>LOCAL DB SEED</span>
            </div>
    </GlassPanel>
  );
}
