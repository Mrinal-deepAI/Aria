import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Bot } from "lucide-react";

export interface VoiceMessage {
  id: string;
  role: "user" | "model";
  text: string;
}

interface VoiceConversationPanelProps {
  isOpen: boolean;
  messages: VoiceMessage[];
  themeColor: string;
  aiState?: "idle" | "thinking" | "talking";
  speechLang: string;
  setSpeechLang: (lang: string) => void;
  onUserTranscriptFinal?: (text: string) => void;
}

export const VoiceConversationPanel: React.FC<VoiceConversationPanelProps> = ({
  isOpen,
  messages,
  themeColor,
  aiState = "idle",
  speechLang,
  setSpeechLang,
  onUserTranscriptFinal
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [realTimeTranscription, setRealTimeTranscription] = useState("");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, realTimeTranscription]);

  useEffect(() => {
    if (!isOpen) {
      setRealTimeTranscription("");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLang;
    
    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const finalText = event.results[i][0].transcript.trim();
          setRealTimeTranscription("");
          if (finalText && onUserTranscriptFinal) {
            onUserTranscriptFinal(finalText);
          }
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      if (interimTranscript) {
        setRealTimeTranscription(interimTranscript);
      }
    };

    let isMounted = true;

    recognition.onend = () => {
      if (isMounted && isOpen) {
        try {
          recognition.start();
        } catch (e) {}
      }
    };

    recognition.onerror = () => {};

    try {
      recognition.start();
    } catch (e) {}

    return () => {
      isMounted = false;
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [isOpen, speechLang]);

  const getThemeTextGlow = () => {
    switch (themeColor) {
      case "violet": return "text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.5)]";
      case "crimson": return "text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.5)]";
      case "emerald": return "text-emerald-400 drop-shadow-[0_0_12px_rgba(10,185,129,0.5)]";
      case "celestial": return "text-sky-400 drop-shadow-[0_0_12px_rgba(14,165,233,0.5)]";
      case "gold": return "text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]";
      case "rose": return "text-pink-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.5)]";
      case "charcoal":
      default: return "text-indigo-400 drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]";
    }
  };

  const getThemeBgGlow = () => {
    switch (themeColor) {
      case "violet": return "bg-purple-500/20 border-purple-500/30 text-purple-100";
      case "crimson": return "bg-rose-500/20 border-rose-500/30 text-rose-100";
      case "emerald": return "bg-emerald-500/20 border-emerald-500/30 text-emerald-100";
      case "celestial": return "bg-sky-500/20 border-sky-500/30 text-sky-100";
      case "gold": return "bg-amber-500/20 border-amber-500/30 text-amber-100";
      case "rose": return "bg-pink-500/20 border-pink-500/30 text-pink-100";
      case "charcoal":
      default: return "bg-indigo-500/20 border-indigo-500/30 text-indigo-100";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "120%", opacity: 0, scale: 0.95 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          exit={{ x: "120%", opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 250, damping: 25 }}
          className="fixed top-[320px] bottom-[110px] right-6 w-[340px] rounded-2xl bg-white/5 backdrop-blur-[40px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.2)] z-[100] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 shadow-inner ${getThemeTextGlow()}`}>
                <Mic size={20} className="animate-pulse" />
              </div>
              <div>
                <h2 className="text-white font-medium text-lg tracking-tight">Live Voice Call</h2>
                <p className="text-slate-400 text-xs mt-0.5">Real-time transcription</p>
              </div>
            </div>
            
            {/* Minimal Language Toggle */}
            <div className="flex bg-black/30 rounded-lg p-1 border border-white/5">
              {(['en-US', 'bn-IN', 'hi-IN'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSpeechLang(lang)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${
                    speechLang === lang 
                      ? 'bg-white/20 text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {lang === 'en-US' ? 'EN' : lang === 'bn-IN' ? 'BN' : 'HI'}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
                <Mic size={32} className="opacity-20" />
                <p>Waiting for you to speak...</p>
              </div>
            ) : (
              messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1.5 px-1 opacity-70">
                    {msg.role === "user" ? (
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-300">You</span>
                    ) : (
                      <>
                        <Bot size={12} className={getThemeTextGlow()} />
                        <span className={`text-[10px] uppercase tracking-wider font-semibold ${getThemeTextGlow()}`}>Aria</span>
                      </>
                    )}
                  </div>
                  <div 
                    className={`px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-sm backdrop-blur-md break-words whitespace-pre-wrap ${
                      msg.role === 'user' 
                        ? 'bg-indigo-500/90 text-white rounded-br-sm border border-indigo-400/50' 
                        : 'bg-white/60 text-slate-800 rounded-bl-sm border border-white/60'
                    }`}
                  >
                    {msg.text || (
                      <span className="flex gap-1 items-center h-5">
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    )}
                  </div>
                </motion.div>
              ))
            )}

            {/* AI Thinking Indicator */}
            {aiState === "thinking" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start max-w-[85%]"
              >
                <div className={`px-4 py-3 rounded-2xl text-[15px] shadow-sm ${getThemeBgGlow()} rounded-tl-sm`}>
                  <span className="flex gap-1 items-center h-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </motion.div>
            )}

            {/* Real-time User Transcription Bubble */}
            {realTimeTranscription && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="flex flex-col max-w-[85%] self-end items-end"
              >
                <div className="flex items-center gap-2 mb-1.5 px-1 opacity-70">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-300 animate-pulse">Listening...</span>
                </div>
                <div className="px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-sm break-words whitespace-pre-wrap bg-indigo-500/90 text-white rounded-br-sm border border-indigo-400/50 italic">
                  {realTimeTranscription}
                  <span className="inline-block w-1 h-4 ml-1 bg-white/50 animate-pulse" />
                </div>
              </motion.div>
            )}
          </div>
          
          {/* Subtle bottom gradient for smooth scroll fade */}
          <div className="h-10 w-full bg-gradient-to-t from-slate-900/60 to-transparent pointer-events-none absolute bottom-0" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
