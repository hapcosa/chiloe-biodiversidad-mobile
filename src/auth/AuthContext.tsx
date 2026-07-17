import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {authApi, setApiAccessToken} from '../api';
import type {StoredSession, UserPublic} from '../types/domain';
import {requestGoogleIdToken} from './googleSignIn';
import {toStoredSession, tokenStore} from './tokenStore';

interface AuthContextValue {
  isLoading: boolean;
  session: StoredSession | null;
  user: UserPublic | null;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const EXPIRY_MARGIN_MS = 60000;

const persistSession = async (session: StoredSession): Promise<void> => {
  setApiAccessToken(session.accessToken);
  await tokenStore.save(session);
};

export const AuthProvider = ({children}: {children: ReactNode}): React.JSX.Element => {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback(async (nextSession: StoredSession | null) => {
    setSession(nextSession);
    setApiAccessToken(nextSession?.accessToken ?? null);

    if (nextSession) {
      await tokenStore.save(nextSession);
    } else {
      await tokenStore.clear();
    }
  }, []);

  const restore = useCallback(async () => {
    try {
      const stored = await tokenStore.load();
      if (!stored) {
        return;
      }

      if (stored.expiresAt <= Date.now() + EXPIRY_MARGIN_MS) {
        const refreshed = await authApi.refresh(stored.refreshToken);
        const refreshedSession = toStoredSession(refreshed);
        await persistSession(refreshedSession);
        setSession(refreshedSession);
        return;
      }

      setApiAccessToken(stored.accessToken);
      setSession(stored);
    } catch {
      await applySession(null);
    } finally {
      setIsLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    void restore();
  }, [restore]);

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      const response = await authApi.login(email, password);
      await applySession(toStoredSession(response));
    },
    [applySession],
  );

  const loginWithGoogle = useCallback(async () => {
    const idToken = await requestGoogleIdToken();
    const response = await authApi.loginWithGoogleIdToken(idToken);
    await applySession(toStoredSession(response));
  }, [applySession]);

  const logout = useCallback(async () => {
    await applySession(null);
  }, [applySession]);

  const refreshProfile = useCallback(async () => {
    if (!session) {
      return;
    }

    const user = await authApi.whoami();
    const nextSession = {...session, user};
    await applySession(nextSession);
  }, [applySession, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      session,
      user: session?.user ?? null,
      loginWithPassword,
      loginWithGoogle,
      logout,
      refreshProfile,
    }),
    [
      isLoading,
      session,
      loginWithPassword,
      loginWithGoogle,
      logout,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};

