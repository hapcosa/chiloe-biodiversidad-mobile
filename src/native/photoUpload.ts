import {uploadsApi} from '../api';
import type {PresignResponse} from '../api/uploadsApi';

// Sube una foto local (ruta del sistema de archivos, ej. la que devuelve
// ChiloeCamera.capture()) directo a MinIO/S3 vía URL presignada — nunca pasa
// por especies-api como multipart (ver CLAUDE.md, flujo de fotos).
const putLocalPhoto = async (localPath: string, bucket: string): Promise<PresignResponse> => {
  const filename = localPath.split('/').pop() ?? `foto-${Date.now()}.jpg`;
  const contentType = 'image/jpeg';

  const presign = await uploadsApi.presign({
    bucket,
    filename,
    content_type: contentType,
  });

  const fileUri = localPath.startsWith('file://') ? localPath : `file://${localPath}`;
  const fileResponse = await fetch(fileUri);
  const blob = await fileResponse.blob();

  const uploadResponse = await fetch(presign.url, {
    method: presign.method || 'PUT',
    headers: presign.headers,
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`No se pudo subir la foto (HTTP ${uploadResponse.status})`);
  }

  return presign;
};

export const uploadLocalPhoto = async (localPath: string, bucket: string): Promise<string> => {
  const presign = await putLocalPhoto(localPath, bucket);
  return presign.key;
};

// Igual que uploadLocalPhoto, pero devuelve la URL pública directa (sin la
// query string de la firma) en vez de solo la key — para casos como el
// avatar de perfil, donde el backend guarda una URL, no una key. El bucket
// destino debe tener descarga anónima habilitada (perfiles-fotos la tiene,
// igual que especies-fotos).
export const uploadLocalPhotoPublicUrl = async (
  localPath: string,
  bucket: string,
): Promise<string> => {
  const presign = await putLocalPhoto(localPath, bucket);
  const queryIndex = presign.url.indexOf('?');
  return queryIndex === -1 ? presign.url : presign.url.slice(0, queryIndex);
};
