import { create } from "zustand";
import { api } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  metadata?: {
    voiceInput?: boolean;
    emotionalTone?: string;
    sources?: string[];
    ragUsed?: boolean;
    confidence?: number;
  };
  toolCalls?: Array<{
    toolName: string;
    arguments: any;
    status: "pending" | "approved" | "executed" | "failed";
    riskLevel: "low" | "medium" | "high";
    result?: any;
    error?: string;
  }>;
}

interface AgentPlan {
  goal: string;
  steps: Array<{
    id: string;
    description: string;
    status: "pending" | "executing" | "completed" | "failed" | "skipped";
    toolName?: string;
    arguments?: any;
    requiresApproval?: boolean;
    riskLevel?: "low" | "medium" | "high";
    result?: any;
    error?: string;
  }>;
  currentStep: number;
  status: "planning" | "executing" | "completed" | "failed";
  riskAssessment: "low" | "medium" | "high";
}

interface ChatStore {
  messages: Message[];
  currentSessionId: string | null;
  currentPlan: AgentPlan | null;
  isLoading: boolean;
  error: string | null;
  
  sendMessage: (content: string, options?: { voiceInput?: boolean; emotionalTone?: string }) => Promise<void>;
  setCurrentSession: (sessionId: string) => void;
  clearChat: () => void;
  addMessage: (message: Message) => void;
  updatePlan: (plan: AgentPlan) => void;
  approveToolExecution: (toolRunId: string) => Promise<void>;
  setError: (error: string | null) => void;
  retryLastMessage: () => Promise<void>;
}

export const useChat = create<ChatStore>((set, get) => ({
  messages: [],
  currentSessionId: null,
  currentPlan: null,
  isLoading: false,
  error: null,

  sendMessage: async (content: string, options = {}) => {
    const { voiceInput = true , emotionalTone } = options;
    
    set({ isLoading: true, error: null });

    const tempId = `temp-${Date.now()}`;
    
    try {
      // Add user message immediately with temporary ID
      const userMessage: Message = {
        id: tempId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
        metadata: { voiceInput, emotionalTone }
      };
      
      set(state => ({
        messages: [...state.messages, userMessage]
      }));

      // Send to backend
      const response = await api.post('/api/protected/chat/message', {
        content,
        sessionId: get().currentSessionId, // Let backend handle session creation
        voiceInput,
        emotionalTone
      });

      const data = response?.data ?? {};
      const nextSessionId = data.sessionId ?? get().currentSessionId ?? null;
      const nextPlan = data.agentPlan ?? get().currentPlan ?? null;

      // Normalize messages from various possible shapes
      const normalized: Message[] = [];
      if (data.userMessage && data.assistantMessage) {
        normalized.push(data.userMessage, data.assistantMessage);
      } else if (Array.isArray(data.messages) && data.messages.length) {
        normalized.push(...data.messages);
      } else if (typeof data.assistant === 'string' && data.assistant.trim()) {
        normalized.push({
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: data.assistant,
          createdAt: new Date().toISOString()
        });
      } else {
        // Ensure at least echo the user message back if backend didn't return messages
        normalized.push({
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          createdAt: new Date().toISOString(),
          metadata: { voiceInput, emotionalTone }
        });
      }

      // Update with real messages and session info
      set(state => ({
        messages: [
          ...state.messages.filter(m => m.id !== tempId),
          ...normalized
        ],
        currentSessionId: nextSessionId,
        currentPlan: nextPlan
      }));

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove the temporary message on error
      set(state => ({
        messages: state.messages.filter(m => m.id !== tempId),
        error: error instanceof Error ? error.message : 'Failed to send message'
      }));
      
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  retryLastMessage: async () => {
    const { messages } = get();
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    
    if (lastUserMessage) {
      await get().sendMessage(lastUserMessage.content, lastUserMessage.metadata);
    }
  },

  approveToolExecution: async (toolRunId: string) => {
    try {
      set({ isLoading: true, error: null });
      
      const response = await api.post(`/api/protected/tools/${toolRunId}/approve`);
      
      // Update the current plan or messages with the tool execution result
      set(state => {
        const updatedMessages = state.messages.map(message => {
          if (message.toolCalls) {
            const updatedToolCalls = message.toolCalls.map(tool => {
              if (tool.status === 'pending') {
                return {
                  ...tool,
                  status: 'executed' as const,
                  result: response.data.result
                };
              }
              return tool;
            });
            return { ...message, toolCalls: updatedToolCalls };
          }
          return message;
        });

        return { messages: updatedMessages };
      });
      
    } catch (error) {
      console.error('Tool approval error:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to approve tool execution' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  setCurrentSession: (sessionId: string) => {
    set({ currentSessionId: sessionId, messages: [], currentPlan: null, error: null });
  },

  clearChat: () => {
    set({ 
      messages: [], 
      currentSessionId: null, 
      currentPlan: null, 
      error: null,
      isLoading: false 
    });
  },

  addMessage: (message: Message) => {
    set(state => ({
      messages: [...state.messages, message]
    }));
  },

  updatePlan: (plan: AgentPlan) => {
    set({ currentPlan: plan });
  },

  setError: (error: string | null) => {
    set({ error });
  }
}));
