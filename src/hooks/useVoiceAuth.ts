import { useState, useEffect, useRef } from 'react';
import { 
  loadVoiceProfile, 
  saveVoiceProfile, 
  AudioSignatureBuilder, 
  calculateCosineSimilarity 
} from '../utils/audioMatcher';

const KNOWN_USER = "Mrinal";
const SIMILARITY_THRESHOLD = 0.92; // 92% confidence

export function useVoiceAuth() {
  const [currentUser, setCurrentUser] = useState<string>("Unknown");
  const [confidenceScore, setConfidenceScore] = useState<number>(0);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isEnrolled, setIsEnrolled] = useState<boolean>(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const signatureBuilderRef = useRef<AudioSignatureBuilder | null>(null);
  const animationFrameRef = useRef<number>(0);
  const profileRef = useRef<number[] | null>(null);

  // Initialize and load saved profile
  useEffect(() => {
    const savedProfile = loadVoiceProfile(KNOWN_USER);
    if (savedProfile && savedProfile.length > 0) {
      profileRef.current = savedProfile;
      setIsEnrolled(true);
    }
  }, []);

  // Enroll a new voice profile from an HTMLAudioElement
  const enrollVoice = (audioElement: HTMLAudioElement) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Resume audio context if it was suspended (browser policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    // Create source from the audio element
    const source = audioContextRef.current.createMediaElementSource(audioElement);
    
    // We also need to connect it to destination so the user can hear it if they want
    // But since it's just for enrollment, we can just connect it to our analyser and destination
    source.connect(audioContextRef.current.destination);
    
    const builder = new AudioSignatureBuilder(audioContextRef.current, source);
    
    const extractFrame = () => {
      builder.recordSample();
      if (!audioElement.paused && !audioElement.ended) {
        requestAnimationFrame(extractFrame);
      } else {
        const signature = builder.getSignature();
        if (signature.length > 0) {
          saveVoiceProfile(KNOWN_USER, signature);
          profileRef.current = signature;
          setIsEnrolled(true);
          console.log("Enrollment successful!");
        }
      }
    };
    
    audioElement.play().then(() => {
      extractFrame();
    }).catch(e => console.error("Enrollment play error:", e));
  };

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const builder = new AudioSignatureBuilder(audioContextRef.current, source);
      signatureBuilderRef.current = builder;
      setIsListening(true);
      
      const analyzeFrame = () => {
        builder.recordSample();
        
        // Every ~1 second (assuming 60fps), evaluate similarity if there is a profile
        if (profileRef.current && builder.getSignature().length > 0) {
          const currentSignature = builder.getSignature();
          const similarity = calculateCosineSimilarity(profileRef.current, currentSignature);
          
          setConfidenceScore(Math.round(similarity * 100));
          
          if (similarity >= SIMILARITY_THRESHOLD) {
            setCurrentUser(KNOWN_USER);
          } else if (similarity > 0.1) { 
            // Avoid changing to Unknown on silence, only on actual different voice
            setCurrentUser("Unknown");
          }
          
          // Reset builder frequently to evaluate short phrases
          if (Math.random() < 0.05) { // Reset approx every 20 frames
             builder.reset();
          }
        }
        
        animationFrameRef.current = requestAnimationFrame(analyzeFrame);
      };
      
      analyzeFrame();
      
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopListening = () => {
    setIsListening(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    currentUser,
    confidenceScore,
    isListening,
    isEnrolled,
    startListening,
    stopListening,
    enrollVoice
  };
}
