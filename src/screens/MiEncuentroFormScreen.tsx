import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {enqueueAvistamiento} from '../db/mutationQueue';
import {markSpeciesViewed} from '../db/speciesViewed';
import type {CameraCapture} from '../native/ChiloeCamera';
import {getCurrentLocation, type LocationResult} from '../native/location';
import {syncPendingMutations} from '../sync/mutationSync';
import {colors, spacing} from '../styles/theme';
import {CameraScreen} from './CameraScreen';
import type {Species} from '../types/domain';

interface MiEncuentroFormScreenProps {
  species: Species;
  onBack: () => void;
  onSaved: () => void;
}

export const MiEncuentroFormScreen = ({
  species,
  onBack,
  onSaved,
}: MiEncuentroFormScreenProps): React.JSX.Element => {
  const [nota, setNota] = useState('');
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const captureLocation = async (): Promise<void> => {
    setIsLocating(true);
    setLocationError(null);
    try {
      setLocation(await getCurrentLocation());
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'No se pudo obtener la ubicación');
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    void captureLocation();
  }, []);

  // Antes se abría la cámara y se disparaba a ciegas: la foto salía de lo que
  // el sensor tuviera delante en ese instante. Ahora va por el visor.
  const recibirFoto = (capture: CameraCapture): void => {
    setPhotoPath(capture.filePath);
    setShowCamera(false);
  };

  const guardar = async (): Promise<void> => {
    if (!location) {
      setSaveError('Necesitas ubicación para guardar el encuentro');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // foto_key queda null si hay foto: se sube recién al sincronizar (ver
      // sync/mutationSync.ts), para no depender de red al guardar el
      // encuentro (offline-first). local_photo_path es lo que se muestra
      // en la UI mientras tanto.
      await enqueueAvistamiento({
        especie_id: species.id,
        reino: species.reino,
        descripcion: nota.trim() || null,
        foto_key: null,
        local_photo_path: photoPath,
        geo_lat: location.lat,
        geo_lng: location.lng,
        precision_metros: location.accuracyMeters,
        observado_en: new Date().toISOString(),
      });
      // Intento de sync inmediato si hay red; si no, queda en cola y lo
      // recoge startMutationSyncWorker en el próximo cambio de conectividad.
      void syncPendingMutations();
      await markSpeciesViewed(species.id);

      onSaved();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar el encuentro');
    } finally {
      setIsSaving(false);
    }
  };

  if (showCamera) {
    return (
      <CameraScreen
        hint="Toca para enfocar y captura tu encuentro"
        onBack={() => setShowCamera(false)}
        onCapture={recibirFoto}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>← {species.nombre_comun || species.nombre_cientifico}</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.title}>Mi encuentro</Text>
        <Text style={styles.subtitle}>
          Privado por defecto — solo tú lo verás en tu perfil, salvo que decidas compartirlo.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Nota privada</Text>
        <TextInput
          multiline
          numberOfLines={4}
          onChangeText={setNota}
          placeholder="¿Dónde y cómo la viste?"
          style={styles.notaInput}
          value={nota}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Ubicación</Text>
        {isLocating ? (
          <ActivityIndicator color={colors.primary} style={styles.locationLoader} />
        ) : location ? (
          <Text style={styles.locationText}>
            {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </Text>
        ) : (
          <Text style={styles.errorText}>{locationError}</Text>
        )}
        <Pressable accessibilityRole="button" onPress={captureLocation} style={styles.linkButton}>
          <Text style={styles.linkButtonText}>Actualizar ubicación</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Foto (opcional)</Text>
        {photoPath ? (
          <>
            <Image resizeMode="cover" source={{uri: `file://${photoPath}`}} style={styles.preview} />
            <Pressable
              accessibilityRole="button"
              onPress={() => setPhotoPath(null)}
              style={styles.linkButton}>
              <Text style={styles.linkButtonText}>Quitar foto</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowCamera(true)}
            style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Tomar foto</Text>
          </Pressable>
        )}
      </View>

      {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSaving || !location}
        onPress={guardar}
        style={[styles.primaryButton, (isSaving || !location) && styles.disabled]}>
        {isSaving ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.primaryButtonText}>Guardar encuentro</Text>
        )}
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.md,
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
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  title: {
    color: colors.primaryDark,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    marginTop: spacing.xs,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  notaInput: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 96,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  locationLoader: {
    marginVertical: spacing.sm,
  },
  locationText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  linkButton: {
    marginTop: spacing.sm,
  },
  linkButtonText: {
    color: colors.primary,
    fontWeight: '700',
  },
  preview: {
    borderRadius: 12,
    height: 180,
    marginBottom: spacing.sm,
    width: '100%',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 48,
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
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.55,
  },
});
