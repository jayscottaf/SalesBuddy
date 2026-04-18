import { useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthState {
  loading: boolean;
  user: AuthUser | null;
  /**
   * True when the server has no auth configured at all (e.g. local dev without Replit session
   * but with dev bypass enabled). The app should act as if signed in.
   */
  devBypass: boolean;
}

export function useAuth(): AuthState & { refresh: () => void; logout: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({ loading: true, user: null, devBypass: false });

  const refresh = async () => {
    try {
      const res = await fetch('/api/auth/user', { credentials: 'include' });
      if (res.status === 401) {
        setState({ loading: false, user: null, devBypass: false });
        return;
      }
      if (!res.ok) throw new Error('auth check failed');
      const user = await res.json();
      const isDevUser = user?.id === 'dev-user-id';
      setState({ loading: false, user, devBypass: isDevUser });
    } catch (err) {
      console.error('auth refresh failed', err);
      setState({ loading: false, user: null, devBypass: false });
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setState({ loading: false, user: null, devBypass: false });
    window.location.href = '/';
  };

  return { ...state, refresh, logout };
}
