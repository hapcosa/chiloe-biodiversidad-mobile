# chiloe-biodiversidad-mobile

App Android (React Native bare CLI + módulo nativo C++ con NDK Camera2) para la biblioteca de **biodiversidad de Chiloé**. Cliente del backend de microservicios.

- Backend (origen del proyecto, plan maestro y ADRs): https://github.com/hapcosa/Chilo-FloraApiDevops
- Plan maestro: ver `docs/PLAN_MAESTRO.md` en el repo backend.
- Este repo está registrado como submódulo `mobile/` en el repo backend.

## Estado

- React Native 0.86, TypeScript estricto, Android bare sin Expo.
- Login local y Google Sign-In contra `auth-service`.
- JWT guardado en Keychain.
- Pantallas: Biblioteca, Detalle, Login y Perfil.
- Cache SQLite local (`react-native-quick-sqlite`) con sincronización inicial de especies.
- Cámara NDK MVP: módulo C++/JNI en `android/app/src/main/cpp/`, controles ISO/exposición/foco y `CameraScreen` sin preview para capturar JPEG. Pendiente validar en hardware real.
- Cola offline de avistamientos en SQLite y worker de sincronización al volver la red.
- Pendiente: generar/verificar el Gradle wrapper (`android/gradlew`).

## Stack

| Pieza | Tecnología |
|-------|------------|
| App | React Native (bare CLI, no Expo, por el NDK) |
| Lenguaje | TypeScript estricto |
| Auth | `@react-native-google-signin/google-signin` + JWT propio |
| Cache offline | SQLite (`react-native-quick-sqlite`) + cola de mutaciones |
| Cámara | Módulo nativo C++ usando NDK Camera2 (JPEG/HEIF, controles manuales) |
| Tests | Jest (lógica) + Detox (e2e Android) + gtest (lógica C++ pura en CI host) |

## Configuración local

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Con el backend corriendo (`make dev` en la raíz del repo) y el dispositivo/emulador
   conectado por adb, expón el gateway en `localhost` del dispositivo:

   ```bash
   adb reverse tcp:8080 tcp:8080
   adb reverse tcp:9000 tcp:9000
   ```

   `appConfig.apiBaseUrl` ya apunta a `http://localhost:8080`, así que este comando
   basta tanto para emulador como para dispositivo físico — no hace falta editar
   el código para cada entorno. Configura además `googleWebClientId` con el OAuth
   Web Client ID usado también por `auth-service`.

   El segundo reverse (puerto 9000) es necesario porque la subida de fotos
   (avistamientos, avatar) va **directo a MinIO** con la URL presignada, sin pasar
   por el gateway — sin este túnel, esas subidas fallan con "network request
   failed" aunque el resto de la app funcione bien.

3. Arranca Metro:

   ```bash
   npm start
   ```

4. Ejecuta Android (dispositivo vía adb o emulador):

   ```bash
   npm run android
   ```

   Si falla por ausencia de `android/gradlew`, genera el wrapper con Gradle local
   (`gradle wrapper` dentro de `android/`) y commitea el resultado.

## Scripts

```bash
npm run typecheck
npm run lint
npm test
npm run android
```

## Pipeline

Mismo que el backend: rama → tests CI → PR contra `master` → checks verdes → merge → release. Nunca push directo a `master`. Ver [CLAUDE.md](CLAUDE.md).

## Notas técnicas

- `npm start` fuerza `--host 127.0.0.1` para no exponer Metro en red local.
- La cache usa `react-native-quick-sqlite` y se inicializa desde `src/sync/initialSync.ts`.
- La app consume rutas `v1`: `/api/v1/auth/*`, `/api/v1/especies` y `/api/v1/avistamientos`.
- `src/db/mutationQueue.ts` persiste avistamientos offline y `src/sync/mutationSync.ts` los envía a `POST /api/v1/avistamientos` al recuperar red. La moderación vive en `PATCH /api/v1/avistamientos/{id}/moderacion` (backend).

## Licencia

Pendiente de decidir junto con la del backend (probablemente CC-BY-SA para contenido + MIT/Apache para código).
