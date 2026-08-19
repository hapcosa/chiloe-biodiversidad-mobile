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
import {AVISO_FAUNA_ENCUENTRO, requiereAvisoFauna} from '../content/avisos';
import {enqueueAvistamiento} from '../db/mutationQueue';
import {markSpeciesViewed} from '../db/speciesViewed';
import {type CameraCapture, pickImageFromGallery} from '../native/ChiloeCamera';
import {getCurrentLocation, type LocationResult} from '../native/location';
import {syncPendingMutations} from '../sync/mutationSync';
import {colors, spacing} from '../styles/theme';
import {CameraScreen} from './CameraScreen';
import type {PrecisionDeclarada} from '../types/avistamiento';
import type {Reino, Species} from '../types/domain';
import {
  construirObservadoEn,
  esHoy,
  type PartesFecha,
  partesDeFecha,
} from '../utils/fechaEncuentro';

// Qué significa cada opción para quien la elige. Sin esto, "aproximado" y
// "zona" son lo mismo y nadie usa la tercera.
const PRECISIONES: Array<{valor: PrecisionDeclarada; titulo: string; ayuda: string}> = [
  {valor: 'exacto', titulo: 'Exacto', ayuda: 'Estoy en el lugar ahora mismo'},
  {valor: 'aproximado', titulo: 'Aproximado', ayuda: 'Cerca de aquí, con algo de margen'},
  {valor: 'zona', titulo: 'Solo la zona', ayuda: 'Recuerdo el sector, no el punto'},
];

interface MiEncuentroFormScreenProps {
  // `null` cuando se llega desde la cámara sin saber qué es: el encuentro se
  // guarda igual y la comunidad lo identifica después.
  species: Species | null;
  // El reino de la especie, o el que declaró quien registra si no hay especie.
  // No es opcional porque la columna no admite nulo y el mapa filtra por ella.
  reino: Reino;
  // Foto ya tomada antes de abrir el formulario (flujo de la pestaña Capturar).
  fotoInicial?: string | null;
  onBack: () => void;
  onSaved: () => void;
}

