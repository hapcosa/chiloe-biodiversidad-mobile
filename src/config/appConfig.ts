// En debug apuntamos a localhost, que funciona tanto en emulador como en
// dispositivo físico si se corre `adb reverse tcp:8080 tcp:8080` (ver README)
// — evita hardcodear la IP especial de emulador (10.0.2.2) o la IP LAN de cada
// dispositivo. En release apuntamos al despliegue de producción, que es el
// único alcanzable desde una red cualquiera.
//
// Las fotos no aparecen aquí a propósito: el cliente sube a la URL presignada
// que devuelve la API, así que el host del object storage lo decide el backend.
const apiBaseUrl = __DEV__
  ? 'http://localhost:8080'
  : 'https://api.budaicapital.com';

export const appConfig = {
  apiBaseUrl,
  googleWebClientId: '',
  requestTimeoutMs: 15000,
};
