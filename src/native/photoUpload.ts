import {uploadsApi} from '../api';

// Sube una foto local (ruta del sistema de archivos, ej. la que devuelve
// ChiloeCamera.capture()) directo a MinIO/S3 vía URL presignada — nunca pasa
// por especies-api como multipart (ver CLAUDE.md, flujo de fotos).
export const uploadLocalPhoto = async (
  localPath: string,
  bucket: string,
): Promise<string> => {
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

  return presign.key;
};
