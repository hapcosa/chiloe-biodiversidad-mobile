export const appConfig = {
  // localhost funciona tanto en emulador como en dispositivo físico si se
  // corre `adb reverse tcp:8080 tcp:8080` (ver README) — evita hardcodear
  // la IP especial de emulador (10.0.2.2) o la IP LAN de cada dispositivo.
  apiBaseUrl: 'http://localhost:8080',
  googleWebClientId: '',
  requestTimeoutMs: 15000,
};

