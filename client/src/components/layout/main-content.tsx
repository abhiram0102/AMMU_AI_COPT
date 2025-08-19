import { useVoice } from "@/hooks/use-voice";
import { useEmotionalState } from "@/store/emotional-state";
import { useChat } from "@/store/chat";
import ChatInterface from "@/components/chat/chat-interface";

export default function MainContent({ onInitAudio, audioInitialized, audioContext }: { onInitAudio: () => void; audioInitialized: boolean; audioContext: AudioContext | null; }) {
  const { toggleListening, isListening, isActive } = useVoice(audioContext);
  const { emotionalState } = useEmotionalState();
  const { currentPlan } = useChat();

  return (
    <div className="flex-1 flex flex-col" data-testid="main-content">
      {/* Top Header */}
      <header className="glass border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold">Chat & RAG Workspace</h2>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-cyber-green rounded-full animate-pulse" />
              <span>AI Agent Active</span>
            </div>
            
            {/* Current Plan Indicator */}
            {currentPlan && (
              <div className="flex items-center space-x-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${
                  currentPlan.status === 'executing' ? 'bg-cyber-blue animate-pulse' :
                  currentPlan.status === 'completed' ? 'bg-cyber-green' :
                  currentPlan.status === 'failed' ? 'bg-cyber-red' :
                  'bg-cyber-amber'
                }`} />
                <span className="text-gray-300">
                  Plan: {currentPlan.goal.substring(0, 30)}...
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Emotional State Indicator */}
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <i className="fas fa-heart text-pink-400" />
              <span>Bond: {emotionalState.bondLevel}%</span>
            </div>
            
            {/* Command Palette Trigger */}
            <button 
              className="flex items-center space-x-2 px-3 py-2 rounded-lg glass border border-white/20 hover:border-cyber-blue/50 transition-colors"
              data-testid="button-command-palette"
              onClick={() => {
                const event = new KeyboardEvent('keydown', {
                  key: 'k',
                  metaKey: true,
                  bubbles: true
                });
                document.dispatchEvent(event);
              }}
            >
              <i className="fas fa-search text-cyber-blue" />
              <span className="text-sm text-gray-400">⌘K</span>
            </button>
            
            {/* Voice Control Toggle */}
            <button 
              onClick={toggleListening}
              className={`p-2 rounded-lg glass border transition-all duration-300 ${
                isListening 
                  ? 'border-cyber-green/50 text-cyber-green hover:bg-cyber-green/10 scale-110'
                  : isActive
                  ? 'border-cyber-blue/50 text-cyber-blue hover:bg-cyber-blue/10'
                  : 'border-gray-500 text-gray-400 hover:bg-white/5'
              }`}
              data-testid="button-voice-toggle"
              disabled={!isActive}
            >
              <i className={`fas fa-microphone ${isListening ? 'animate-pulse' : ''}`} />
            </button>
            
            {/* Settings */}
            <button 
              className="p-2 rounded-lg glass hover:bg-white/5 transition-colors"
              data-testid="button-settings"
            >
              <i className="fas fa-cog text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      <ChatInterface onInitAudio={onInitAudio} audioInitialized={audioInitialized} audioContext={audioContext} />
    </div>
  );
}
