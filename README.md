# chiloe-biodiversidad-mobile

App Android (React Native bare CLI + módulo nativo C++ con NDK Camera2) para la biblioteca de **biodiversidad de Chiloé**. Cliente del backend de microservicios.

- Backend (origen del proyecto, plan maestro y ADRs): https://github.com/hapcosa/Chilo-FloraApiDevops
- Plan maestro: ver `docs/PLAN_MAESTRO.md` en el repo backend.

## Estado

Repo recién inicializado (Fase 0 del plan). El esqueleto de React Native se añadirá en la Fase 4 y el módulo nativo de cámara en la Fase 5.

## Stack previsto

| Pieza | Tecnología |
|-------|------------|
| App | React Native (bare CLI, no Expo, por el NDK) |
| Lenguaje | TypeScript estricto |
| Auth | `@react-native-google-signin/google-signin` + JWT propio |
| Cache offline | SQLite (`react-native-quick-sqlite`) + cola de mutaciones |
| Cámara | Módulo nativo C++ usando NDK Camera2 (JPEG/HEIF, controles manuales) |
| Tests | Jest (lógica) + Detox (e2e Android) + gtest (lógica C++ pura en CI host) |

## Pipeline

Mismo que el backend: rama → tests CI → PR contra `master` → checks verdes → merge → release. Nunca push directo a `master`.

## Licencia

Pendiente de decidir junto con la del backend (probablemente CC-BY-SA para contenido + MIT/Apache para código).