export const MiEncuentroFormScreen = ({
  species,
  reino,
  fotoInicial = null,
  onBack,
  onSaved,
}: MiEncuentroFormScreenProps): React.JSX.Element => {
  const [nombreSugerido, setNombreSugerido] = useState('');
  const [nota, setNota] = useState('');
  const [fecha, setFecha] = useState<PartesFecha>(() => partesDeFecha(new Date()));
  const [precisionDeclarada, setPrecisionDeclarada] =
    useState<PrecisionDeclarada>('exacto');
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [photoPath, setPhotoPath] = useState<string | null>(fotoInicial);
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

  const elegirDeGaleria = async (): Promise<void> => {
    // Un encuentro de hace años no se fotografía ahora: la foto ya existe.
    const capture = await pickImageFromGallery();
    if (capture) {
      setPhotoPath(capture.filePath);
    }
  };

  const cambiarFecha = (campo: keyof PartesFecha, valor: string): void => {
    const siguiente = {...fecha, [campo]: valor.replace(/[^0-9]/g, '')};
    setFecha(siguiente);
    // La lectura del GPS es de aquí y ahora: si el encuentro no es de hoy, esa
    // coordenada ya no describe dónde pasó. Se baja la precisión declarada en
    // vez de dejar que un recuerdo entre al mapa como si fuera medido.
    if (!esHoy(siguiente, new Date()) && precisionDeclarada === 'exacto') {
      setPrecisionDeclarada('aproximado');
    }
  };

  const guardar = async (): Promise<void> => {
    if (!location) {
      setSaveError('Necesitas ubicación para guardar el encuentro');
      return;
    }

    const observadoEn = construirObservadoEn(fecha, new Date());
    if (!observadoEn.ok) {
      setSaveError(observadoEn.error);
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
        especie_id: species?.id ?? null,
        reino,
        nombre_sugerido: species === null ? nombreSugerido.trim() || null : null,
        descripcion: nota.trim() || null,
        foto_key: null,
        local_photo_path: photoPath,
        geo_lat: location.lat,
        geo_lng: location.lng,
        precision_metros: location.accuracyMeters,
        precision_declarada: precisionDeclarada,
        observado_en: observadoEn.iso,
      });
      // Intento de sync inmediato si hay red; si no, queda en cola y lo
      // recoge startMutationSyncWorker en el próximo cambio de conectividad.
      void syncPendingMutations();
      if (species !== null) {
        await markSpeciesViewed(species.id);
      }

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
        <Text style={styles.backButtonText}>
          ← {species ? species.nombre_comun || species.nombre_cientifico : 'Volver'}
        </Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.title}>Mi encuentro</Text>
        <Text style={styles.subtitle}>
          Privado por defecto — solo tú lo verás en tu perfil, salvo que decidas compartirlo.
        </Text>
      </View>

      {species === null ? (
        <View style={styles.card}>
          <Text style={styles.label}>¿Cómo lo llamarías? (opcional)</Text>
          <Text style={styles.subtitle}>
            No hace falta acertar. Si lo compartes, la comunidad puede proponer la especie.
          </Text>
          <TextInput
            onChangeText={setNombreSugerido}
            placeholder="Pájaro negro de pecho blanco"
            style={styles.notaInput}
            value={nombreSugerido}
          />
        </View>
      ) : null}

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
        <Text style={styles.label}>¿Cuándo lo viste?</Text>
        <View style={styles.fechaRow}>
          <TextInput
            keyboardType="number-pad"
            maxLength={2}
            onChangeText={valor => cambiarFecha('dia', valor)}
            placeholder="DD"
            style={[styles.fechaInput, styles.fechaInputCorto]}
            value={fecha.dia}
          />
          <Text style={styles.fechaSeparador}>/</Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={2}
            onChangeText={valor => cambiarFecha('mes', valor)}
            placeholder="MM"
            style={[styles.fechaInput, styles.fechaInputCorto]}
            value={fecha.mes}
          />
          <Text style={styles.fechaSeparador}>/</Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={4}
            onChangeText={valor => cambiarFecha('anio', valor)}
            placeholder="AAAA"
            style={styles.fechaInput}
            value={fecha.anio}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setFecha(partesDeFecha(new Date()))}
          style={styles.linkButton}>
          <Text style={styles.linkButtonText}>Fue hoy</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>¿Qué tan exacta es la ubicación?</Text>
        {PRECISIONES.map(opcion => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{selected: precisionDeclarada === opcion.valor}}
            key={opcion.valor}
            onPress={() => setPrecisionDeclarada(opcion.valor)}
            style={[
              styles.opcion,
              precisionDeclarada === opcion.valor && styles.opcionActiva,
            ]}>
            <Text style={styles.opcionTitulo}>{opcion.titulo}</Text>
            <Text style={styles.opcionAyuda}>{opcion.ayuda}</Text>
          </Pressable>
        ))}
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
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowCamera(true)}
              style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Tomar foto</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void elegirDeGaleria()}
              style={styles.linkButton}>
              <Text style={styles.linkButtonText}>Elegir de la galería</Text>
            </Pressable>
          </>
        )}
      </View>

      {requiereAvisoFauna(reino) ? (
        <View accessibilityRole="alert" style={styles.avisoFauna}>
          <Text style={styles.avisoFaunaText}>{AVISO_FAUNA_ENCUENTRO}</Text>
        </View>
      ) : null}

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
  avisoFauna: {
    backgroundColor: `${colors.secondary}1A`,
    borderLeftColor: colors.secondary,
    borderLeftWidth: 4,
    borderRadius: 14,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  avisoFaunaText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
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
  fechaRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  fechaInput: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    minWidth: 80,
    padding: spacing.md,
    textAlign: 'center',
  },
  fechaInputCorto: {
    minWidth: 60,
  },
  fechaSeparador: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
  },
  opcion: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  opcionActiva: {
    backgroundColor: `${colors.primary}14`,
    borderColor: colors.primary,
  },
  opcionTitulo: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  opcionAyuda: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
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
