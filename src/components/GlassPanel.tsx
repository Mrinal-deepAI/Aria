import React from "react";
import { X, Sparkles } from "lucide-react";
import { motion } from "motion/react";

export interface GlassPanelProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon: React.ElementType;
  themeColor?: string;
  onClose?: () => void;
  width?: string;
  children: React.ReactNode;
}

export function GlassPanel({
  title,
  subtitle,
  icon: Icon,
  themeColor = "indigo",
  onClose,
  width = "w-[340px]",
  children
}: GlassPanelProps) {
  const getThemeBadgeGlow = () => {
    switch (themeColor) {
      case "violet": return "border-purple-500/30 text-purple-400 bg-purple-500/10";
      case "crimson": return "border-rose-500/30 text-rose-400 bg-rose-500/10";
      case "emerald": return "border-emerald-500/30 text-emerald-400 bg-emerald-500/10";
      case "celestial": return "border-sky-500/30 text-sky-400 bg-sky-500/10";
      case "gold": return "border-amber-500/30 text-amber-400 bg-amber-500/10";
      case "rose": return "border-pink-500/30 text-pink-400 bg-pink-500/10";
      case "charcoal":
      default:
        return "border-indigo-500/30 text-indigo-400 bg-indigo-500/10";
    }
  };

  return (
    <div
      className="absolute inset-y-0 right-0 z-20 pointer-events-auto h-full"
    >
      <div className={`h-full flex flex-col py-8 px-5 bg-transparent flex-shrink-0 ${width}`}>
        <div className="flex-1 w-full bg-white/5 border border-white/10 backdrop-blur-[40px] rounded-3xl flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.2)] overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl border ${getThemeBadgeGlow()}`}>
                <Icon size={18} className="animate-pulse" />
              </div>
              <div>
                <h3 className="font-display font-medium text-base tracking-tight text-white flex items-center gap-2">
                  {title}
                  <Sparkles size={12} className="text-cyan-400" />
                </h3>
                {subtitle && (
                  <p className="text-[9px] font-mono uppercase tracking-widest text-slate-400 mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col relative">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
