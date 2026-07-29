import { create } from 'zustand';
import type { User } from './types';

interface AuthStore {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('vigil_token') : null,

  setAuth: (user, token) => {
    localStorage.setItem('vigil_token', token);
    set({ user, token });
  },

  clearAuth: () => {
    localStorage.removeItem('vigil_token');
    set({ user: null, token: null });
  },

  isAuthenticated: () => !!get().token,
}));