import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {authApi, setApiAccessToken, setUnauthorizedHandler} from '../api';
import {clearLocalUserData, ensureLocalDataOwner} from '../db/localUserData';
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
  updateAvatar: (avatarUrl: string) => Promise<void>;
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
    // Antes de exponer la sesión: si los datos locales son de otra cuenta hay
    // que borrarlos, o el perfil muestra los encuentros y las fotos del dueño
    // anterior del teléfono.
    if (nextSession) {
      await ensureLocalDataOwner(nextSession.user.id);
    }

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
        await ensureLocalDataOwner(refreshedSession.user.id);
        await persistSession(refreshedSession);
        setSession(refreshedSession);
        return;
      }

      await ensureLocalDataOwner(stored.user.id);
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

  // Sin esto, un token que el backend ya no acepta (caducado, cuenta
  // deshabilitada, o emitido por otro despliegue con distinta clave de firma)
  // deja la app mostrando el perfil cacheado para siempre, porque nada vuelve a
  // preguntar quién es el usuario.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void (async () => {
        await clearLocalUserData();
        await applySession(null);
      })();
    });

    return () => setUnauthorizedHandler(undefined);
  }, [applySession]);

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
    await clearLocalUserData();
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

  const updateAvatar = useCallback(
    async (avatarUrl: string) => {
      if (!session) {
        return;
      }

      const user = await authApi.updateProfile({avatar: avatarUrl});
      const nextSession = {...session, user};
      await applySession(nextSession);
    },
    [applySession, session],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      session,
      user: session?.user ?? null,
      loginWithPassword,
      loginWithGoogle,
      logout,
      refreshProfile,
      updateAvatar,
    }),
    [
      isLoading,
      session,
      loginWithPassword,
      loginWithGoogle,
      logout,
      refreshProfile,
      updateAvatar,
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

