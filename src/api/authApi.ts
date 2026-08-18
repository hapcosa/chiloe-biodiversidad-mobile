import type {AuthResponse, UserPerfilPublico, UserPublic} from '../types/domain';
import type {ApiClient} from './apiClient';

interface WhoAmIResponse {
  user: UserPublic;
  authenticated: boolean;
  token_valid: boolean;
}

export class AuthApi {
  constructor(private readonly client: ApiClient) {}

  login(email: string, password: string): Promise<AuthResponse> {
    return this.client.post<AuthResponse>(
      '/api/v1/auth/login',
      {email, password},
      {authenticated: false},
    );
  }

  loginWithGoogleIdToken(idToken: string): Promise<AuthResponse> {
    return this.client.post<AuthResponse>(
      '/api/v1/auth/google',
      {id_token: idToken},
      {authenticated: false},
    );
  }

  refresh(refreshToken: string): Promise<AuthResponse> {
    return this.client.post<AuthResponse>(
      '/api/v1/auth/refresh',
      {refresh_token: refreshToken},
      {authenticated: false},
    );
  }

  async whoami(): Promise<UserPublic> {
    const response = await this.client.get<WhoAmIResponse>('/api/v1/auth/whoami');
    return response.user;
  }

  // `bio` y `profesion` se mandan aunque vengan vacías: el backend distingue
  // "no lo envió" de "quiere borrarlo", y borrar la bio tiene que ser posible.
  updateProfile(changes: {
    name?: string;
    avatar?: string;
    bio?: string;
    profesion?: string;
    perfil_publico?: boolean;
  }): Promise<UserPublic> {
    return this.client.put<UserPublic>('/api/v1/auth/me', changes);
  }

  /** Responde 404 si esa persona no publicó su perfil. */
  perfilPublico(usuarioId: number): Promise<UserPerfilPublico> {
    return this.client.get<UserPerfilPublico>(`/api/v1/auth/usuarios/${usuarioId}/publico`);
  }
}

