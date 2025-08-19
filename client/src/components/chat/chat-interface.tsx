import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "@/store/chat";
import { useAuth } from "@/lib/auth";
import MessageInput from "./message-input";
import ToolExecutionPanel from "./tool-execution-panel";
import AgentPlanTimeline from "@/components/ui/agent-plan-timeline";
import { Button } from "@/components/ui/button";

// ========== TYPE DEFINITIONS ==========
interface ChatInterfaceProps {
  onInitAudio: () => void;
  audioInitialized: boolean;
  audioContext: AudioContext | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  toolCalls?: any[];
  metadata?: {
    emotionalTone?: string;
    sources?: string[];
    ragUsed?: boolean;
    voiceInput?: boolean;
  };
}

interface ChatMessageProps {
  message: Message;
  currentPlan: any;
}

// ========== HELPER COMPONENTS ==========
const WelcomeScreen = () => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center max-w-md">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyber-blue to-cyber-green flex items-center justify-center">
        <i className="fas fa-brain text-white text-2xl" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">Welcome to AI Copilot</h3>
      <p className="text-gray-400 mb-4">Your cybersecurity companion Ammu is ready to assist</p>
    </div>
  </div>
);

const LoadingIndicator = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="glass rounded-lg p-8 text-center">
      <div className="w-8 h-8 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyber-blue to-cyber-green animate-pulse" />
      <p className="text-gray-400">Loading conversation...</p>
    </div>
  </div>
);

const ChatMessage = ({ message, currentPlan }: ChatMessageProps) => {
  const { user } = useAuth();

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  if (message.role === "assistant") {
    return (
      <div className="flex space-x-4" data-testid={`message-assistant-${message.id}`}>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyber-blue to-cyber-green flex items-center justify-center flex-shrink-0">
          <i className="fas fa-brain text-white text-sm" />
        </div>
        <div className="flex-1">
          <div className="glass rounded-lg p-4 glow-border">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-sm font-medium text-cyber-blue">Ammu</span>
              <span className="text-xs text-gray-500">{formatTimeAgo(message.createdAt)}</span>
            </div>
            <div className="prose prose-invert max-w-none">
              <div className="text-white whitespace-pre-wrap">{message.content}</div>
              {message.toolCalls && message.toolCalls.length > 0 && (
                <ToolExecutionPanel toolCalls={message.toolCalls} messageId={message.id} />
              )}
              {currentPlan && <AgentPlanTimeline plan={currentPlan.steps} />}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end space-x-4" data-testid={`message-user-${message.id}`}>
      <div className="flex-1 max-w-2xl">
        <div className="glass rounded-lg p-4 ml-12">
          <p className="text-white">{message.content}</p>
          <div className="flex items-center justify-end mt-2 text-xs text-gray-400">
            <span>{formatTimeAgo(message.createdAt)}</span>
          </div>
        </div>
      </div>
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
        <span className="text-white text-sm font-semibold">
          {user ? user.username.charAt(0).toUpperCase() : 'U'}
        </span>
      </div>
    </div>
  );
};

// ========== MAIN COMPONENT ==========
export default function ChatInterface({ onInitAudio, audioInitialized, audioContext }: ChatInterfaceProps) {
  const { currentSessionId, messages, currentPlan } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: sessionMessages, isLoading } = useQuery({
    queryKey: ["/api/protected/sessions", currentSessionId, "messages"],
    enabled: !!currentSessionId && !!localStorage.getItem('auth_token'),
    refetchInterval: 2000,
    staleTime: 1000
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessionMessages, messages]);

  const allMessages = Array.isArray(sessionMessages) ? sessionMessages : messages;

  const renderContent = () => {
    if (!audioInitialized) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-gray-400 mb-4">Voice features are currently disabled.</p>
          <Button onClick={onInitAudio}>Enable Voice</Button>
        </div>
      );
    }

    if (isLoading && currentSessionId) {
      return <LoadingIndicator />;
    }

    if (allMessages.length === 0) {
      return <WelcomeScreen />;
    }

    return allMessages.map((message: Message) => (
      <ChatMessage key={message.id} message={message} currentPlan={currentPlan} />
    ));
  };

  return (
    <div className="flex-1 flex flex-col" data-testid="chat-interface">
      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        {renderContent()}
        <div ref={messagesEndRef} />
      </div>
      <MessageInput audioInitialized={audioInitialized} audioContext={audioContext} />
    </div>
  );
}
