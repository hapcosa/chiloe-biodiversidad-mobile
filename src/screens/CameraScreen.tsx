import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {RangeSlider} from '../components/RangeSlider';
import {CameraPreview} from '../native/CameraPreview';
import {
  openCamera,
  pickImageFromGallery,
  type CameraCapabilities,
  type CameraCapture,
  type CameraSession,
} from '../native/ChiloeCamera';
import {
  viewPointToImagePoint,
  type PreviewLayout,
} from '../native/previewGeometry';
import {colors, spacing} from '../styles/theme';

interface CameraScreenProps {
  // Sin `onBack` no se dibuja el botón de volver: es el caso de la pestaña
  // "Capturar", que ya se abandona con la barra inferior.
  onBack?: () => void;
  // Si se entrega, la pantalla devuelve la foto en vez de quedarse mostrando
  // "Foto guardada": es el modo visor para avatar y avistamientos.
  onCapture?: (capture: CameraCapture) => void;
  lens?: 'back' | 'front';
  // Texto de ayuda propio del flujo que abrió el visor.
  hint?: string;
}

interface FocusMark {
  x: number;
  y: number;
  key: number;
}

export const CameraScreen = ({
  onBack,
  onCapture,
  lens = 'back',
  hint,
}: CameraScreenProps): React.JSX.Element => {
  const [session, setSession] = useState<CameraSession | null>(null);
  const [capabilities, setCapabilities] = useState<CameraCapabilities | null>(null);
  const [layout, setLayout] = useState<Omit<
    PreviewLayout,
    'viewWidth' | 'viewHeight'
  > | null>(null);
  const [viewSize, setViewSize] = useState({width: 0, height: 0});
  const [capture, setCapture] = useState<CameraCapture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [focusMark, setFocusMark] = useState<FocusMark | null>(null);
  const [iso, setIso] = useState<number | null>(null);
  const [exposureMs, setExposureMs] = useState<number | null>(null);
  const [focusDiopters, setFocusDiopters] = useState<number | null>(null);
  // Evita abrir dos sesiones si el efecto se remonta antes de resolverse.
  const isOpening = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const open = async (): Promise<void> => {
      if (isOpening.current) {
        return;
      }
      isOpening.current = true;
      try {
        const nextSession = await openCamera({lens});
        if (cancelled) {
          void nextSession.close();
          return;
        }
        setSession(nextSession);

        // Si algo de esto falla la cámara sigue sirviendo en automático: los
        // controles manuales y el toque-para-enfocar simplemente no aparecen.
        const [caps, previewLayout] = await Promise.all([
          nextSession.capabilities().catch(() => null),
          nextSession.previewLayout().catch(() => null),
        ]);
        if (cancelled) {
          return;
        }
        setCapabilities(caps);
        setLayout(previewLayout);
      } catch (openError) {
        if (!cancelled) {
          setError(
            openError instanceof Error
              ? openError.message
              : 'No se pudo abrir la cámara',
          );
        }
      } finally {
        isOpening.current = false;
      }
    };

    void open();

    return () => {
      cancelled = true;
    };
  }, [lens]);

  useEffect(
    () => () => {
      if (session) {
        void session.close();
      }
    },
    [session],
  );

  const onPreviewLayout = useCallback((event: LayoutChangeEvent): void => {
    const {width, height} = event.nativeEvent.layout;
    setViewSize({width, height});
  }, []);

  const focusHere = useCallback(
    (touchX: number, touchY: number): void => {
      if (!session || !layout || !capabilities || capabilities.maxAfRegions < 1) {
        return;
      }
      const point = viewPointToImagePoint(
        {...layout, viewWidth: viewSize.width, viewHeight: viewSize.height},
        touchX,
        touchY,
      );
      if (!point) {
        return;
      }
      setFocusMark({x: touchX, y: touchY, key: Date.now()});
      setFocusDiopters(null);
      void session.focusAt(point.x, point.y).catch(() => {
        setError('El enfoque manual no respondió');
      });
    },
    [capabilities, layout, session, viewSize.height, viewSize.width],
  );

  // La marca de enfoque se apaga sola; si no, queda un cuadrito pegado.
  useEffect(() => {
    if (!focusMark) {
      return;
    }
    const timer = setTimeout(() => setFocusMark(null), 1200);
    return () => clearTimeout(timer);
  }, [focusMark]);

  const finish = useCallback(
    (result: CameraCapture): void => {
      if (onCapture) {
        onCapture(result);
      } else {
        setCapture(result);
      }
    },
    [onCapture],
  );

  const takePhoto = useCallback(async (): Promise<void> => {
    if (!session || isCapturing) {
      return;
    }

    setIsCapturing(true);
    setError(null);
    try {
      finish(await session.capture());
    } catch (captureError) {
      setError(
        captureError instanceof Error
          ? captureError.message
          : 'No se pudo tomar la foto',
      );
    } finally {
      setIsCapturing(false);
    }
  }, [finish, isCapturing, session]);

  const chooseFromGallery = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const picked = await pickImageFromGallery();
      if (picked) {
        finish(picked);
      }
    } catch (pickError) {
      setError(
        pickError instanceof Error
          ? pickError.message
          : 'No se pudo abrir la galería',
      );
    }
  }, [finish]);

  const applyIso = useCallback(
    (value: number): void => {
      const rounded = Math.round(value);
      setIso(rounded);
      void session?.setIso(rounded).catch(() => undefined);
    },
    [session],
  );

  const applyExposure = useCallback(
    (value: number): void => {
      setExposureMs(value);
      void session?.setExposure(value).catch(() => undefined);
    },
    [session],
  );

  const applyFocus = useCallback(
    (value: number): void => {
      setFocusDiopters(value);
      void session?.setFocus(value).catch(() => undefined);
    },
    [session],
  );

  const backToAuto = useCallback((): void => {
    setIso(null);
    setExposureMs(null);
    setFocusDiopters(null);
    void session?.setFocus('auto').catch(() => undefined);
  }, [session]);

  const canFocusByTouch = (capabilities?.maxAfRegions ?? 0) > 0;
  const canGoManual = capabilities?.supportsManualSensor === true;

  return (
    <View style={styles.container}>
      <View style={styles.viewfinder} onLayout={onPreviewLayout}>
        {session ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enfocar en este punto"
            disabled={!canFocusByTouch}
            onPress={event =>
              focusHere(event.nativeEvent.locationX, event.nativeEvent.locationY)
            }
            style={styles.preview}>
            <CameraPreview sessionId={session.sessionId} style={styles.preview} />
          </Pressable>
        ) : (
          <View style={styles.placeholder}>
            <ActivityIndicator color={colors.surface} />
            <Text style={styles.placeholderText}>Abriendo la cámara…</Text>
          </View>
        )}

        {focusMark ? (
          <View
            pointerEvents="none"
            style={[
              styles.focusMark,
              {left: focusMark.x - 36, top: focusMark.y - 36},
            ]}
          />
        ) : null}

        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={onBack}
            style={styles.backButton}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </Pressable>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      {showManual && capabilities ? (
        <ScrollView style={styles.manualPanel} keyboardShouldPersistTaps="handled">
          <RangeSlider
            label="ISO"
            value={iso ?? capabilities.isoMin}
            min={capabilities.isoMin}
            max={capabilities.isoMax}
            logarithmic
            disabled={capabilities.isoMax <= capabilities.isoMin}
            format={value => `${Math.round(value)}`}
            onChange={applyIso}
          />
          <RangeSlider
            label="Exposición"
            value={exposureMs ?? capabilities.exposureMinMs}
            min={capabilities.exposureMinMs}
            max={capabilities.exposureMaxMs}
            logarithmic
            disabled={capabilities.exposureMaxMs <= capabilities.exposureMinMs}
            format={value =>
              value >= 1 ? `${value.toFixed(1)} ms` : `${(value * 1000).toFixed(0)} µs`
            }
            onChange={applyExposure}
          />
          <RangeSlider
            label="Foco"
            value={focusDiopters ?? 0}
            min={0}
            max={capabilities.focusMaxDiopters}
            disabled={capabilities.focusMaxDiopters <= 0}
            format={value => (value <= 0 ? 'Infinito' : `${(100 / value).toFixed(0)} cm`)}
            onChange={applyFocus}
          />
          <Pressable
            accessibilityRole="button"
            onPress={backToAuto}
            style={styles.autoButton}>
            <Text style={styles.autoButtonText}>Volver a automático</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      <View style={styles.controls}>
        <Text style={styles.hint} numberOfLines={1}>
          {capture
            ? 'Foto guardada'
            : (hint ??
              (canFocusByTouch
                ? 'Toca para enfocar y toma la foto'
                : 'Encuadra la especie y toma la foto'))}
        </Text>

        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Elegir de la galería"
            onPress={() => {
              void chooseFromGallery();
            }}
            style={styles.sideButton}>
            <Text style={styles.sideButtonIcon}>🖼️</Text>
            <Text style={styles.sideButtonText}>Galería</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tomar foto"
            disabled={session === null || isCapturing}
            onPress={() => {
              void takePhoto();
            }}
            style={[
              styles.shutter,
              (session === null || isCapturing) && styles.shutterDisabled,
            ]}>
            {isCapturing ? (
              <ActivityIndicator color={colors.primaryDark} />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Controles manuales"
            disabled={!canGoManual}
            onPress={() => setShowManual(current => !current)}
            style={[styles.sideButton, !canGoManual && styles.sideButtonDisabled]}>
            <Text style={styles.sideButtonIcon}>🎚️</Text>
            <Text style={styles.sideButtonText}>{showManual ? 'Cerrar' : 'Pro'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    flex: 1,
  },
  viewfinder: {
    backgroundColor: '#000',
    flex: 1,
  },
  preview: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  placeholder: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.surface,
    marginTop: spacing.md,
  },
  focusMark: {
    borderColor: colors.secondary,
    borderRadius: 8,
    borderWidth: 2,
    height: 72,
    position: 'absolute',
    width: 72,
  },
  backButton: {
    left: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    position: 'absolute',
    top: spacing.lg,
  },
  backButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    bottom: spacing.lg,
    borderRadius: 12,
    left: spacing.lg,
    padding: spacing.md,
    position: 'absolute',
    right: spacing.lg,
  },
  errorText: {
    color: colors.surface,
  },
  manualPanel: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    maxHeight: 220,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  autoButton: {
    alignItems: 'center',
    borderColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
  },
  autoButtonText: {
    color: colors.surface,
    fontWeight: '700',
  },
  controls: {
    alignItems: 'center',
    backgroundColor: '#000',
    paddingBottom: spacing.xl,
    paddingTop: spacing.lg,
  },
  hint: {
    color: colors.surface,
    marginBottom: spacing.lg,
    opacity: 0.8,
  },
  buttonRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
  },
  sideButton: {
    alignItems: 'center',
    minWidth: 72,
  },
  sideButtonDisabled: {
    opacity: 0.3,
  },
  sideButtonIcon: {
    fontSize: 24,
  },
  sideButtonText: {
    color: colors.surface,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  shutter: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.surface,
    borderRadius: 40,
    borderWidth: 4,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  shutterDisabled: {
    opacity: 0.4,
  },
  shutterInner: {
    backgroundColor: colors.primary,
    borderRadius: 32,
    height: 64,
    width: 64,
  },
});
