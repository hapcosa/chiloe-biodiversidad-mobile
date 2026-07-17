# Android

Base Android bare para React Native con módulo NDK Camera2 en
`app/src/main/cpp/`.

Este scaffold no incluye el wrapper binario de Gradle porque el entorno actual
no ejecutó `npx @react-native-community/cli init` ni descargó dependencias. En el
repo móvil definitivo, generar/verificar:

```text
android/gradlew
android/gradlew.bat
android/gradle/wrapper/gradle-wrapper.jar
android/gradle/wrapper/gradle-wrapper.properties
```

## Cámara NDK

El módulo `ChiloeCamera` registra un bridge React Native clásico y carga la
librería `chiloe_camera`. El C++ usa NDK Camera2 para abrir cámara trasera,
crear un `AImageReader` JPEG, aplicar controles básicos y escribir la captura en
cache de la app.

Validación pendiente:

- Compilación CMake con NDK instalado.
- Prueba en dispositivo físico Android con cámara trasera.
- Calibración de rangos ISO/exposición/foco por hardware.
