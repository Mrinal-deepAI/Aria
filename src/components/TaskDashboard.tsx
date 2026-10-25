import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { GlassPanel } from "./GlassPanel";
import { X, CheckCircle, Clock, Check, Loader2, ListTodo, Plus, Filter, Calendar, Search, Trash2 } from "lucide-react";
import { Task, TaskPriority, TaskStatus } from "../firebase/taskTypes";
import { createTask, updateTaskStatus, deleteTask } from "../firebase/taskService";

interface TaskDashboardProps {
  key?: React.Key;
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  themeColor?: string;
}

export function TaskDashboard({ isOpen, onClose, tasks, themeColor = "indigo" }: TaskDashboardProps) {
  const [activeTab, setActiveTab] = useState<"All Tasks" | "Today" | "Upcoming" | "Completed">("All Tasks");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>("Medium");

  if (!isOpen) return null;

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    await createTask("default-user", newTaskTitle.trim(), newTaskDesc.trim(), newTaskPriority);
    setIsAdding(false);
    setNewTaskTitle("");
    setNewTaskDesc("");
    setNewTaskPriority("Medium");
  };

  const handleToggleTask = async (task: Task) => {
    const newStatus: TaskStatus = task.status === "Completed" ? "Pending" : "Completed";
    await updateTaskStatus(task.id, newStatus);
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const completedCount = tasks.filter(t => t.status === "Completed").length;
  const inProgressCount = tasks.filter(t => t.status !== "Completed").length;

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <GlassPanel
      title="Tasks"
      subtitle="Manage your tasks efficiently"
      icon={ListTodo}
      themeColor={themeColor}
      width="w-[500px]"
      onClose={onClose}
    >

      {/* Summary Cards */}
      <div className="px-6 py-4 grid grid-cols-3 gap-2">
        <div className="col-span-1 rounded-xl bg-white/5 border border-white/5 p-3 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <ListTodo size={14} className="text-slate-400" />
            <span className="text-[10px] text-slate-400">Total Tasks</span>
          </div>
          <span className="text-lg font-semibold text-white">{tasks.length}</span>
        </div>
        <div className="col-span-1 rounded-xl bg-white/5 border border-white/5 p-3 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={14} className="text-emerald-400" />
            <span className="text-[10px] text-slate-400">Completed</span>
          </div>
          <span className="text-lg font-semibold text-emerald-400">{completedCount}</span>
        </div>
        <div className="col-span-1 rounded-xl bg-white/5 border border-white/5 p-3 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 size={14} className="text-blue-400" />
            <span className="text-[10px] text-slate-400">Incomplete</span>
          </div>
          <span className="text-lg font-semibold text-blue-400">{inProgressCount}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 flex items-center justify-between border-b border-white/5 pb-3">
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search tasks..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-1.5 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition"
          />
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500 text-[11px] font-semibold text-white hover:bg-blue-600 transition shadow-[0_0_10px_rgba(59,130,246,0.3)] shrink-0"
        >
          <Plus size={14} /> Add Task
        </button>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 flex flex-col gap-3">
        {isAdding && createPortal(
          <AnimatePresence>
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
                <div className="p-5 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-sm font-semibold tracking-wide text-white flex items-center gap-2">
                    <ListTodo size={16} className="text-blue-400" />
                    Create New Task
                  </h3>
                  <button onClick={() => setIsAdding(false)} className="p-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer">
                    <X size={14} />
                  </button>
                </div>
                
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono tracking-wider text-slate-300 uppercase mb-2">Title</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Discuss deployment" 
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      className="w-full text-sm p-3 rounded-xl border border-white/10 bg-black/40 text-white placeholder-slate-500 outline-none focus:border-blue-500/60 transition"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono tracking-wider text-slate-300 uppercase mb-2">Description</label>
                    <textarea 
                      placeholder="Optional details..." 
                      value={newTaskDesc}
                      onChange={e => setNewTaskDesc(e.target.value)}
                      className="w-full h-20 text-xs p-3 rounded-xl border border-white/10 bg-black/40 text-white placeholder-slate-500 outline-none focus:border-blue-500/60 resize-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono tracking-wider text-slate-300 uppercase mb-2">Priority</label>
                    <select 
                      value={newTaskPriority} 
                      onChange={e => setNewTaskPriority(e.target.value as TaskPriority)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl text-xs text-white px-3 py-2.5 outline-none focus:border-blue-500/60 transition cursor-pointer appearance-none"
                    >
                      <option value="High">High Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="Low">Low Priority</option>
                    </select>
                  </div>
                  <div className="flex gap-2.5 justify-end pt-3 border-t border-white/10">
                    <button onClick={() => setIsAdding(false)} className="px-4 py-2 rounded-xl border border-white/5 text-xs font-mono tracking-wide text-slate-400 hover:text-white transition cursor-pointer">Cancel</button>
                    <button onClick={handleAddTask} className="px-4 py-2 rounded-xl bg-blue-500/90 hover:bg-blue-400 text-white font-bold text-xs uppercase font-mono tracking-widest transition cursor-pointer backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.3)]">Save Task</button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}

        {filteredTasks.map(task => {
          const isCompleted = task.status === "Completed";
          return (
            <div key={task.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between group hover:bg-white/10 transition cursor-pointer">
              <div className="flex items-center gap-4">
                <button onClick={() => handleToggleTask(task)} className={`w-5 h-5 rounded flex items-center justify-center border transition ${isCompleted ? "bg-emerald-500 border-emerald-500" : "border-slate-500 hover:border-slate-400"}`}>
                  {isCompleted && <Check size={12} className="text-white" />}
                </button>
                <div className="flex flex-col">
                  <span className={`text-[13px] font-medium transition ${isCompleted ? "text-slate-500 line-through" : "text-slate-200"}`}>{task.title}</span>
                  {task.description && <span className="text-[11px] text-slate-500">{task.description}</span>}
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                {/* Priority Badge */}
                <div className={`px-2 py-1 rounded-md text-[10px] font-medium flex items-center gap-1 ${
                  isCompleted ? "bg-emerald-500/10 text-emerald-400" :
                  task.priority === "High" ? "bg-rose-500/10 text-rose-400" :
                  task.priority === "Medium" ? "bg-blue-500/10 text-blue-400" :
                  "bg-amber-500/10 text-amber-400"
                }`}>
                  {isCompleted ? "Completed" : task.priority}
                </div>
                
                {/* Delete Button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTask(task.id);
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition opacity-0 group-hover:opacity-100"
                  title="Delete Task"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}
