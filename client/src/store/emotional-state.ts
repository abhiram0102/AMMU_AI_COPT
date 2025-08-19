import { create } from "zustand";
import { useEffect } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

interface EmotionalState {
  bondLevel: number;
  currentMood: string;
  trustLevel: number;
  personalityTraits: string[];
  preferredCommunicationStyle: string;
}

interface EmotionalStore {
  emotionalState: EmotionalState;
  isUpdating: boolean;
  updateEmotionalState: (updates: Partial<EmotionalState>) => Promise<void>;
  syncWithServer: () => Promise<void>;
  resetEmotionalState: () => void;
}

const defaultEmotionalState: EmotionalState = {
  bondLevel: 0,
  currentMood: "neutral",
  trustLevel: 0.5,
  personalityTraits: [],
  preferredCommunicationStyle: "professional"
};

export const useEmotionalStore = create<EmotionalStore>((set, get) => ({
  emotionalState: defaultEmotionalState,
  isUpdating: false,
  
  updateEmotionalState: async (updates: Partial<EmotionalState>) => {
    const currentState = get().emotionalState;
    const newState = { ...currentState, ...updates };
    
    // Update local state immediately for responsiveness
    set({ emotionalState: newState, isUpdating: true });
    
    try {
      // Sync with server
      await api.put('/api/protected/profile', {
        emotionalState: newState
      });
    } catch (error) {
      console.error('Failed to sync emotional state:', error);
      // Revert local state on error
      set({ emotionalState: currentState });
    } finally {
      set({ isUpdating: false });
    }
  },
  
  syncWithServer: async () => {
    try {
      set({ isUpdating: true });
      const response = await api.get('/api/protected/profile');
      
      if (response.emotionalState) {
        set({ emotionalState: response.emotionalState });
      }
    } catch (error) {
      console.error('Failed to sync emotional state from server:', error);
    } finally {
      set({ isUpdating: false });
    }
  },
  
  resetEmotionalState: () => {
    set({ emotionalState: defaultEmotionalState });
  }
}));

export function useEmotionalState() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { 
    emotionalState, 
    isUpdating, 
    updateEmotionalState, 
    syncWithServer 
  } = useEmotionalStore();

  // Sync with user's emotional state from backend
  const { data: emotionalStateData } = useQuery<any, Error, EmotionalState>({
    queryKey: ['/api/protected/profile', 'emotional-state'],
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
    select: (data) => data.emotionalState
  });

  useEffect(() => {
    if (emotionalStateData) {
      useEmotionalStore.setState({ emotionalState: emotionalStateData });
    }
  }, [emotionalStateData]);

  // Provide methods for updating emotional state with automatic sync
  const updateEmotionalStateWithSync = async (updates: Partial<EmotionalState>) => {
    await updateEmotionalState(updates);
    
    // Invalidate profile query to trigger refresh
    queryClient.invalidateQueries({ queryKey: ['/api/protected/profile'] });
  };

  const getCurrentMoodColor = () => {
    switch (emotionalState.currentMood) {
      case 'happy': case 'excited': case 'joyful': return 'text-cyber-green';
      case 'focused': case 'engaged': case 'determined': return 'text-cyber-blue';
      case 'concerned': case 'frustrated': case 'worried': return 'text-cyber-amber';
      case 'calm': case 'peaceful': case 'relaxed': return 'text-blue-400';
      case 'angry': case 'upset': return 'text-cyber-red';
      default: return 'text-gray-400';
    }
  };

  const getBondLevelDescription = () => {
    const level = emotionalState.bondLevel;
    if (level >= 90) return 'Deeply Connected';
    if (level >= 75) return 'Strong Bond';
    if (level >= 50) return 'Growing Trust';
    if (level >= 25) return 'Getting Acquainted';
    return 'Initial Contact';
  };

  const getTrustLevelDescription = () => {
    const level = emotionalState.trustLevel;
    if (level >= 0.9) return 'Complete Trust';
    if (level >= 0.7) return 'High Trust';
    if (level >= 0.5) return 'Moderate Trust';
    if (level >= 0.3) return 'Building Trust';
    return 'Establishing Trust';
  };

  return {
    emotionalState: user?.emotionalState || emotionalState,
    isUpdating,
    updateEmotionalState: updateEmotionalStateWithSync,
    syncWithServer,
    getCurrentMoodColor,
    getBondLevelDescription,
    getTrustLevelDescription
  };
}
