import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useEmotionalStore } from "@/store/emotional-state";
import { useState, useEffect } from 'react';
import { useVoice } from "@/hooks/use-voice";
import { useQuery } from "@tanstack/react-query";
import VoiceVisualizer from "@/components/ui/voice-visualizer";

interface Session {
  id: string;
  title: string;
  lastMessageAt?: string;
  startedAt: string;
}

const workspaces = [
  { id: "chat", name: "Chat & RAG", icon: "fas fa-comments", path: "/" },
  { id: "coding", name: "Coding", icon: "fas fa-code", path: "/coding" },
  { id: "redteam", name: "Red Team", icon: "fas fa-shield-alt", path: "/redteam" },
  { id: "osint", name: "OSINT", icon: "fas fa-search", path: "/osint" },
  { id: "reports", name: "Reports", icon: "fas fa-file-alt", path: "/reports" }
];

export default function NavigationRail() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const emotionalState = useEmotionalStore((state) => state.emotionalState);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !audioContext) {
      setAudioContext(new (window.AudioContext || (window as any).webkitAudioContext)());
    }
    return () => {
      audioContext?.close();
    };
  }, []);

  const { isListening, isActive } = useVoice(audioContext);

  // Fetch recent sessions
  const { data: recentSessions } = useQuery<Session[]>({
    queryKey: ['/api/protected/sessions'],
    staleTime: 60000,
    select: (data) => (Array.isArray(data) ? data.slice(0, 3) : []),
    initialData: [],
    enabled: !!localStorage.getItem('auth_token'),
  });

  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case 'happy': case 'excited': return 'bg-cyber-green';
      case 'focused': case 'engaged': return 'bg-cyber-blue';
      case 'concerned': case 'frustrated': return 'bg-cyber-amber';
      case 'calm': case 'neutral': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="w-64 glass border-r border-white/10 flex flex-col" data-testid="navigation-rail">
      {/* Logo & Voice Status */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyber-blue to-cyber-green flex items-center justify-center">
            <i className="fas fa-brain text-white text-lg" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">AI Copilot</h1>
            <p className="text-xs text-gray-400">Cybersecurity Command</p>
          </div>
        </div>
        
        {/* Voice Assistant Status */}
        <div className="glass rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Ammu</span>
            <div className={`w-2 h-2 rounded-full ${
              isActive ? 'bg-cyber-green animate-pulse' : 'bg-gray-500'
            }`} />
          </div>
          <div className="flex items-center space-x-1">
            <VoiceVisualizer isActive={isListening} />
            <span className={`text-xs ml-2 ${
              isListening ? 'text-cyber-blue' : 
              isActive ? 'text-cyber-green' : 'text-gray-400'
            }`}>
              {isListening ? 'Listening...' : 
               isActive ? 'Ready' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      {/* Workspaces */}
      <div className="flex-1 p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Workspaces
        </h3>
        <nav className="space-y-2">
          {workspaces.map((workspace) => {
            const isActiveWorkspace = location === workspace.path;
            return (
              <Link
                key={workspace.id}
                href={workspace.path}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  isActiveWorkspace
                    ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/50'
                    : 'hover:bg-white/5 text-gray-300 hover:text-white'
                }`}
                data-testid={`nav-${workspace.id}`}
              >
                <i className={`${workspace.icon} w-4`} />
                <span className={isActiveWorkspace ? 'font-medium' : ''}>{workspace.name}</span>
              </Link>
            );
          })}
        </nav>
        
        {/* Recent Sessions */}
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-6">
          Recent Sessions
        </h3>
        <div className="space-y-2">
          {recentSessions?.length > 0 ? (
            recentSessions.map((session, index: number) => (
              <div 
                key={session.id} 
                className="px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors" 
                data-testid={`session-recent-${index + 1}`}
              >
                <p className="text-sm font-medium truncate">{session.title}</p>
                <p className="text-xs text-gray-400">
                  {formatTimeAgo(session.lastMessageAt || session.startedAt)}
                </p>
              </div>
            ))
          ) : (
            <>
              <div className="px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer" data-testid="session-recent-1">
                <p className="text-sm font-medium">Start your first conversation</p>
                <p className="text-xs text-gray-400">Ask Ammu anything</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* User Profile & Emotional State */}
      <div className="p-4 border-t border-white/10">
        <div className="glass rounded-lg p-3">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyber-green to-cyber-blue flex items-center justify-center">
              <span className="text-xs font-semibold" data-testid="user-initials">
                {user ? getUserInitials(user.username) : 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" data-testid="user-name">
                {user?.username || 'User'}
              </p>
              <p className="text-xs text-gray-400" data-testid="user-role">
                {user?.role === 'owner' ? 'Owner' : 'Senior Analyst'}
              </p>
            </div>
          </div>
          
          {/* Emotional State Indicators */}
          <div className="flex items-center space-x-2 text-xs mb-3">
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${getMoodColor(emotionalState.currentMood)}`} />
              <span className="capitalize">{emotionalState.currentMood}</span>
            </div>
            <div className="text-gray-400">•</div>
            <span className="text-gray-400">
              Bond: <span className="text-cyber-green" data-testid="bond-level">
                {emotionalState.bondLevel}%
              </span>
            </span>
          </div>
          
          {/* Trust Level Bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Trust Level</span>
              <span>{Math.round(emotionalState.trustLevel * 100)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1">
              <div 
                className="bg-gradient-to-r from-cyber-blue to-cyber-green h-1 rounded-full transition-all duration-300"
                style={{ width: `${emotionalState.trustLevel * 100}%` }}
              />
            </div>
          </div>
          
          <button
            onClick={logout}
            className="w-full px-3 py-1 text-xs glass border border-white/20 rounded hover:bg-white/5 transition-colors"
            data-testid="button-logout"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
