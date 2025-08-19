import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api, login as apiLogin, register as apiRegister, logout as apiLogout } from "./api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  preferences: any;
  emotionalState: {
    bondLevel: number;
    currentMood: string;
    trustLevel: number;
    personalityTraits: string[];
    preferredCommunicationStyle: string;
  };
  createdAt: string;
  lastActiveAt: string;
}

interface AuthContext {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const queryClient = useQueryClient();

  // Check for existing token on mount
  useEffect(() => {
        const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      api.setToken(storedToken);
      setToken(storedToken);
    }
    setIsInitialized(true);
  }, []);

  // Fetch user profile if token exists
  const { data: userData, isLoading: isLoadingUser, refetch: refetchUser } = useQuery<User>({
    queryKey: ['/api/protected/profile'],
    queryFn: () => api.get('/api/protected/profile'),
    enabled: isInitialized && !!token,
    retry: (failureCount, error: any) => {
      // Don't retry on 401 errors
      if (error?.message?.includes('401')) {
        return false;
      }
      return failureCount < 3;
    },
    refetchInterval: 60000, // Refresh every minute to get updated emotional state
    staleTime: 30000, // Consider data stale after 30 seconds
  });

  // Update user state when data changes
  useEffect(() => {
    if (userData) {
      setUser(userData);
        } else if (isInitialized && !isLoadingUser && !token) {
      setUser(null);
    }
  }, [userData, isInitialized, isLoadingUser]);



  const login = async (email: string, password: string) => {
    try {
      const response = await apiLogin(email, password);
      setToken(response.token);
      setUser(response.user);
      await queryClient.invalidateQueries();
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (email: string, username: string, password: string) => {
    try {
      const response = await apiRegister(email, username, password);
      setToken(response.token);
      setUser(response.user);
      await queryClient.invalidateQueries();
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const logout = () => {
        apiLogout();
    setUser(null);
    setToken(null);
    queryClient.clear();
  };

  const refreshUser = () => {
    refetchUser();
  };

  const value: AuthContext = {
    user,
        isLoading: !isInitialized || (isLoadingUser && !!token),
    login,
    register,
    logout,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
