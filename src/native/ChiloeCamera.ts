import {NativeModules, PermissionsAndroid, Platform} from 'react-native';
import type {PreviewLayout} from './previewGeometry';

export interface CameraCapture {
  filePath: string;
  width: number;
  height: number;
}

// Lo que el sensor de este teléfono realmente acepta. Los valores fuera de
// rango los ignora el driver en silencio, así que la UI manual se construye a
// partir de esto y no de constantes inventadas.
export interface CameraCapabilities {
  isoMin: number;
  isoMax: number;
  exposureMinMs: number;
  exposureMaxMs: number;
  focusMaxDiopters: number; // 0 = lente de foco fijo
  maxAfRegions: number; // 0 = sin toque-para-enfocar
  supportsManualSensor: boolean;
  previewWidth: number;
  previewHeight: number;
}

export interface CameraSession {
  sessionId: number;
  capabilities: () => Promise<CameraCapabilities>;
  // Geometría del preview (sin el tamaño de la vista, que solo conoce React).
  previewLayout: () => Promise<Omit<PreviewLayout, 'viewWidth' | 'viewHeight'>>;
  setIso: (iso: number) => Promise<void>;
  setExposure: (exposureMs: number) => Promise<void>;
  setFocus: (distance: number | 'auto') => Promise<void>;
  // (x, y) normalizados 0..1 sobre la imagen ya girada; usar
  // `viewPointToImagePoint` para convertir un toque de la vista.
  focusAt: (x: number, y: number) => Promise<void>;
  capture: () => Promise<CameraCapture>;
  close: () => Promise<void>;
}

interface NativeChiloeCamera {
  openCamera: (options: {lens: 'back' | 'front'}) => Promise<{sessionId: number}>;
  capabilities: (sessionId: number) => Promise<CameraCapabilities>;
  previewLayout: (
    sessionId: number,
  ) => Promise<Omit<PreviewLayout, 'viewWidth' | 'viewHeight'>>;
  setIso: (sessionId: number, iso: number) => Promise<void>;
  setExposure: (sessionId: number, exposureMs: number) => Promise<void>;
  setFocus: (sessionId: number, distance: number) => Promise<void>;
  focusAt: (sessionId: number, x: number, y: number) => Promise<void>;
  capture: (sessionId: number) => Promise<CameraCapture>;
  close: (sessionId: number) => Promise<void>;
  pickImageFromGallery: () => Promise<CameraCapture | null>;
}

const getNativeModule = (): NativeChiloeCamera => {
  const module = NativeModules.ChiloeCamera as NativeChiloeCamera | undefined;
  if (!module) {
    throw new Error('ChiloeCamera native module is not registered');
  }
  return module;
};

export const requestCameraPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }

  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: 'Permiso de cámara',
    message: 'La app necesita la cámara para capturar avistamientos.',
    buttonPositive: 'Permitir',
    buttonNegative: 'Cancelar',
  });

  return result === PermissionsAndroid.RESULTS.GRANTED;
};

export const openCamera = async (
  options: {lens: 'back' | 'front'} = {lens: 'back'},
): Promise<CameraSession> => {
  const granted = await requestCameraPermission();
  if (!granted) {
    throw new Error('Permiso de cámara no concedido');
  }

  const module = getNativeModule();
  const {sessionId} = await module.openCamera(options);

  return {
    sessionId,
    capabilities: () => module.capabilities(sessionId),
    previewLayout: () => module.previewLayout(sessionId),
    setIso: (iso: number) => module.setIso(sessionId, iso),
    setExposure: (exposureMs: number) => module.setExposure(sessionId, exposureMs),
    setFocus: (distance: number | 'auto') =>
      module.setFocus(sessionId, distance === 'auto' ? -1 : distance),
    focusAt: (x: number, y: number) => module.focusAt(sessionId, x, y),
    capture: () => module.capture(sessionId),
    close: () => module.close(sessionId),
  };
};

/**
 * Abre el selector de imágenes del sistema. Devuelve null si el usuario
 * cancela. No pide permiso de almacenamiento: el sistema entrega acceso solo al
 * archivo elegido.
 */
export const pickImageFromGallery = async (): Promise<CameraCapture | null> =>
  getNativeModule().pickImageFromGallery();

