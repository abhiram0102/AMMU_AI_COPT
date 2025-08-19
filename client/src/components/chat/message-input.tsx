import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChat } from "@/store/chat";
import { useVoice } from "@/hooks/use-voice";
import { useEmotionalState } from "@/store/emotional-state";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface MessageInputProps {
  audioInitialized: boolean;
  audioContext: AudioContext | null;
}

export default function MessageInput({ audioInitialized, audioContext }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { sendMessage } = useChat();
  const { isListening, toggleListening, isActive } = useVoice(audioContext);
  const { emotionalState } = useEmotionalState();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    try {
      await sendMessage(message.trim(), {
        voiceInput: false,
        emotionalTone: emotionalState.currentMood
      });
      setMessage("");
      
      // Auto-resize textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      toast({
        title: "Error sending message",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 50MB",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      await api.uploadFile('/api/protected/rag/ingest', file, {
        title: file.name,
        tags: ['uploaded-via-chat']
      });
      
      toast({
        title: "Document uploaded",
        description: `${file.name} has been processed and added to the knowledge base`,
      });

      // Auto-send a message about the upload
      await sendMessage(`I just uploaded "${file.name}". Can you tell me what you learned from it?`);
      
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, sendMessage]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e.target.files);
    // Reset input value to allow same file to be selected again
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  const getVoiceButtonTooltip = () => {
    if (!isActive) return "Voice disabled - Check microphone permissions";
    if (isListening) return "Listening... Click to stop";
    return `Click to start voice input or say "Hey Ammu"`;
  };

  return (
    <div 
      className={`border-t border-white/10 p-6 transition-all duration-300 ${
        isDragOver ? 'bg-cyber-blue/10 border-cyber-blue/50' : ''
      }`} 
      data-testid="message-input"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 bg-cyber-blue/20 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
          <div className="text-center">
            <i className="fas fa-cloud-upload-alt text-cyber-blue text-4xl mb-2" />
            <p className="text-white font-medium">Drop your files here</p>
            <p className="text-gray-400 text-sm">Supported: PDF, MD, TXT, LOG, images</p>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="glass rounded-lg p-4">
          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  isListening ? "Listening for voice input..." :
                  emotionalState.bondLevel > 50 ? "What's on your mind? Ammu is here to help!" :
                  "Ask Ammu anything about cybersecurity, or just say 'Hey Ammu' for voice input..."
                }
                className="w-full bg-transparent text-white placeholder-gray-400 border-none outline-none resize-none font-mono min-h-[2.5rem] max-h-[200px]"
                disabled={isLoading || isListening}
                data-testid="textarea-message"
                style={{ height: 'auto' }}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Upload Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="p-2 glass rounded-lg hover:bg-white/5 transition-colors border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-upload"
                title="Upload document (PDF, MD, TXT, LOG, images)"
              >
                <i className={`fas fa-paperclip text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              
              {/* Voice Input Toggle */}
              <button
                type="button"
                onClick={toggleListening}
                disabled={!isActive || !audioInitialized}
                className={`p-2 glass rounded-lg border transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isListening 
                    ? 'border-cyber-green/50 text-cyber-green hover:bg-cyber-green/10 scale-110 animate-pulse'
                    : isActive
                    ? 'border-cyber-blue/50 text-cyber-blue hover:bg-cyber-blue/10'
                    : 'border-gray-500 text-gray-400'
                }`}
                data-testid="button-voice-input"
                title={getVoiceButtonTooltip()}
              >
                <i className={`fas fa-microphone ${isListening ? 'animate-pulse' : ''}`} />
              </button>
              
              {/* Send Button */}
              <Button
                type="submit"
                disabled={!message.trim() || isLoading}
                className="px-4 py-2 bg-gradient-to-r from-cyber-blue to-cyber-green text-black rounded-lg font-medium hover:shadow-lg hover:shadow-cyber-blue/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-send"
              >
                {isLoading ? (
                  <i className="fas fa-spinner animate-spin" />
                ) : (
                  <>
                    <i className="fas fa-paper-plane mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {/* Status Bar */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center space-x-3 text-xs text-gray-400">
              <span>⌘K for commands</span>
              <span>•</span>
              <span>⌘U to upload</span>
              <span>•</span>
              <span>Voice: {isActive ? 'Say "Hey Ammu"' : 'Disabled'}</span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              {/* Emotional State Indicator */}
              <div className="flex items-center space-x-1">
                <i className="fas fa-heart text-pink-400" />
                <span className="text-gray-400">
                  Bond: <span className="text-pink-400">{emotionalState.bondLevel}%</span>
                </span>
              </div>
              <div className="text-gray-400">•</div>
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${
                  isListening ? 'bg-cyber-green animate-pulse' : 
                  isActive ? 'bg-cyber-blue' : 'bg-gray-500'
                }`} />
                <span className={isListening ? 'text-cyber-green' : isActive ? 'text-cyber-blue' : 'text-gray-400'}>
                  {isListening ? 'Listening' : isActive ? 'Voice Ready' : 'Voice Off'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>
      
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.md,.txt,.log,.png,.jpg,.jpeg,.json,.csv"
        className="hidden"
        onChange={handleFileInputChange}
        multiple={false}
      />
    </div>
  );
}
