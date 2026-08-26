import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface LocationResult {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
}

// Consulta sin diálogo: sirve para saber si se puede pintar el punto azul del
// mapa al abrirlo, sin interrumpir a nadie con un permiso que no pidió.
export const hasLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
};

export const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Permiso de ubicación',
      message: 'La app necesita tu ubicación para registrar dónde viste la especie.',
      buttonPositive: 'Permitir',
      buttonNegative: 'Cancelar',
    },
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
};

const requestPosition = (options: {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}): Promise<LocationResult> =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: position.coords.accuracy ?? null,
        });
      },
      error => reject(new Error(error.message || 'No se pudo obtener la ubicación')),
      options,
    );
  });

export const getCurrentLocation = async (): Promise<LocationResult> => {
  const granted = await requestLocationPermission();
  if (!granted) {
    throw new Error('Permiso de ubicación no concedido');
  }

  try {
    // GPS de alta precisión: rápido al aire libre, pero puede no responder
    // en interiores. Si falla, caemos a triangulación por red (menos
    // precisa pero funciona en interiores) en vez de fallar del todo.
    return await requestPosition({enableHighAccuracy: true, timeout: 8000, maximumAge: 10000});
  } catch {
    return await requestPosition({enableHighAccuracy: false, timeout: 15000, maximumAge: 30000});
  }
};
