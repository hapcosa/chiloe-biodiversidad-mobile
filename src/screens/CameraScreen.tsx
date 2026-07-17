import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
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
  const [status, setStatus] = useState('Cámara cerrada');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(
    () => () => {
      if (session) {
        void session.close();
      }
    },
    [session],
  );

  const run = async (action: () => Promise<void>): Promise<void> => {
    setIsBusy(true);
    try {
      await action();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error de cámara');
    } finally {
      setIsBusy(false);
    }
  };

  const openBackCamera = (): Promise<void> =>
    run(async () => {
      const nextSession = await openCamera({lens: 'back'});
      setSession(nextSession);
      setStatus(`Sesión abierta: ${nextSession.sessionId}`);
    });

  const captureJpeg = (): Promise<void> =>
    run(async () => {
      if (!session) {
        throw new Error('Abre una sesión de cámara primero');
      }
      const result = await session.capture();
      setCapture(result);
      setStatus('JPEG capturado');
    });

  const closeCamera = (): Promise<void> =>
    run(async () => {
      await session?.close();
      setSession(null);
      setStatus('Cámara cerrada');
    });

  const applyManualControls = (): Promise<void> =>
    run(async () => {
      if (!session) {
        throw new Error('Abre una sesión de cámara primero');
      }
      await session.setIso(200);
      await session.setExposure(12);
      await session.setFocus('auto');
      setStatus('Controles aplicados: ISO 200, 12 ms, foco auto');
    });

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Volver</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.title}>Cámara NDK</Text>
        <Text style={styles.subtitle}>
          MVP sin preview: abre cámara trasera, aplica controles manuales y captura JPEG.
        </Text>
        <Text style={styles.status}>{status}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy || session !== null}
        onPress={openBackCamera}
        style={[styles.primaryButton, (isBusy || session !== null) && styles.disabled]}>
        <Text style={styles.primaryButtonText}>Abrir cámara trasera</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy || session === null}
        onPress={applyManualControls}
        style={[styles.secondaryButton, (isBusy || session === null) && styles.disabled]}>
        <Text style={styles.secondaryButtonText}>Aplicar controles</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy || session === null}
        onPress={captureJpeg}
        style={[styles.primaryButton, (isBusy || session === null) && styles.disabled]}>
        {isBusy ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.primaryButtonText}>Capturar JPEG</Text>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy || session === null}
        onPress={closeCamera}
        style={[styles.secondaryButton, (isBusy || session === null) && styles.disabled]}>
        <Text style={styles.secondaryButtonText}>Cerrar cámara</Text>
      </Pressable>

      {capture ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Última captura</Text>
          <Text style={styles.resultText}>Archivo: {capture.filePath}</Text>
          <Text style={styles.resultText}>
            Tamaño: {capture.width} × {capture.height}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    padding: spacing.lg,
  },
  backButton: {
    marginBottom: spacing.lg,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  title: {
    color: colors.primaryDark,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  status: {
    color: colors.text,
    fontWeight: '700',
    marginTop: spacing.lg,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.5,
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  resultTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  resultText: {
    color: colors.text,
    lineHeight: 22,
  },
});

