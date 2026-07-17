import {NativeModules, PermissionsAndroid, Platform} from 'react-native';

export interface CameraCapture {
  filePath: string;
  width: number;
  height: number;
}

export interface CameraSession {
  sessionId: number;
  setIso: (iso: number) => Promise<void>;
  setExposure: (exposureMs: number) => Promise<void>;
  setFocus: (distance: number | 'auto') => Promise<void>;
  capture: () => Promise<CameraCapture>;
  close: () => Promise<void>;
}

interface NativeChiloeCamera {
  openCamera: (options: {lens: 'back' | 'front'}) => Promise<{sessionId: number}>;
  setIso: (sessionId: number, iso: number) => Promise<void>;
  setExposure: (sessionId: number, exposureMs: number) => Promise<void>;
  setFocus: (sessionId: number, distance: number) => Promise<void>;
  capture: (sessionId: number) => Promise<CameraCapture>;
  close: (sessionId: number) => Promise<void>;
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
    setIso: (iso: number) => module.setIso(sessionId, iso),
    setExposure: (exposureMs: number) => module.setExposure(sessionId, exposureMs),
    setFocus: (distance: number | 'auto') =>
      module.setFocus(sessionId, distance === 'auto' ? -1 : distance),
    capture: () => module.capture(sessionId),
    close: () => module.close(sessionId),
  };
};

