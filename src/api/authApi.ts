import type {AuthResponse, UserPublic} from '../types/domain';
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
}

