import React, { useState, useEffect } from "react";
import { GlassPanel } from "./GlassPanel";
import { FolderOpen, X, File, FileText } from "lucide-react";
import { motion } from "motion/react";

interface FileDashboardProps {
  key?: React.Key;
  isOpen: boolean;
  onClose: () => void;
  themeColor: string;
}

interface FileItem {
  name: string;
  isDirectory: boolean;
}

export function FileDashboard({
  isOpen,
  onClose,
  themeColor
}: FileDashboardProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/list-files')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            // Sort directories first, then alphabetically
            data.sort((a, b) => {
              if (a.isDirectory === b.isDirectory) {
                return a.name.localeCompare(b.name);
              }
              return a.isDirectory ? -1 : 1;
            });
            setFiles(data);
          }
        })
        .catch(err => console.error("Failed to fetch files:", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <GlassPanel 
      title="File System"
      subtitle="Manage project files"
      icon={FolderOpen}
      themeColor={themeColor}
      onClose={onClose}
    >
      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-1">
            {files.map((file, i) => (
              <div 
                key={i} 
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-default"
              >
                {file.isDirectory ? (
                  <FolderOpen size={16} className="text-cyan-400 shrink-0" />
                ) : (
                  <FileText size={16} className="text-slate-400 shrink-0" />
                )}
                <span className={`text-sm ${file.isDirectory ? 'text-white' : 'text-slate-300'} truncate`}>
                  {file.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Action */}
      <div className="p-4 border-t border-white/10 shrink-0 bg-white/5">
        <button 
          onClick={async () => {
            try {
              await fetch('/api/open-project', { method: 'POST' });
            } catch (err) {
              console.error("Failed to open files folder:", err);
            }
          }}
          className="w-full py-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-xl transition-all border border-cyan-500/20 flex items-center justify-center gap-2 text-sm font-medium shadow-[0_0_15px_rgba(6,182,212,0.1)]"
        >
          <FolderOpen size={16} />
          Open in OS Explorer
        </button>
      </div>
    </GlassPanel>
  );
}
