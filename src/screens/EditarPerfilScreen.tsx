import React, {useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useAuth} from '../auth/AuthContext';
import {colors, spacing} from '../styles/theme';
import {permiteProfesion} from '../utils/roles';

interface EditarPerfilScreenProps {
  onBack: () => void;
  onSaved: () => void;
}

const BIO_MAX = 500;
const PROFESION_MAX = 120;

export const EditarPerfilScreen = ({
  onBack,
  onSaved,
}: EditarPerfilScreenProps): React.JSX.Element => {
  const {updateProfile, user} = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [profesion, setProfesion] = useState(user?.profesion ?? '');
  const [perfilPublico, setPerfilPublico] = useState(user?.perfil_publico ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const muestraProfesion = user ? permiteProfesion(user.role) : false;

  const guardar = async (): Promise<void> => {
    const nombre = name.trim();
    if (nombre.length < 2) {
      setError('El nombre necesita al menos dos caracteres');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await updateProfile({
        name: nombre,
        bio: bio.trim(),
        // Sin el campo a la vista no hay nada que enviar: mandar "" borraría
        // una profesión que el usuario no llegó a ver.
        ...(muestraProfesion ? {profesion: profesion.trim()} : {}),
        perfil_publico: perfilPublico,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el perfil');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Mi perfil</Text>
      </Pressable>

      <Text style={styles.title}>Editar perfil</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          onChangeText={setName}
          placeholder="Cómo quieres que te llamen"
          style={styles.input}
          value={name}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Bio</Text>
        <TextInput
          maxLength={BIO_MAX}
          multiline
          numberOfLines={4}
          onChangeText={setBio}
          placeholder="Qué te trae al campo"
          style={[styles.input, styles.multiline]}
          value={bio}
        />
        <Text style={styles.contador}>
          {bio.length}/{BIO_MAX}
        </Text>
      </View>

      {muestraProfesion ? (
        <View style={styles.card}>
          <Text style={styles.label}>Profesión</Text>
          <TextInput
            maxLength={PROFESION_MAX}
            onChangeText={setProfesion}
            placeholder="Bióloga, guardaparques, micóloga…"
            style={styles.input}
            value={profesion}
          />
          <Text style={styles.ayuda}>
            Se muestra junto a tus revisiones para que se sepa quién está detrás.
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Perfil público</Text>
          <Switch onValueChange={setPerfilPublico} value={perfilPublico} />
        </View>
        <Text style={styles.ayuda}>
          Con esto activado, otras personas de la comunidad pueden ver tu nombre, tu foto y tu bio.
          Tu correo nunca se muestra, y tus encuentros privados siguen siendo privados.
        </Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        onPress={guardar}
        style={[styles.primaryButton, isSaving && styles.disabled]}>
        {isSaving ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.primaryButtonText}>Guardar cambios</Text>
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
  title: {
    color: colors.primaryDark,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingVertical: spacing.sm,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  contador: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  ayuda: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  errorText: {
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 48,
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.55,
  },
});
