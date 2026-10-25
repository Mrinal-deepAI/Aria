import React, { useRef, useState, useEffect } from 'react';
import { useVoiceAuth } from '../hooks/useVoiceAuth';
import { getGreeting } from '../utils/voiceResponses';

export const VoiceAuthenticator: React.FC = () => {
  const {
    currentUser,
    isEnrolled,
    startListening,
    enrollVoice
  } = useVoiceAuth();

  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  // Auto-enroll and start on first click anywhere in the app (to bypass browser autoplay restrictions)
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!hasStarted) {
        setHasStarted(true);
        if (!isEnrolled && audioRef.current) {
          enrollVoice(audioRef.current);
          // After a delay to allow enrollment, start listening
          setTimeout(() => {
            startListening();
          }, 3000);
        } else if (isEnrolled) {
          startListening();
        }
      }
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    return () => window.removeEventListener('click', handleFirstInteraction);
  }, [hasStarted, isEnrolled, enrollVoice, startListening]);

  // Log the current user for debugging or integration with the main Aria system
  useEffect(() => {
    if (hasStarted) {
      console.log(`[Voice Auth] Current Speaker: ${currentUser}`);
    }
  }, [currentUser, hasStarted]);

  return (
    <audio ref={audioRef} src="/For Aria.mp4" className="hidden" />
  );
};
