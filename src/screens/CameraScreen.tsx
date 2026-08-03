import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {CameraPreview} from '../native/CameraPreview';
import {
  openCamera,
  type CameraCapture,
  type CameraSession,
} from '../native/ChiloeCamera';
import {colors, spacing} from '../styles/theme';

interface CameraScreenProps {
  onBack: () => void;
}

export const CameraScreen = ({onBack}: CameraScreenProps): React.JSX.Element => {
  const [session, setSession] = useState<CameraSession | null>(null);
  const [capture, setCapture] = useState<CameraCapture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
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
        const nextSession = await openCamera({lens: 'back'});
        if (cancelled) {
          void nextSession.close();
          return;
        }
        setSession(nextSession);
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
  }, []);

  useEffect(
    () => () => {
      if (session) {
        void session.close();
      }
    },
    [session],
  );

  const takePhoto = useCallback(async (): Promise<void> => {
    if (!session || isCapturing) {
      return;
    }

    setIsCapturing(true);
    setError(null);
    try {
      setCapture(await session.capture());
    } catch (captureError) {
      setError(
        captureError instanceof Error
          ? captureError.message
          : 'No se pudo tomar la foto',
      );
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, session]);

  return (
    <View style={styles.container}>
      <View style={styles.viewfinder}>
        {session ? (
          <CameraPreview sessionId={session.sessionId} style={styles.preview} />
        ) : (
          <View style={styles.placeholder}>
            <ActivityIndicator color={colors.surface} />
            <Text style={styles.placeholderText}>Abriendo la cámara…</Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={onBack}
          style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </Pressable>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.controls}>
        <Text style={styles.hint} numberOfLines={1}>
          {capture ? 'Foto guardada' : 'Encuadra la especie y toma la foto'}
        </Text>

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
