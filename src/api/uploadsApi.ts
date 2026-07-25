import type {ApiClient} from './apiClient';

export interface PresignResponse {
  bucket: string;
  key: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  expires_in: number;
}

export class UploadsApi {
  constructor(private readonly client: ApiClient) {}

  presign(params: {
    bucket: string;
    filename: string;
    content_type: string;
    expires_in?: number;
  }): Promise<PresignResponse> {
    return this.client.post<PresignResponse>('/api/v1/uploads/presign', params);
  }
}
