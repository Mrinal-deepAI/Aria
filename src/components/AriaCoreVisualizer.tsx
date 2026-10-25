import React, { useEffect, useRef, useState } from "react";
import { AriaAudioSession, LiveState } from "../lib/audio";
import { Sparkles } from "lucide-react";

export type AriaEmotion = 
  | "idle" 
  | "happy" 
  | "excited" 
  | "curious" 
  | "thinking" 
  | "proud" 
  | "sad" 
  | "confused" 
  | "surprised" 
  | "embarrassed" 
  | "playful";

interface AriaCoreVisualizerProps {
  session: AriaAudioSession | null;
  state: LiveState;
  themeColor: string; // Violet, crimson, emerald, celestial, gold, rose, charcoal
  activeEmotion?: AriaEmotion;
  characterState: "idle" | "thinking" | "talking";
}

export const AriaCoreVisualizer: React.FC<AriaCoreVisualizerProps> = ({
  session,
  state,
  themeColor,
  activeEmotion = "idle",
  characterState
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Video element refs for character state machine
  const idleVideoRef = useRef<HTMLVideoElement | null>(null);
  const thinkingVideoRef = useRef<HTMLVideoElement | null>(null);
  const thinkingContinueVideoRef = useRef<HTMLVideoElement | null>(null);
  const talkingVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isThinkingContinued, setIsThinkingContinued] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  const handleVideoError = (videoName: string) => {
    console.warn(`[Aria Web Video] Failed to load video source for: ${videoName}`);
    setHasError(true);
  };

  // Interaction and tracking references
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.4 });
  const targetMouseRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.4 });
  
  // Physics & Animation states
  const speechVolumeRef = useRef<number>(0);

  // Floating sci-fi background particle arrays
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    speed: number;
    size: number;
    opacity: number;
  }>>([]);

  // Synchronized video playback state manager (highly polished and flicker-free)
  useEffect(() => {
    const playVideo = (videoEl: HTMLVideoElement | null) => {
      if (!videoEl) return;
      try {
        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn("Autoplay block detected, retrying muted play:", error);
          });
        }
      } catch (err) {}
    };

    // Play all videos continuously so they remain perfectly in sync and never jump
    // Re-triggering on state change ensures browsers don't suspend hidden videos.
    playVideo(idleVideoRef.current);
    playVideo(thinkingVideoRef.current);
    playVideo(thinkingContinueVideoRef.current);
    playVideo(talkingVideoRef.current);
  }, [characterState]);

  // Reset the thinking intro sequence whenever we transition back to thinking
  useEffect(() => {
    if (characterState === "thinking") {
      setIsThinkingContinued(false);
      if (thinkingVideoRef.current) {
        thinkingVideoRef.current.currentTime = 0;
        thinkingVideoRef.current.play().catch(() => {});
      }
    }
  }, [characterState]);

  // Cursor position tracking hook
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      targetMouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Theme matching mapping function (extremely beautiful cinematic color tones)
  const getGlowColors = () => {
    switch (themeColor) {
      case "violet":
        return { primary: "rgba(147, 51, 234, 1)", secondary: "rgba(192, 38, 211, 0.8)", glow: "rgba(168, 85, 247, 0.7)" };
      case "crimson":
        return { primary: "rgba(225, 29, 72, 1)", secondary: "rgba(234, 88, 12, 0.8)", glow: "rgba(244, 63, 94, 0.7)" };
      case "emerald":
        return { primary: "rgba(5, 150, 105, 1)", secondary: "rgba(13, 148, 136, 0.8)", glow: "rgba(16, 185, 129, 0.7)" };
      case "celestial":
        return { primary: "rgba(2, 132, 199, 1)", secondary: "rgba(8, 145, 178, 0.8)", glow: "rgba(14, 165, 233, 0.7)" };
      case "gold":
        return { primary: "rgba(202, 138, 4, 1)", secondary: "rgba(217, 119, 6, 0.8)", glow: "rgba(234, 179, 8, 0.7)" };
      case "rose":
        return { primary: "rgba(219, 39, 119, 1)", secondary: "rgba(220, 38, 38, 0.8)", glow: "rgba(236, 72, 153, 0.7)" };
      default:
        return { primary: "rgba(34, 211, 238, 1)", secondary: "rgba(79, 70, 229, 0.8)", glow: "rgba(6, 182, 212, 0.7)" };
    }
  };

  // Main high speed Canvas graphics rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    // Generate responsive background floating stars
    const generateParticles = () => {
      const count = Math.min(60, Math.floor(width / 24));
      particlesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height + height * 0.1,
        speed: Math.random() * 0.35 + 0.12,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.6 + 0.2,
      }));
    };

    generateParticles();

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      generateParticles();
    };

    window.addEventListener("resize", handleResize);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const systemTime = performance.now();
      const colors = getGlowColors();

      // Dynamic Audio analysis fetching from real voice session
      let audioLevel = 0;
      let bufferLength = 64;
      const dataArray = new Uint8Array(bufferLength);
      let activeAnalyser = null;

      if (state === "speaking" && session?.outputAnalyser) {
        activeAnalyser = session.outputAnalyser;
      } else if (state === "listening" && session?.inputAnalyser) {
        activeAnalyser = session.inputAnalyser;
      }

      if (activeAnalyser) {
        try {
          activeAnalyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          audioLevel = sum / bufferLength; // 0 to 255
        } catch (e) {}
      }

      // Smooth amplitude tracking for real-time particle excitation
      speechVolumeRef.current += (audioLevel / 255 - speechVolumeRef.current) * 0.2;

      // Cinematic ambient stardust sizing
      const baseScale = height / 440;
      const s = Math.max(0.95, Math.min(1.85, baseScale)); // scale multiplier

      // Smooth cursor mouse tracking lag
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.05;

      const centerX = width / 2;

      // ==========================================
      // 1. VOLUMETRIC PROJECTOR BEAM REMOVED AS REQUESTED
      // ==========================================

      // ==========================================
      // 2. MINIMALIST ATMOSPHERE NEURAL FIELDS (SUBTLE GLITCH)
      // ==========================================
      const applyGlitch = (state === "connecting" && Math.random() < 0.1) || (Math.random() < 0.005);
      if (applyGlitch) {
        ctx.save();
        ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 2);
        ctx.fillStyle = Math.random() < 0.5 ? "rgba(236,72,153,0.03)" : "rgba(34,211,238,0.03)";
        ctx.fillRect(0, 0, width, height);
      }

      // ==========================================
      // 3. UPDATE AND DRAW HOLOGRAM NEURAL PARTICLES RISING (Cinematic Stardust)
      // ==========================================
      particlesRef.current.forEach((p) => {
        const riseSpeed = p.speed * (1 + speechVolumeRef.current * 1.8);
        p.y -= riseSpeed;
        
        // Horizontal drift sway
        p.x += Math.sin(p.y * 0.015 + p.size) * 0.4;
        
        // Transparency matches base lift height
        const currentOpacity = p.opacity * Math.max(0, p.y / height);

        // Recirculate particle if it reaches up too high near her crown
        if (p.y < height * 0.12) {
          p.y = height + Math.random() * 30;
          p.x = Math.random() * width;
        }

        ctx.fillStyle = colors.primary.replace("1)", `${currentOpacity * 0.45})`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * s, 0, Math.PI * 2);
        ctx.fill();
      });

      if (applyGlitch) {
        ctx.restore();
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [session, state, themeColor, activeEmotion, characterState]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* 1. Behind Overlay / Atmospheric Backlight Glow (Z-index 0) */}
      <div className="absolute inset-0 bg-transparent flex items-center justify-center pointer-events-none z-0">
        <div className={`w-[500px] h-[500px] rounded-full blur-[140px] opacity-25 bg-gradient-to-tr transition-all duration-1000 ${
          themeColor === "violet" ? "from-purple-600/30 to-fuchsia-600/5" :
          themeColor === "crimson" ? "from-rose-600/30 to-orange-600/5" :
          themeColor === "emerald" ? "from-emerald-600/30 to-teal-600/5" :
          themeColor === "celestial" ? "from-sky-600/30 to-cyan-600/5" :
          themeColor === "gold" ? "from-amber-600/30 to-yellow-600/5" :
          themeColor === "rose" ? "from-rose-600/30 to-pink-600/5" :
          "from-indigo-600/30 to-cyan-600/5"
        }`} />
      </div>

      {/* 2. Character Videos state crossfade manager (Z-index 10) */}
      <div 
        id="aria-animated-presence"
        className="absolute z-10 w-full h-full flex items-center justify-center pointer-events-auto transition-all duration-700"
      >
        <div className="relative w-full h-full flex items-center justify-center select-none pointer-events-none">
          {/* Subtle Outer Ambient Shadow Cast */}
          <div className="absolute inset-0 opacity-20 bg-cyan-600/15 pointer-events-none mix-blend-screen" />

          {/* IDLE VIDEO */}
          <video
            ref={idleVideoRef}
            src="/assets/idle.mp4"
            loop
            muted
            playsInline
            autoPlay
            className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-700 ease-in-out ${
              characterState === "idle" ? "opacity-100 z-10 animate-fade-in" : "opacity-0 z-0"
            }`}
            onError={() => handleVideoError("idle")}
          />

          {/* THINKING VIDEO (Intro) */}
          <video
            ref={thinkingVideoRef}
            src="/assets/thinking.mp4"
            muted
            playsInline
            autoPlay
            onEnded={() => setIsThinkingContinued(true)}
            className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-700 ease-in-out ${
              characterState === "thinking" && !isThinkingContinued ? "opacity-100 z-10 animate-fade-in" : "opacity-0 z-0"
            }`}
            onError={() => handleVideoError("thinking")}
          />

          {/* THINKING CONTINUE VIDEO (Loop) */}
          <video
            ref={thinkingContinueVideoRef}
            src="/assets/thinking_continuous.mp4"
            loop
            muted
            playsInline
            autoPlay
            className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-700 ease-in-out ${
              characterState === "thinking" && isThinkingContinued ? "opacity-100 z-10 animate-fade-in" : "opacity-0 z-0"
            }`}
            onError={() => handleVideoError("thinking_continuous")}
          />

          {/* TALKING VIDEO */}
          <video
            ref={talkingVideoRef}
            src="/assets/talking.mp4"
            loop
            muted
            playsInline
            autoPlay
            className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-700 ease-in-out ${
              characterState === "talking" ? "opacity-100 z-10 animate-fade-in" : "opacity-0 z-0"
            }`}
            onError={() => handleVideoError("talking")}
          />

          {/* Faint cybernetic visual edge grid guard */}
          <div className="absolute inset-0 border border-white/5 pointer-events-none bg-radial-gradient from-transparent to-black/35" />

          {/* Video Placeholder/Fallback Tutorial Overlay if asset files are absent */}
          {hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#05060f]/90 backdrop-blur-md rounded-3xl p-6 text-center z-50 pointer-events-auto border border-white/5 shadow-2xl animate-fade-in">
              <Sparkles className="text-cyan-400 mb-2 animate-pulse" size={32} />
              <h3 className="text-sm font-bold tracking-widest font-mono text-white select-none">AWAITING VIDEOS CORES</h3>
              <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed font-sans">
                Please place your character video assets inside the <code className="text-cyan-300 font-mono">/assets</code> directory of your workspace named exactly:
              </p>
              <div className="mt-3 space-y-1.5 text-left font-mono text-[10px] text-cyan-200 bg-white/5 px-4 py-2.5 rounded-xl border border-white/5">
                <div>• idle.mp4 (State: Idle)</div>
                <div>• thinking.mp4 (State: Thinking Intro)</div>
                <div>• thinking_continuous.mp4 (State: Thinking Loop)</div>
                <div>• talking.mp4 (State: Talking)</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Foreground Hover-Responsive Canvas for glowing particles (Holographic Overlay Z-index 20) */}
      <canvas
        id="aria-hologram-living-canvas"
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
      />
    </div>
  );
};
