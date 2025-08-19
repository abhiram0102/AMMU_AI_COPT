import { useState, useEffect, useCallback, useRef } from "react";
import { useVoiceStore } from "@/store/voice";
import { useChat } from "@/store/chat";
import { useEmotionalState } from "@/store/emotional-state";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface VoiceRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface VoiceRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useVoice(audioContext: AudioContext | null) {
  const { 
    isListening, 
    isActive, 
    setListening, 
    setActive,
    wakeWordDetected,
    setWakeWordDetected,
    setAudioLevel,
    setLastTranscription
  } = useVoiceStore();
  
  const { sendMessage } = useChat();
  const { emotionalState, updateEmotionalState } = useEmotionalState();
  const { toast } = useToast();
  
  // Shared singletons across all hook consumers
  // This prevents multiple components from creating separate instances that are unaware of each other
  // and eliminates "voice not ready" when one instance initializes but another tries to start.
  // eslint-disable-next-line module-scoped-variables
  let _global = (window as any).__voiceSingletons || ((window as any).__voiceSingletons = {});
  if (_global.recognition === undefined) _global.recognition = null as SpeechRecognition | null;
  if (_global.mediaRecorder === undefined) _global.mediaRecorder = null as MediaRecorder | null;
  if (_global.recognitionActiveRef === undefined) _global.recognitionActiveRef = { current: false } as { current: boolean };
  if (_global.initialized === undefined) _global.initialized = false as boolean;
  if (_global.stream === undefined) _global.stream = null as MediaStream | null;
  const recognition: SpeechRecognition | null = _global.recognition;
  const mediaRecorder: MediaRecorder | null = _global.mediaRecorder;

  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wakeWordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionActiveRef = _global.recognitionActiveRef as { current: boolean };
  const lastRecognitionErrorRef = useRef<string | null>(null);
  const lastRestartAtRef = useRef<number>(0);



  const initializeVoice = useCallback(async () => {
    if (_global.initialized) {
      // Already initialized, no-op
      return;
    }
    try {
      // Check for browser support
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn('Speech recognition not supported');
        toast({
          title: "Voice not supported",
          description: "Your browser doesn't support speech recognition",
          variant: "destructive"
        });
        return;
      }

      // Request microphone permissions
      const stream = _global.stream || await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      _global.stream = stream;

      if (!_global.recognition) {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
          console.error('Speech recognition API not available');
          return;
        }
        _global.recognition = new SpeechRecognitionAPI();
      }
      const recognitionInstance = _global.recognition as SpeechRecognition;
      
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      recognitionInstance.maxAlternatives = 1;

      recognitionInstance.onstart = () => {
        console.log('Wake word detection started');
        recognitionActiveRef.current = true;
      };
      
      recognitionInstance.onresult = (event: VoiceRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .slice(event.resultIndex)
          .map(result => result[0].transcript)
          .join('')
          .toLowerCase();
        
        // Check for wake words
        const wakeWords = ['hey ammu', 'ammu', 'hello ammu'];
        const isWakeWord = wakeWords.some(word => transcript.includes(word));
        
        if (isWakeWord) {
          setWakeWordDetected(true);
          
          // Clear any existing timeout
          if (wakeWordTimeoutRef.current) {
            clearTimeout(wakeWordTimeoutRef.current);
          }
          
          // Auto-start listening after wake word detection
          wakeWordTimeoutRef.current = setTimeout(() => {
            startListening();
            setWakeWordDetected(false);
          }, 500);

          // Update emotional bond for voice interaction
          updateEmotionalState({
            bondLevel: Math.min(100, emotionalState.bondLevel + 1),
            currentMood: 'engaged'
          });
        }
      };
      
      recognitionInstance.onerror = (event: VoiceRecognitionErrorEvent) => {
        console.error('Wake word recognition error:', event.error);
        lastRecognitionErrorRef.current = event.error || null;
        if (event.error === 'not-allowed') {
          toast({
            title: "Microphone access denied",
            description: "Please allow microphone access for voice features",
            variant: "destructive"
          });
          setActive(false);
        }
        recognitionActiveRef.current = false;
      };

      recognitionInstance.onend = () => {
        // Mark recognition as inactive
        recognitionActiveRef.current = false;
        // Restart wake word detection if still active and not already running
        const now = Date.now();
        const cooldownElapsed = now - (lastRestartAtRef.current || 0) > 1500;
        const shouldRestart =
          isActive &&
          !isListening &&
          document.visibilityState === 'visible' &&
          lastRecognitionErrorRef.current !== 'aborted' &&
          cooldownElapsed;
        if (shouldRestart) {
          setTimeout(() => {
            if (!recognitionActiveRef.current) {
              try {
                recognitionInstance.start();
                lastRestartAtRef.current = Date.now();
              } catch (error) {
                console.warn('Failed to restart wake word detection:', error);
              }
            }
          }, 4000);
        }
      };
      
      _global.recognition = recognitionInstance;
      
      // Initialize MediaRecorder for high-quality audio capture with fallbacks
      let recorder: MediaRecorder | null = null;
      const tryMimeTypes = ['audio/webm;codecs=opus', 'audio/webm', ''];
      for (const mt of tryMimeTypes) {
        try {
          recorder = mt
            ? new MediaRecorder(stream, { mimeType: mt, audioBitsPerSecond: 64000 })
            : new MediaRecorder(stream, { audioBitsPerSecond: 64000 });
          console.log('MediaRecorder initialized with mimeType:', mt || 'default');
          break;
        } catch (e) {
          console.warn('Failed to init MediaRecorder with', mt || 'default', e);
        }
      }
      if (!recorder) {
        throw new Error('MediaRecorder is not supported in this browser');
      }
      _global.mediaRecorder = recorder;

      if (!audioContext) {
        console.error('Audio context not initialized');
        return;
      }
      const context = audioContext;
      
      // Start wake word detection (guard against duplicate starts) only after recorder ready
      if (!recognitionActiveRef.current) {
        try {
          recognitionInstance.start();
          recognitionActiveRef.current = true;
        } catch (error) {
          console.warn('Recognition already started, skipping start.');
        }
      }
      setActive(true);
      _global.initialized = true;
      
      console.log('Voice system initialized successfully');
      
    } catch (error) {
      console.error('Voice initialization error:', error);
      toast({
        title: "Voice setup failed",
        description: "Unable to access microphone. Please check permissions and try again.",
        variant: "destructive"
      });
      setActive(false);
      _global.initialized = false;
    }
  }, [isActive, isListening, setActive, setWakeWordDetected, toast, emotionalState.bondLevel, updateEmotionalState]);

  const startListening = useCallback(async () => {
    if (!_global.mediaRecorder && audioContext) {
      // Try to initialize on-demand
      await initializeVoice();
    }
    if (!_global.mediaRecorder || !audioContext) {
      toast({
        title: "Voice not ready",
        description: "Please enable voice and allow microphone access",
        variant: "destructive"
      });
      return;
    }
    
    setListening(true);
    setLastTranscription("");
    
    const audioChunks: BlobPart[] = [];
    let totalBytes = 0;
    const MAX_BYTES = 300 * 1024; // ~300 KB cap to avoid 413
    
    const mediaRecorder = _global.mediaRecorder as MediaRecorder;
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        totalBytes += event.data.size;
        if (totalBytes > MAX_BYTES && mediaRecorder.state === 'recording') {
          console.warn('Stopping early to keep payload under server limit');
          toast({
            title: 'Recording stopped',
            description: 'Keeping audio short to avoid server upload limit',
            variant: 'default'
          });
          try { mediaRecorder.stop(); } catch {}
        }
      }
    };
    
    mediaRecorder.onstop = async () => {
      try {
        // Build blob and trim if needed
        let blob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
        if (blob.size > MAX_BYTES) {
          const trimmedChunks: BlobPart[] = [];
          let size = 0;
          for (const part of audioChunks) {
            const partSize = (part as Blob).size ?? (typeof part === 'string' ? part.length : 0);
            if (size + partSize > MAX_BYTES) break;
            trimmedChunks.push(part);
            size += partSize;
          }
          blob = new Blob(trimmedChunks, { type: 'audio/webm;codecs=opus' });
          console.warn('Trimmed audio blob to', blob.size, 'bytes');
        }

        // Try multipart upload first
        let transcription: string | undefined;
        let emotionalTone: string | undefined;
        let confidence: number | undefined;
        try {
          const form = new FormData();
          form.append('file', blob, 'audio.webm');
          form.append('mimeType', blob.type || 'audio/webm');

          const response = await api.post('/api/protected/voice/transcribe', form, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          ({ transcription, emotionalTone, confidence } = response.data || {});
        } catch (multiErr: any) {
          // Fallback to JSON base64 if server expects audioData
          const msg = typeof multiErr?.message === 'string' ? multiErr.message : '';
          // Convert to base64 and resend
          const reader = new FileReader();
          const asBase64: string = await new Promise((resolve, reject) => {
            reader.onerror = () => reject(new Error('Failed to read audio blob'));
            reader.onloadend = () => {
              try {
                const b64 = String(reader.result).split(',')[1];
                resolve(b64);
              } catch (e) { reject(e); }
            };
            reader.readAsDataURL(blob);
          });
          const resp = await api.post('/api/protected/voice/transcribe', { audioData: asBase64 });
          ({ transcription, emotionalTone, confidence } = resp.data || {});
        }

        // Use extracted values
        if (transcription && transcription.trim()) {
          setLastTranscription(transcription);
          try {
            await sendMessage(transcription, {
              voiceInput: true,
              emotionalTone: emotionalTone || 'neutral'
            });
          } catch (sendErr) {
            console.error('Failed to send transcribed message:', sendErr);
            toast({
              title: 'Error sending message',
              description: 'Could not send transcribed voice message.',
              variant: 'destructive'
            });
          }

          updateEmotionalState({
            bondLevel: Math.min(100, emotionalState.bondLevel + 0.5),
            trustLevel: Math.min(1, emotionalState.trustLevel + 0.01)
          });
          toast({
            title: 'Voice processed',
            description: `Confidence: ${Math.round(((confidence ?? 0) as number) * 100)}%`,
          });
        } else {
          toast({
            title: 'No speech detected',
            description: 'Please try speaking more clearly',
            variant: 'destructive'
          });
        }
      } catch (err) {
        console.error('Voice processing error:', err);
        toast({
          title: 'Voice processing failed',
          description: String(err),
          variant: 'destructive'
        });
      }
    };

    try {
      mediaRecorder.start(250); // ms
      // Auto-stop after 4 seconds to keep payload small
      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          stopListening();
        }
      }, 4000);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      setListening(false);
      toast({
        title: 'Recording failed',
        description: 'Unable to start voice recording',
        variant: 'destructive'
      });
    }
  }, [mediaRecorder, audioContext, setListening, setLastTranscription, sendMessage, emotionalState, updateEmotionalState, toast]);

  const stopListening = useCallback(() => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    
    const mediaRecorder = _global.mediaRecorder as MediaRecorder | null;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    setListening(false);
    setAudioLevel(0);
  }, [initializeVoice, audioContext, setListening, setAudioLevel]);

  const toggleListening = useCallback(() => {
    if (!isActive) {
      toast({
        title: "Voice not active",
        description: "Voice system is not initialized. Please check permissions.",
        variant: "destructive"
      });
      return;
    }
    
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isActive, isListening, startListening, stopListening, toast]);

  // Initialize and cleanup speech recognition
  useEffect(() => {
    let recognitionInstance: SpeechRecognition | null = null;
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        recognitionInstance = _global.recognition ?? new SpeechRecognitionAPI();
        _global.recognition = recognitionInstance;
      }
    }

    return () => {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
      const mediaRecorder = _global.mediaRecorder as MediaRecorder | null;
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (wakeWordTimeoutRef.current) {
        clearTimeout(wakeWordTimeoutRef.current);
      }
    };
  }, [mediaRecorder]);

  return {
    isListening,
    isActive,
    wakeWordDetected,
    initializeVoice,
    startListening,
    stopListening,
    toggleListening,
    audioLevel: useVoiceStore.getState().audioLevel, // Directly get latest state
    lastTranscription: useVoiceStore.getState().lastTranscription,
    recognition: _global.recognition as SpeechRecognition | null,
    audioContext
  };
}
