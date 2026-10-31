import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../types.js';

export type PageView =
  | 'landing'
  | 'dashboard'
  | 'command-center'
  | 'agents'
  | 'workflows'
  | 'approvals'
  | 'employees'
  | 'it'
  | 'finance'
  | 'communications'
  | 'audit'
  | 'analytics'
  | 'settings'
  | 'signin'
  | 'signup';

interface AppContextType {
  currentPage: PageView;
  setCurrentPage: (page: PageView) => void;
  isDark: boolean;
  toggleTheme: () => void;
  currentUser: UserRole;
  switchRole: (role: UserRole['role']) => Promise<void>;
  pendingApprovalCount: number;
  refreshPendingCount: () => Promise<void>;
  selectedWorkflowId: string | null;
  setSelectedWorkflowId: (id: string | null) => void;
  globalSearchOpen: boolean;
  setGlobalSearchOpen: (open: boolean) => void;
  cookieConsentAccepted: boolean;
  setCookieConsentAccepted: (accepted: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentPage, setCurrentPage] = useState<PageView>('dashboard');
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('workforce_theme') === 'dark';
  });
  const [cookieConsentAccepted, setCookieConsentAccepted] = useState<boolean>(() => {
    return localStorage.getItem('workforce_cookie_consent') === 'true';
  });
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [globalSearchOpen, setGlobalSearchOpen] = useState<boolean>(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState<number>(1);

  const [currentUser, setCurrentUser] = useState<UserRole>({
    id: 'USR-ADMIN',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@workforce.ai',
    role: 'Administrator',
    department: 'Engineering',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('workforce_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('workforce_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };

  const refreshPendingCount = async () => {
    try {
      const res = await fetch('/api/approvals/pending');
      if (res.ok) {
        const data = await res.json();
        setPendingApprovalCount(data.length);
      }
    } catch (e) {
      // ignore
    }
  };

  const switchRole = async (role: UserRole['role']) => {
    try {
      const res = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 15000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        isDark,
        toggleTheme,
        currentUser,
        switchRole,
        pendingApprovalCount,
        refreshPendingCount,
        selectedWorkflowId,
        setSelectedWorkflowId,
        globalSearchOpen,
        setGlobalSearchOpen,
        cookieConsentAccepted,
        setCookieConsentAccepted
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}
