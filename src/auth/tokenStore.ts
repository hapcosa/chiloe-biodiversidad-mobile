import * as Keychain from 'react-native-keychain';
import type {AuthResponse, StoredSession} from '../types/domain';

const AUTH_SERVICE = 'cl.chiloe.biodiversidad.auth';
const AUTH_USERNAME = 'jwt';

export const toStoredSession = (response: AuthResponse): StoredSession => ({
  user: response.user,
  accessToken: response.access_token,
  refreshToken: response.refresh_token,
  expiresAt: Date.now() + response.expires_in * 1000,
});

export const tokenStore = {
  async save(session: StoredSession): Promise<void> {
    await Keychain.setGenericPassword(AUTH_USERNAME, JSON.stringify(session), {
      service: AUTH_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async load(): Promise<StoredSession | null> {
    const credentials = await Keychain.getGenericPassword({service: AUTH_SERVICE});
    if (!credentials) {
      return null;
    }

    try {
      return JSON.parse(credentials.password) as StoredSession;
    } catch {
      await Keychain.resetGenericPassword({service: AUTH_SERVICE});
      return null;
    }
  },

  async clear(): Promise<void> {
    await Keychain.resetGenericPassword({service: AUTH_SERVICE});
  },
};
