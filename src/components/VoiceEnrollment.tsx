import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, ShieldCheck, ShieldX, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type EnrollState = "idle" | "checking" | "recording" | "processing" | "enrolled" | "error";

export function VoiceEnrollment() {
  const [enrollState, setEnrollState] = useState<EnrollState>("checking");
  const [statusMsg, setStatusMsg] = useState("Checking enrollment status...");
  const [countdown, setCountdown] = useState(0);
  const [isEnrolled, setIsEnrolled] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const countdownRef = useRef<any>(null);
  const RECORD_SECONDS = 8;

  useEffect(() => {
    checkEnrolled();
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  async function checkEnrolled() {
    try {
      const res = await fetch("/api/voice-enrolled");
      const data = await res.json();
      if (data.enrolled) {
        setIsEnrolled(true);
        setEnrollState("enrolled");
        setStatusMsg("Voice enrolled ✓ Aria knows your voice.");
      } else {
        setIsEnrolled(false);
        setEnrollState("idle");
        setStatusMsg("Tap to train Aria to recognize your voice.");
      }
    } catch {
      setEnrollState("idle");
      setStatusMsg("Tap to train Aria to recognize your voice.");
    }
  }

  async function startEnrollment() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      setEnrollState("recording");
      setCountdown(RECORD_SECONDS);
      setStatusMsg(`Speak naturally for ${RECORD_SECONDS} seconds...`);

      // Use audio/webm or audio/ogg if available; we'll convert to raw PCM via AudioContext
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setEnrollState("processing");
        setStatusMsg("Processing your voice... please wait.");
        await processAndEnroll();
      };

      recorder.start(200);

      // Countdown timer
      let remaining = RECORD_SECONDS;
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(countdownRef.current);
          recorder.stop();
        }
      }, 1000);
    } catch (err: any) {
      setEnrollState("error");
      setStatusMsg("Microphone access denied. Please allow mic permission.");
    }
  }

  async function processAndEnroll() {
    try {
      // Decode WebM/Opus blob → PCM16 via AudioContext
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const arrayBuffer = await blob.arrayBuffer();

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      await audioCtx.close();

      // Convert to mono PCM16 LE
      const channelData = decoded.getChannelData(0);
      const pcm16 = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(channelData[i] * 32767)));
      }

      // Base64 encode
      const uint8 = new Uint8Array(pcm16.buffer);
      let binary = "";
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const audioB64 = btoa(binary);

      const res = await fetch("/api/enroll-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: audioB64 })
      });
      const data = await res.json();

      if (data.status === "success") {
        setIsEnrolled(true);
        setEnrollState("enrolled");
        setStatusMsg("Voice enrolled! Aria now knows it's you.");
      } else {
        setEnrollState("error");
        setStatusMsg(data.message || "Enrollment failed. Please try again.");
      }
    } catch (err: any) {
      setEnrollState("error");
      setStatusMsg("Failed to process audio. Please try again.");
    }
  }

  function handleClick() {
    if (enrollState === "idle" || enrollState === "error") {
      startEnrollment();
    } else if (enrollState === "enrolled") {
      // Re-enroll
      setIsEnrolled(false);
      setEnrollState("idle");
      setStatusMsg("Tap to re-train your voice.");
    }
  }

  const stateColor = {
    idle: "border-indigo-500/40 bg-indigo-500/10",
    checking: "border-slate-500/30 bg-slate-500/10",
    recording: "border-rose-500/60 bg-rose-500/15 animate-pulse",
    processing: "border-amber-500/40 bg-amber-500/10",
    enrolled: "border-emerald-500/50 bg-emerald-500/10",
    error: "border-rose-500/50 bg-rose-500/10",
  };

  const iconColor = {
    idle: "text-indigo-400",
    checking: "text-slate-400",
    recording: "text-rose-400",
    processing: "text-amber-400",
    enrolled: "text-emerald-400",
    error: "text-rose-400",
  };

  function StateIcon() {
    if (enrollState === "enrolled") return <ShieldCheck size={18} className="text-emerald-400" />;
    if (enrollState === "error") return <ShieldX size={18} className="text-rose-400" />;
    if (enrollState === "checking" || enrollState === "processing") return <Loader2 size={18} className="animate-spin text-amber-400" />;
    if (enrollState === "recording") return <Mic size={18} className="text-rose-400 animate-pulse" />;
    return <Mic size={18} className="text-indigo-400" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full rounded-2xl border backdrop-blur-md p-3 flex items-center gap-3 cursor-pointer transition-all duration-300 select-none ${stateColor[enrollState]}`}
      onClick={handleClick}
      title={enrollState === "enrolled" ? "Click to re-enroll" : "Click to enroll your voice"}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 border border-white/10">
        <StateIcon />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold tracking-wider uppercase text-slate-400 mb-0.5">
          Voice ID
        </p>
        <p className="text-[11px] font-medium text-slate-200 leading-snug truncate">
          {statusMsg}
        </p>
      </div>
      <AnimatePresence>
        {enrollState === "recording" && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center"
          >
            <span className="text-[11px] font-bold text-rose-300">{countdown}s</span>
          </motion.div>
        )}
        {enrollState === "enrolled" && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex-shrink-0"
          >
            <Check size={16} className="text-emerald-400" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
