import { create } from "zustand";
import { persist } from "zustand/middleware";

interface VoiceStore {
  isListening: boolean;
  isActive: boolean;
  wakeWordDetected: boolean;
  audioLevel: number;
  lastTranscription: string;
  voiceSettings: {
    wakeWordEnabled: boolean;
    voiceSpeed: number;
    voicePitch: number;
    language: string;
    autoStart: boolean;
  };
  
  setListening: (listening: boolean) => void;
  setActive: (active: boolean) => void;
  setWakeWordDetected: (detected: boolean) => void;
  setAudioLevel: (level: number) => void;
  setLastTranscription: (transcription: string) => void;
  updateVoiceSettings: (settings: Partial<VoiceStore['voiceSettings']>) => void;
  resetVoiceState: () => void;
}

const defaultVoiceSettings = {
  wakeWordEnabled: true,
  voiceSpeed: 1.0,
  voicePitch: 1.0,
  language: 'en-US',
  autoStart: true
};

export const useVoiceStore = create<VoiceStore>()(
  persist(
    (set, get) => ({
      isListening: false,
      isActive: false,
      wakeWordDetected: false,
      audioLevel: 0,
      lastTranscription: "",
      voiceSettings: defaultVoiceSettings,
      
      setListening: (listening: boolean) => {
        set({ isListening: listening });
        
        // Reset audio level when stopping
        if (!listening) {
          set({ audioLevel: 0 });
        }
      },
      
      setActive: (active: boolean) => {
        set({ isActive: active });
        
        // If deactivating, also stop listening and reset states
        if (!active) {
          set({ 
            isListening: false, 
            wakeWordDetected: false, 
            audioLevel: 0 
          });
        }
      },
      
      setWakeWordDetected: (detected: boolean) => {
        set({ wakeWordDetected: detected });
        
        // Auto-clear wake word detection after a delay
        if (detected) {
          setTimeout(() => {
            const currentState = get();
            if (currentState.wakeWordDetected) {
              set({ wakeWordDetected: false });
            }
          }, 3000);
        }
      },
      
      setAudioLevel: (level: number) => {
        // Clamp level between 0 and 1
        const clampedLevel = Math.max(0, Math.min(1, level));
        set({ audioLevel: clampedLevel });
      },
      
      setLastTranscription: (transcription: string) => {
        set({ lastTranscription: transcription });
      },
      
      updateVoiceSettings: (newSettings) => {
        set(state => ({
          voiceSettings: { ...state.voiceSettings, ...newSettings }
        }));
      },
      
      resetVoiceState: () => {
        set({
          isListening: false,
          wakeWordDetected: false,
          audioLevel: 0,
          lastTranscription: ""
          // Keep isActive and voiceSettings
        });
      }
    }),
    {
      name: "voice-settings-storage",
      // Only persist settings, not transient state
      partialize: (state) => ({
        voiceSettings: state.voiceSettings
      })
    }
  )
);
