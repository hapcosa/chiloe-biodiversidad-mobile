import React, {useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {useAuth} from '../auth/AuthContext';
import {colors, spacing} from '../styles/theme';
import {runInitialSpeciesSync} from '../sync/initialSync';

interface PerfilScreenProps {
  onBack: () => void;
  onOpenCamera: () => void;
}

export const PerfilScreen = ({onBack, onOpenCamera}: PerfilScreenProps): React.JSX.Element => {
  const {logout, refreshProfile, user} = useAuth();
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncNow = async (): Promise<void> => {
    setIsSyncing(true);
    setSyncStatus('Sincronizando biblioteca...');

    try {
      const count = await runInitialSpeciesSync({
        onProgress: (synced, total) => setSyncStatus(`Sincronizadas ${synced}/${total}`),
      });
      setSyncStatus(`Sincronización completa: ${count} especies`);
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'No se pudo sincronizar');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Biblioteca</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.title}>Perfil</Text>
        <Text style={styles.name}>{user?.name || user?.email}</Text>
        <Text style={styles.meta}>{user?.email}</Text>
        <Text style={styles.meta}>Rol: {user?.role}</Text>
        <Text style={styles.meta}>Proveedor: {user?.provider}</Text>
      </View>

      <Pressable accessibilityRole="button" onPress={refreshProfile} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Actualizar perfil</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isSyncing}
        onPress={syncNow}
        style={[styles.primaryButton, isSyncing && styles.disabled]}>
        {isSyncing ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.primaryButtonText}>Sincronizar biblioteca</Text>
        )}
      </Pressable>

      {syncStatus ? <Text style={styles.syncStatus}>{syncStatus}</Text> : null}

      <Pressable accessibilityRole="button" onPress={onOpenCamera} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Probar cámara NDK</Text>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={logout} style={styles.logoutButton}>
        <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
      </Pressable>
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
    marginBottom: spacing.md,
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    marginTop: spacing.sm,
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
  logoutButton: {
    alignItems: 'center',
    borderColor: colors.danger,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  logoutButtonText: {
    color: colors.danger,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.55,
  },
  syncStatus: {
    color: colors.muted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
