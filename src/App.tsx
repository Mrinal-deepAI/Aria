import { useState, useEffect, useRef } from "react";
import { AriaAudioSession, LiveState } from "./lib/audio";
import { AriaCoreVisualizer, AriaEmotion } from "./components/AriaCoreVisualizer";
import { 
  Power, 
  Volume2, 
  Info, 
  Sparkles, 
  Globe, 
  Maximize2, 
  MessageSquareOff, 
  Compass, 
  CircleAlert,
  MicOff,
  Mic,
  X,
  Brain,
  Monitor,
  Play,
  Pause,
  Square,
  RefreshCw,
  Video
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Memory, MemoryCategory } from "./lib/memoryTypes";
import { MemoryDashboard } from "./components/MemoryDashboard";
import { ChatDashboard } from "./components/ChatDashboard";
import { Sidebar } from "./components/Sidebar";
import { RightPanel } from "./components/RightPanel";
import { CenterDashboard } from "./components/CenterDashboard";
import { HistoryDashboard } from "./components/HistoryDashboard";
import { TaskDashboard } from "./components/TaskDashboard";
import { FileDashboard } from "./components/FileDashboard";
import { ReminderToast, ReminderProps } from "./components/ReminderToast";
import { ChatMessage as OldChatMessage } from "./components/ChatDashboard";
import { Conversation } from "./firebase/chatTypes";
import { listenToRecentConversations, deleteConversation, createConversation, addMessageToConversation, getConversationMessages } from "./firebase/chatService";
import { getActiveReminders, markReminderCompleted, Reminder } from "./firebase/reminderService";
import { VoiceConversationPanel, VoiceMessage } from "./components/VoiceConversationPanel";
import { listenToTasks } from "./firebase/taskService";
import { Task } from "./firebase/taskTypes";
import { Clock } from "./components/Clock";

