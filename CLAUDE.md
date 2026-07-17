# CLAUDE.md — Guía para asistentes de IA en este repo

Reglas para cualquier agente (Claude Code u otro) que trabaje en la app móvil de **biodiversidad de Chiloé**. Si algo no encaja con lo descrito aquí, **pregunta antes de actuar**.

Este repo es el submódulo `mobile/` del backend: https://github.com/hapcosa/Chilo-FloraApiDevops. El plan maestro y las decisiones de arquitectura (ADRs) viven allá, en `docs/PLAN_MAESTRO.md`. **Léelo antes de proponer cambios estructurales.**

---

## Qué es esta app

App Android React Native **bare CLI** (no Expo) para consultar el catálogo multi-reino de especies de Chiloé, con:

- Login local y Google Sign-In contra el `auth-service` del backend.
- Biblioteca offline-first: cache SQLite de especies + cola de mutaciones para avistamientos sin red.
- Módulo nativo de cámara en C++ (NDK Camera2) con controles manuales.

**Android primero. iOS está fuera de alcance** (ADR #9 del backend).

---

## Reglas de trabajo (pipeline)

**Innegociable**, igual que en el backend:

1. `git checkout -b <tipo>/<descripcion-corta>` (`feat/`, `fix/`, `refactor/`, `docs/`, `chore/`).
2. Cambios y commits con mensajes claros.
3. `git push -u origin <rama>` — GitHub Actions corre lint + typecheck + tests.
4. Pull Request contra `master`, checks verdes + revisión, merge.

**No** hagas push directo a `master`. **No** uses `git push --force`, `git reset --hard` ni `--no-verify` sin permiso explícito.

---

## Estructura

```
android/app/src/main/cpp/      # Módulo nativo cámara (C++ / NDK Camera2)
android/app/src/main/java/     # MainActivity/Application + bridge Kotlin (ChiloeCameraModule)
src/api/                       # Cliente HTTP al backend (rutas /api/v1/*)
src/auth/                      # Google Sign-In + JWT en Keychain
src/db/                        # SQLite: cache de especies + cola de mutaciones
src/native/                    # Bridge JS ↔ módulo nativo
src/navigation/                # React Navigation
src/screens/                   # Pantallas (componentes funcionales)
src/sync/                      # Sincronización inicial + replay de mutaciones offline
src/types/                     # Tipos de dominio (espejo del modelo multi-reino)
```

---

## Convenciones de código

- **TypeScript estricto** (`npm run typecheck` debe pasar). Nada de `any` gratuito.
- **ESLint + Prettier** (`npm run lint`). Componentes funcionales con hooks; no clases.
- **C++ (NDK)**: mismo estilo que el backend `especies-api` — indentación 4 espacios, headers `.hpp` junto a la implementación en `cpp/`. La lógica pura (EXIF, helpers) debe ser testeable sin Android.
- **Kotlin**: solo para el bridge (module/package de React Native). La lógica de cámara vive en C++.
- **Tests**: Jest para lógica JS/TS (`__tests__/` junto al código o `*.test.ts`). Toda lógica nueva no trivial (colas, sync, parsers) lleva test en el mismo PR.
- **Comentarios**: solo donde el *por qué* no es evidente.
- **Sin features especulativas** ni dependencias nuevas sin justificarlas en el PR.

---

## Reglas de dominio (heredadas del backend)

- **Cinco reinos** fijos: `animalia | plantae | fungi | protista | monera`. No diseñar para reinos hipotéticos.
- **Fotos**: nunca subir bytes a la API. Flujo: pedir presigned URL → subir directo a MinIO/S3 → notificar la key. El módulo de cámara **borra EXIF sensible** (GPS, serial) salvo opt-in explícito del usuario.
- **Fungi**: la comestibilidad siempre visible con disclaimer ("consulte un experto antes de consumir"). Riesgo sanitario real.
- **Offline-first**: toda mutación debe poder encolarse sin red (`src/db/mutationQueue.ts`) y sincronizarse después. No agregar flujos que solo funcionen online sin discutirlo.
- **Auth**: Google Sign-In SDK → `idToken` → `POST /api/v1/auth/google` → JWT propio. **No** introducir Firebase Auth ni otro proveedor sin ADR en el backend.

---

## Qué NO commitear

- Keystores (`*.keystore`, `*.jks`) ni credenciales de firma.
- `google-services.json` ni OAuth client secrets.
- `.env` reales, tokens, URLs internas de producción.
- `node_modules/`, artefactos de build (`.cxx/`, `build/`, APKs).

---

## Comandos

```bash
npm install          # deps
npm start            # Metro (host 127.0.0.1)
npm run android      # build + install en dispositivo adb
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # jest
```

---

## Idioma

Documentación, UI y comentarios públicos en **español**. Identificadores y mensajes técnicos en **inglés**, salvo nombres del dominio biológico (`reino`, `especie`, `avistamiento`, que son universales).