export default function App() {
  const [state, setState] = useState<LiveState>("disconnected");
  const [speechLang, setSpeechLang] = useState<string>("en-US");

  // Real-time Screen Sharing states
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [isScreenSharingPaused, setIsScreenSharingPaused] = useState<boolean>(false);
  const [screenVisionMode, setScreenVisionMode] = useState<boolean>(true);

  // References to preserve state across intervals
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenIntervalRef = useRef<any>(null);

  // Camera Vision states & refs
  const [isCameraSharing, setIsCameraSharing] = useState<boolean>(false);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraIntervalRef = useRef<any>(null);

  const isPausedRef = useRef<boolean>(false);
  const screenVisionRef = useRef<boolean>(true);
  const stateRef = useRef<LiveState>("disconnected");

  // Sync state changes with refs to totally prevent stale closures in callbacks
  useEffect(() => {
    isPausedRef.current = isScreenSharingPaused;
  }, [isScreenSharingPaused]);

  useEffect(() => {
    screenVisionRef.current = screenVisionMode;
  }, [screenVisionMode]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Clean up streaming intervals on unmount
  useEffect(() => {
    return () => {
      if (screenIntervalRef.current) {
        clearInterval(screenIntervalRef.current);
      }
      if (cameraIntervalRef.current) {
        clearInterval(cameraIntervalRef.current);
      }
    };
  }, []);

  const captureFrameAndSend = () => {
    const video = screenVideoRef.current;
    if (!video || isPausedRef.current || !screenVisionRef.current) {
      return;
    }

    if (stateRef.current === "disconnected") {
      return;
    }

    try {
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      if (!screenCanvasRef.current) {
        screenCanvasRef.current = document.createElement("canvas");
      }
      const canvas = screenCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Restrict maximum resolution size to keep payload light for Gemini Live
      const maxDim = 960;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(video, 0, 0, width, height);

      // Highly compressed JPEG standard is optimized and preserves details perfectly
      const dataUrl = canvas.toDataURL("image/jpeg", 0.55);
      const base64 = dataUrl.split(",")[1];

      if (sessionRef.current && stateRef.current !== "disconnected") {
        sessionRef.current.sendVideoFrame(base64);
      }
    } catch (err) {
      console.error("[Screen Capture] Failed drawing frame to canvas:", err);
    }
  };

  const startScreenSharing = async () => {
    setErrorText(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 5 }
        },
        audio: false
      });

      screenStreamRef.current = stream;

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.play().catch(e => console.error("Video play warning:", e));
      screenVideoRef.current = video;

      setIsScreenSharing(true);
      setIsScreenSharingPaused(false);

      // Stop handling when native stop sharing bar button ends
      stream.getVideoTracks()[0].onended = () => {
        stopScreenSharing();
      };

      // Set up frame capture interval (one frame every 2 seconds is highly robust, preventing overload)
      if (screenIntervalRef.current) {
        clearInterval(screenIntervalRef.current);
      }
      screenIntervalRef.current = setInterval(() => {
        captureFrameAndSend();
      }, 2000);

      // Promptly capture first frame immediately
      setTimeout(() => {
        captureFrameAndSend();
      }, 500);

    } catch (e: any) {
      console.error("Screen sharing permission declined or missing API:", e);
      if (e.name !== "NotAllowedError") {
        setErrorText(`Could not capture screen: ${e.message || e}`);
      }
    }
  };

  const stopScreenSharing = () => {
    if (screenIntervalRef.current) {
      clearInterval(screenIntervalRef.current);
      screenIntervalRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      screenStreamRef.current = null;
    }

    if (screenVideoRef.current) {
      screenVideoRef.current.pause();
      screenVideoRef.current = null;
    }

    setIsScreenSharing(false);
    setIsScreenSharingPaused(false);
  };

  const pauseScreenSharing = () => {
    setIsScreenSharingPaused(true);
  };

  const resumeScreenSharing = () => {
    setIsScreenSharingPaused(false);
    // Refresh first frame immediately
    setTimeout(() => {
      captureFrameAndSend();
    }, 100);
  };

  const switchScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
    }
    await startScreenSharing();
  };

  const captureCameraFrameAndSend = () => {
    const video = cameraVideoRef.current;
    if (!video || isPausedRef.current || !screenVisionRef.current) return;
    if (stateRef.current === "disconnected") return;

    try {
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      if (!cameraCanvasRef.current) {
        cameraCanvasRef.current = document.createElement("canvas");
      }
      const canvas = cameraCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const maxDim = 960;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(video, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.55);
      const base64 = dataUrl.split(",")[1];

      if (sessionRef.current && stateRef.current !== "disconnected") {
        sessionRef.current.sendVideoFrame(base64);
      }
    } catch (err) {
      console.error("[Camera Capture] Failed drawing frame to canvas:", err);
    }
  };

  const startCameraSharing = async () => {
    setErrorText(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 5 }
        },
        audio: false
      });

      cameraStreamRef.current = stream;

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.play().catch(e => console.error("Camera play warning:", e));
      cameraVideoRef.current = video;

      setIsCameraSharing(true);

      stream.getVideoTracks()[0].onended = () => {
        stopCameraSharing();
      };

      if (cameraIntervalRef.current) {
        clearInterval(cameraIntervalRef.current);
      }
      cameraIntervalRef.current = setInterval(() => {
        captureCameraFrameAndSend();
      }, 2000);

      setTimeout(() => {
        captureCameraFrameAndSend();
      }, 500);

    } catch (e: any) {
      console.error("Camera permission declined or missing API:", e);
      if (e.name !== "NotAllowedError") {
        setErrorText(`Could not capture camera: ${e.message || e}`);
      }
    }
  };

  const stopCameraSharing = () => {
    if (cameraIntervalRef.current) {
      clearInterval(cameraIntervalRef.current);
      cameraIntervalRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => {
        try { track.stop(); } catch (e) {}
      });
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.pause();
      cameraVideoRef.current = null;
    }
    setIsCameraSharing(false);
  };

  const switchCameraShare = async () => {
    stopCameraSharing();
    await startCameraSharing();
  };

  const [activeEmotion, setActiveEmotion] = useState<AriaEmotion>("idle");
  const [themeColor, setThemeColor] = useState("indigo");
  
  // Chat History State
  const [recentChats, setRecentChats] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const activeVoiceConversationIdRef = useRef<string | null>(null);
  const pendingModelMessageRef = useRef<string>("");
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([]);

  const [userCaption, setUserCaption] = useState<string>("");
  const [characterState, setCharacterState] = useState<"idle" | "thinking" | "talking">("idle");

  const detectEmotionFromText = (text: string): AriaEmotion => {
    const lower = text.toLowerCase();
    if (lower.includes("haha") || lower.includes("lol") || lower.includes("funny") || lower.includes("joke") || lower.includes("hehe") || lower.includes("wink")) return "playful";
    if (lower.includes("happy") || lower.includes("harmony") || lower.includes("glad") || lower.includes("joy") || lower.includes("wonderful") || lower.includes("love") || lower.includes("smile")) return "happy";
    if (lower.includes("wow") || lower.includes("awesome") || lower.includes("excited") || lower.includes("amazing") || lower.includes("yay") || lower.includes("incredible") || lower.includes("hype")) return "excited";
    if (lower.includes("really?") || lower.includes("curious") || lower.includes("interest") || lower.includes("tell me more") || lower.includes("why") || lower.includes("how") || lower.includes("wonder")) return "curious";
    if (lower.includes("think") || lower.includes("calculat") || lower.includes("analyz") || lower.includes("hmmm") || lower.includes("process") || lower.includes("let me see") || lower.includes("conclude")) return "thinking";
    if (lower.includes("proud") || lower.includes("achieved") || lower.includes("expert") || lower.includes("skill") || lower.includes("confidence") || lower.includes("succeed")) return "proud";
    if (lower.includes("sad") || lower.includes("sorry") || lower.includes("unfortunate") || lower.includes("grief") || lower.includes("bad") || lower.includes("regret") || lower.includes("alas") || lower.includes("cry")) return "sad";
    if (lower.includes("shock") || lower.includes("surprise") || lower.includes("gasp") || lower.includes("unexpected") || lower.includes("seriously") || lower.includes("oh my")) return "surprised";
    if (lower.includes("blush") || lower.includes("shy") || lower.includes("embarrass") || lower.includes("nervous") || lower.includes("oops") || lower.includes("sorry about")) return "embarrassed";
    if (lower.includes("what?") || lower.includes("confus") || lower.includes("puzzled") || lower.includes("dont know") || lower.includes("not sure") || lower.includes("wait")) return "confused";
    return "idle";
  };
  const [modelCaption, setModelCaption] = useState<string>("");
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);


  // Aria recollections database core state
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showMemoryDashboard, setShowMemoryDashboard] = useState(false);
  const [showChatDashboard, setShowChatDashboard] = useState(false);
  const [showHistoryDashboard, setShowHistoryDashboard] = useState(false);
  const [showTaskDashboard, setShowTaskDashboard] = useState(false);
  const [showFileDashboard, setShowFileDashboard] = useState(false);

  // Reminders & Tasks state
  const [dueReminders, setDueReminders] = useState<Reminder[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const sessionRef = useRef<AriaAudioSession | null>(null);

  // Fetch initial recollections from backend database
  useEffect(() => {
    fetch("/api/memories")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMemories(data);
        }
      })
      .catch(err => {
        console.warn("Backend load failed.", err);
      });
  }, []);

  const handleAddManualMemory = async (category: MemoryCategory, text: string) => {
    try {
      const resp = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, text })
      });
      const saved = await resp.json();
      if (saved && saved.id) {
        setMemories((prev) => [...prev, saved]);
      }
    } catch (err) {
      console.warn("Backend save failed.", err);
      const fakeSaved: Memory = { id: Date.now().toString(), category, text, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      setMemories((prev) => [...prev, fakeSaved]);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      const resp = await fetch(`/api/memories/${id}`, {
        method: "DELETE"
      });
      const resObj = await resp.json();
      if (resObj && resObj.success) {
        setMemories((prev) => prev.filter(m => m.id !== id));
      }
    } catch (err) {
      console.warn("Backend delete failed.", err);
      setMemories((prev) => prev.filter(m => m.id !== id));
    }
  };

  const handleDeleteChat = async (id: string) => {
    try {
      await deleteConversation("default-user", id);
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setShowChatDashboard(false);
      }
    } catch (err) {
      console.error("Failed to delete chat:", err);
    }
  };

  // Initialize the audio session handlers once on mount
  useEffect(() => {
    sessionRef.current = new AriaAudioSession({
      onStateChange: (newState) => {
        setState(newState);

        const flushPendingModelMessage = () => {
          if (pendingModelMessageRef.current && activeVoiceConversationIdRef.current) {
            addMessageToConversation("default-user", activeVoiceConversationIdRef.current, "assistant", pendingModelMessageRef.current)
              .catch(e => console.error("Failed to save model voice message:", e));
            pendingModelMessageRef.current = "";
          }
        };

        if (newState === "connecting") {
          setVoiceMessages([]);
        }

        if (newState === "disconnected") {
          flushPendingModelMessage();
          activeVoiceConversationIdRef.current = null;
          // Reset captions on disconnect
          setUserCaption("");
          setModelCaption("");
          setActiveEmotion("idle");
          setCharacterState("idle");
        } else if (newState === "listening") {
          // Model finished speaking, flush its full text
          flushPendingModelMessage();
          // Return to receptive resting state
          setActiveEmotion("idle");
          setCharacterState("idle");
        } else if (newState === "speaking") {
          setCharacterState("talking");
        }
      },
      onTranscription: (role, text) => {
        if (role === "user") {
          setUserCaption(text);
          // Auto-clear the other caption when user starts talking
          setModelCaption("");
          setCharacterState("thinking");

          // Save pending model message if it didn't flush
          if (pendingModelMessageRef.current && activeVoiceConversationIdRef.current) {
             addMessageToConversation("default-user", activeVoiceConversationIdRef.current, "assistant", pendingModelMessageRef.current);
             pendingModelMessageRef.current = "";
          }

          setVoiceMessages(prev => {
             const last = prev[prev.length - 1];
             if (last && last.role === "user") {
                const newArr = [...prev];
                // Gemini sends the full transcript for the turn so far, or chunks. 
                // We'll concatenate if it's new text, but usually it's best to just overwrite if it's a running transcript.
                // However, since we don't know for sure, let's just append if it's not already in the text.
                const newText = last.text.endsWith(text) ? last.text : (last.text + " " + text).trim();
                newArr[newArr.length - 1] = { ...last, text: newText }; // Overwrite with the latest full transcript
                return newArr;
             } else {
                return [...prev, { id: Date.now().toString() + Math.random().toString(), role: "user", text }];
             }
          });

          // Save user message to Firebase
          if (!activeVoiceConversationIdRef.current) {
             createConversation("default-user", text, "voice").then(conv => {
               activeVoiceConversationIdRef.current = conv.id;
               addMessageToConversation("default-user", conv.id, "user", text);
             }).catch(e => console.error("Failed to create voice conv:", e));
          } else {
             // We shouldn't spam Firebase with every intermediate chunk. But keeping it as is for now.
             addMessageToConversation("default-user", activeVoiceConversationIdRef.current, "user", text)
               .catch(e => console.error("Failed to append user voice message:", e));
          }

        } else if (role === "model") {
          setModelCaption((prev) => {
            const next = prev + text;
            const newEmotion = detectEmotionFromText(next);
            setActiveEmotion(newEmotion);
            return next;
          });
          // Clear user caption when model replies
          setUserCaption("");

          pendingModelMessageRef.current += text;
          setVoiceMessages(prev => {
             const last = prev[prev.length - 1];
             if (last && last.role === "model") {
                const newArr = [...prev];
                newArr[newArr.length - 1] = { ...last, text: last.text + text };
                return newArr;
             } else {
                return [...prev, { id: Date.now().toString() + Math.random().toString(), role: "model", text }];
             }
          });
        }
      },
      onToolCall: (name, args, callback) => {
        console.log(`[App] Tool call triggered: ${name}`, args);
        
        if (name === "changeBackground") {
          const colorName = args.color?.toLowerCase();
          const validColors = ["violet", "crimson", "emerald", "celestial", "gold", "rose", "charcoal"];
          
          if (colorName && validColors.includes(colorName)) {
            setThemeColor(colorName);
            callback({ result: `Successfully shifted aesthetic atmosphere to ${colorName}.` });
          } else {
            callback({ error: `Unsupported color '${colorName}'. Supported themes are: ${validColors.join(", ")}` });
          }
        } else {
          callback({ error: `Tool ${name} is not implemented.` });
        }
      },
      onError: (err) => {
        setErrorText(err);
      },
      onMemorySync: (updatedMemories) => {
        console.log("[App] WebSocket memories sync triggered:", updatedMemories);
        if (Array.isArray(updatedMemories)) {
          setMemories(updatedMemories);
        }
      },
      onChangeLanguage: (lang) => {
        setSpeechLang(lang);
      }
    });

    if (sessionRef.current) {
      sessionRef.current.onActionExecuted = (action, payload, result) => {
        console.log("[App] Action executed:", action, result);
      };
    }

    return () => {
      if (sessionRef.current) {
        sessionRef.current.disconnect();
        sessionRef.current = null;
      }
    };
  }, []);

  // Listen to Recent Chats
  useEffect(() => {
    // For now, hardcode "default-user". Integrate Firebase Auth later if needed.
    const unsubscribe = listenToRecentConversations("default-user", 10, (chats) => {
      setRecentChats(chats);
    });
    return () => unsubscribe();
  }, []);

  // Poll for Reminders
  useEffect(() => {
    const checkReminders = async () => {
      try {
        const active = await getActiveReminders("default-user");
        setDueReminders(active);
      } catch (err) {
        console.error("Reminder poll failed", err);
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Listen to Tasks
  useEffect(() => {
    const unsubscribe = listenToTasks("default-user", (tasksData) => {
      setTasks(tasksData);
    });
    return () => unsubscribe();
  }, []);

  const handleDismissReminder = async (id: string) => {
    setDueReminders(prev => prev.filter(r => r.id !== id));
    await markReminderCompleted(id).catch(e => console.error("Failed to dismiss reminder", e));
  };

  const handleToggleConnection = async () => {
    setErrorText(null);
    if (!sessionRef.current) return;

    if (state === "disconnected") {
      await sessionRef.current.connect();
    } else if (state !== "connecting") {
      await sessionRef.current.disconnect();
    }
  };

  const handleOpenFiles = async () => {
    setShowMemoryDashboard(false);
    setShowChatDashboard(false);
    setShowTaskDashboard(false);
    setShowHistoryDashboard(false);
    setShowFileDashboard(true);
  };

  // Maps theme colors to CSS ambient light spots
  const getAmbientStyles = () => {
    switch (themeColor) {
      case "violet":
        return "from-purple-950/40 via-violet-950/20 to-slate-950";
      case "crimson":
        return "from-red-950/40 via-orange-950/20 to-slate-950";
      case "emerald":
        return "from-emerald-950/40 via-teal-950/20 to-slate-950";
      case "celestial":
        return "from-sky-950/45 via-indigo-950/25 to-slate-950";
      case "gold":
        return "from-amber-950/30 via-yellow-950/15 to-slate-950";
      case "rose":
        return "from-rose-950/40 via-pink-950/20 to-slate-950";
      case "charcoal":
      default:
        return "from-slate-900/50 via-slate-950/30 to-slate-950";
    }
  };

  const getThemeTextGlow = () => {
    switch (themeColor) {
      case "violet": return "text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.5)]";
      case "crimson": return "text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.5)]";
      case "emerald": return "text-emerald-400 drop-shadow-[0_0_12px_rgba(10,185,129,0.5)]";
      case "celestial": return "text-sky-400 drop-shadow-[0_0_12px_rgba(14,165,233,0.5)]";
      case "gold": return "text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]";
      case "rose": return "text-pink-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.5)]";
      case "charcoal":
      default:
        return "text-indigo-400 drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]";
    }
  };

  const getOrbRingColor = () => {
    switch (state) {
      case "listening": return "border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.3)] bg-indigo-500/10";
      case "speaking": return "border-purple-500/70 shadow-[0_0_40px_rgba(168,85,247,0.4)] bg-purple-500/10";
      case "connecting": return "border-amber-500/50 animate-pulse bg-amber-500/10";
      case "disconnected":
      default:
        return "border-white/10 hover:border-indigo-500/30 bg-white/5";
    }
  };

  return (
    <div
      id="aria-holographic-desktop"
      className={`relative w-full h-screen overflow-hidden bg-[#020205] text-white ${getAmbientStyles()} theme-transition flex flex-col justify-between p-6 sm:p-10 select-none`}
    >
      {/* Ambient Background Gradients matching Frosted Glass theme */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-900/15 rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-900/15 rounded-full pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[300px] h-[300px] bg-indigo-800/10 rounded-full pointer-events-none" />

      {/* Decorative grid pattern background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-40" />

      {/* FULL VIEWPORT HOLOGRAPHIC STAGE: Aria materializes across the entire screen */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        <AriaCoreVisualizer
          session={sessionRef.current}
          state={state}
          themeColor={themeColor}
          activeEmotion={activeEmotion}
          characterState={characterState}
        />
      </div>

      {/* DASHBOARD LAYOUT OVERLAY */}
      <div className="relative z-30 flex w-full h-full">
        {/* Left Sidebar */}
        <Sidebar 
          activeTab={
            showMemoryDashboard ? "memory" :
            showTaskDashboard ? "tasks" :
            showChatDashboard || showHistoryDashboard ? "chat" :
            showFileDashboard ? "files" :
            "home"
          }
          onHomeClick={() => {
            setShowMemoryDashboard(false);
            setShowChatDashboard(false);
            setShowTaskDashboard(false);
            setShowHistoryDashboard(false);
            setShowFileDashboard(false);
            setActiveConversationId(null);
          }}
          onMemoryClick={() => {
            setShowChatDashboard(false);
            setShowTaskDashboard(false);
            setShowHistoryDashboard(false);
            setShowFileDashboard(false);
            setShowMemoryDashboard(true);
          }}
          onChatClick={() => {
            setShowMemoryDashboard(false);
            setShowTaskDashboard(false);
            setShowHistoryDashboard(false);
            setShowFileDashboard(false);
            setShowChatDashboard(true);
          }}
          onTasksClick={() => {
            setShowMemoryDashboard(false);
            setShowChatDashboard(false);
            setShowHistoryDashboard(false);
            setShowFileDashboard(false);
            setShowTaskDashboard(true);
          }}
          onFilesClick={handleOpenFiles}
        />

        {/* Center Main Dashboard (Greeting, Chat Input, Suggestions) */}
        <CenterDashboard 
          onToggleConnection={handleToggleConnection} 
          connectionState={state} 
          userName="Mrinal"
          isChatOpen={showChatDashboard}
          onChatOpen={() => {
            setShowMemoryDashboard(false);
            setShowTaskDashboard(false);
            setShowFileDashboard(false);
            setShowChatDashboard(true);
          }}
        />

        {/* Right Info Panel & Memory Panel & Chat Panel & History Panel & Task Panel */}
        <AnimatePresence>
          {!showMemoryDashboard && !showChatDashboard && !showHistoryDashboard && !showTaskDashboard && !showFileDashboard ? (
            <RightPanel
              key="right-panel"
              recentChats={recentChats}
              onMemoryClick={() => setShowMemoryDashboard(true)} 
              onTaskClick={() => setShowTaskDashboard(true)}
              onChatClick={() => {
                setActiveConversationId(null);
                setShowMemoryDashboard(false);
                setShowHistoryDashboard(false);
                setShowTaskDashboard(false);
                setShowFileDashboard(false);
                setShowChatDashboard(true);
              }}
              onSelectChat={(id, type) => {
                setActiveConversationId(null);
                setShowMemoryDashboard(false);
                setShowHistoryDashboard(false);
                setShowTaskDashboard(false);
                setShowFileDashboard(false);
                
                if (type === "voice") {
                  setShowChatDashboard(false);
                  setTimeout(() => {
                    activeVoiceConversationIdRef.current = id;
                    
                    // Fetch history for this voice conversation
                    getConversationMessages("default-user", id).then(msgs => {
                      setVoiceMessages(msgs.map(m => ({ 
                        id: m.id, 
                        role: m.role === "assistant" ? "model" : "user", 
                        text: m.content 
                      })));
                    }).catch(console.error);

                    // Connect to voice API immediately if they clicked a voice session!
                    if (state === "disconnected") {
                      handleToggleConnection();
                    }
                  }, 0);
                } else {
                  setShowChatDashboard(true);
                  setTimeout(() => {
                    setActiveConversationId(id);
                  }, 0);
                }
              }}
              onViewAllChatsClick={() => {
                setShowMemoryDashboard(false);
                setShowChatDashboard(false);
                setShowTaskDashboard(false);
                setShowFileDashboard(false);
                setShowHistoryDashboard(true);
              }}
              themeColor={themeColor}
            />
          ) : showMemoryDashboard ? (
            <MemoryDashboard
              key="memory-panel"
              isOpen={showMemoryDashboard}
              onClose={() => setShowMemoryDashboard(false)}
              memories={memories}
              onAddMemory={handleAddManualMemory}
              onDeleteMemory={handleDeleteMemory}
              themeColor={themeColor}
            />
          ) : showHistoryDashboard ? (
            <HistoryDashboard
              key="history-panel"
              isOpen={showHistoryDashboard}
              onClose={() => setShowHistoryDashboard(false)}
              recentChats={recentChats}
              onSelectChat={(id, type) => {
                setActiveConversationId(null);
                setShowMemoryDashboard(false);
                setShowHistoryDashboard(false);
                setShowTaskDashboard(false);
                setShowFileDashboard(false);
                
                if (type === "voice") {
                  setShowChatDashboard(false);
                  setTimeout(() => {
                    activeVoiceConversationIdRef.current = id;
                    
                    // Fetch history for this voice conversation
                    getConversationMessages("default-user", id).then(msgs => {
                      setVoiceMessages(msgs.map(m => ({ 
                        id: m.id, 
                        role: m.role === "assistant" ? "model" : "user", 
                        text: m.content 
                      })));
                    }).catch(console.error);

                    // Connect to voice API immediately if they clicked a voice session!
                    if (state === "disconnected") {
                      handleToggleConnection();
                    }
                  }, 0);
                } else {
                  setShowChatDashboard(true);
                  setTimeout(() => {
                    setActiveConversationId(id);
                  }, 0);
                }
              }}
              onDeleteChat={handleDeleteChat}
              themeColor={themeColor}
            />
          ) : showChatDashboard ? (
            <ChatDashboard
              key="chat-panel"
              isOpen={showChatDashboard}
              conversationId={activeConversationId}
              onConversationCreated={(id) => setActiveConversationId(id)}
              onClose={() => setShowChatDashboard(false)}
              onMemoryClick={() => {
                setShowChatDashboard(false);
                setShowMemoryDashboard(true);
              }}
              themeColor={themeColor}
            />
          ) : showTaskDashboard ? (
            <TaskDashboard
              key="task-panel"
              isOpen={showTaskDashboard}
              onClose={() => setShowTaskDashboard(false)}
              tasks={tasks}
              themeColor={themeColor}
            />
          ) : showFileDashboard ? (
            <FileDashboard
              key="file-panel"
              isOpen={showFileDashboard}
              onClose={() => setShowFileDashboard(false)}
              themeColor={themeColor}
            />
          ) : null}
        </AnimatePresence>
      </div>

      {/* Reminders Overlay */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {dueReminders.map(rem => (
            <ReminderToast 
              key={rem.id} 
              id={rem.id} 
              message={rem.message} 
              onDismiss={handleDismissReminder} 
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Permanent Glassmorphic Camera Control Hub (Bottom Left, Above Screen Share) */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.85, x: -50 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          className={`absolute bottom-[300px] left-6 z-50 w-72 p-4 rounded-3xl bg-white/5 backdrop-blur-[40px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.2)] flex flex-col gap-3 overflow-hidden`}
        >
          {isCameraSharing ? (
            <>
              {/* Active State */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,1)] animate-pulse" />
                  <span className="text-[11px] font-medium text-slate-200">Camera Vision Active</span>
                </div>
              </div>

              {/* Smart Video PIP Preview Holder */}
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black/40 border border-fuchsia-500/20 shadow-inner flex items-center justify-center select-none">
                <video
                  ref={(el) => {
                    if (el && cameraStreamRef.current && el.srcObject !== cameraStreamRef.current) {
                      el.srcObject = cameraStreamRef.current;
                      el.muted = true;
                      el.play().catch(err => console.log("Camera preview stream play issue:", err));
                    }
                  }}
                  className="w-full h-full object-cover transition-opacity duration-300 transform -scale-x-100"
                  autoPlay
                  playsInline
                  muted
                />
              </div>

              {/* Quick Action Control Strip */}
              <div className="flex items-center gap-2">
                <button
                  onClick={switchCameraShare}
                  className="flex-1 py-2 px-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-medium text-slate-200 hover:text-white transition-all cursor-pointer shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
                  title="Change Camera"
                >
                  Change Camera
                </button>

                <button
                  onClick={stopCameraSharing}
                  className="flex-1 py-2 px-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-xl text-xs font-medium text-rose-300 flex items-center justify-center transition-all cursor-pointer shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
                  title="Stop Camera"
                >
                  Stop Camera
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Inactive State */}
              <div className="flex items-center justify-between px-1 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.5)]" />
                  <span className="text-[11px] font-medium text-slate-300">Camera Vision Inactive</span>
                </div>
              </div>
              
              <div className="aspect-video w-full rounded-2xl bg-black/20 border border-white/5 shadow-inner flex flex-col items-center justify-center gap-2 text-slate-400">
                <Video size={24} className="opacity-50" />
                <span className="text-[10px] font-medium">Aria cannot see you</span>
              </div>

              <button
                onClick={startCameraSharing}
                className="w-full mt-1 py-2.5 px-4 bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-500/30 rounded-xl text-xs font-semibold text-fuchsia-300 flex items-center justify-center transition-all cursor-pointer shadow-[0_2px_15px_rgba(232,121,249,0.2)]"
              >
                Start Camera
              </button>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Permanent Glassmorphic Screen Sharing Control Hub (Bottom Left) */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.85, x: -50 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          className={`absolute bottom-6 left-6 z-50 w-72 p-4 rounded-3xl bg-white/5 backdrop-blur-[40px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.2)] flex flex-col gap-3 overflow-hidden`}
        >
          {isScreenSharing ? (
            <>
              {/* Active State */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,1)] animate-pulse" />
                  <span className="text-[11px] font-medium text-slate-200">Screen Share Active</span>
                </div>
              </div>

              {/* Smart Video PIP Preview Holder */}
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black/40 border border-white/5 shadow-inner flex items-center justify-center select-none">
                <video
                  ref={(el) => {
                    if (el && screenStreamRef.current && el.srcObject !== screenStreamRef.current) {
                      el.srcObject = screenStreamRef.current;
                      el.muted = true;
                      el.play().catch(err => console.log("Mini preview stream play issue:", err));
                    }
                  }}
                  className={`w-full h-full object-contain transition-opacity duration-300 ${
                    isScreenSharingPaused ? "opacity-30 blur-sm" : "opacity-100"
                  }`}
                  autoPlay
                  playsInline
                  muted
                />
              </div>

              {/* Quick Action Control Strip */}
              <div className="flex items-center gap-2">
                <button
                  onClick={switchScreenShare}
                  className="flex-1 py-2 px-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-medium text-slate-200 hover:text-white transition-all cursor-pointer shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
                  title="Choose Another Screen"
                >
                  Change Screen
                </button>

                <button
                  onClick={stopScreenSharing}
                  className="flex-1 py-2 px-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-xl text-xs font-medium text-rose-300 flex items-center justify-center transition-all cursor-pointer shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
                  title="Stop Sharing"
                >
                  Stop Sharing
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Inactive State */}
              <div className="flex items-center justify-between px-1 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.5)]" />
                  <span className="text-[11px] font-medium text-slate-300">Screen Share Inactive</span>
                </div>
              </div>
              
              <div className="aspect-video w-full rounded-2xl bg-black/20 border border-white/5 shadow-inner flex flex-col items-center justify-center gap-2 text-slate-400">
                <Monitor size={24} className="opacity-50" />
                <span className="text-[10px] font-medium">Aria cannot see your screen</span>
              </div>

              <button
                onClick={startScreenSharing}
                className="w-full mt-1 py-2.5 px-4 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl text-xs font-semibold text-indigo-300 flex items-center justify-center transition-all cursor-pointer shadow-[0_2px_15px_rgba(99,102,241,0.2)]"
              >
                Start Screen Share
              </button>
            </>
          )}
        </motion.div>
      </AnimatePresence>



      <AnimatePresence>
        {!showMemoryDashboard && !showChatDashboard && !showHistoryDashboard && !showTaskDashboard && !showFileDashboard && (
          <>
            <Clock />
          </>
        )}
      </AnimatePresence>

    <VoiceConversationPanel 
      isOpen={state !== "disconnected" && !showMemoryDashboard && !showChatDashboard && !showHistoryDashboard && !showTaskDashboard && !showFileDashboard} 
      messages={voiceMessages} 
      themeColor={themeColor} 
      aiState={characterState}
      speechLang={speechLang}
      setSpeechLang={setSpeechLang}
      onUserTranscriptFinal={(text) => {
        // Save the user's speech directly from browser recognition
        setVoiceMessages(prev => [...prev, { id: Date.now().toString() + Math.random().toString(), role: "user", text }]);

        // Save user message to Firebase
        if (!activeVoiceConversationIdRef.current) {
            createConversation("default-user", text, "voice").then(conv => {
              activeVoiceConversationIdRef.current = conv.id;
              addMessageToConversation("default-user", conv.id, "user", text);
            }).catch(e => console.error("Failed to create voice conv:", e));
        } else {
            addMessageToConversation("default-user", activeVoiceConversationIdRef.current, "user", text)
              .catch(e => console.error("Failed to append user voice message:", e));
        }
      }}
    />

    </div>
  );
}
