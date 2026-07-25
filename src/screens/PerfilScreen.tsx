import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {avistamientosApi} from '../api';
import {useAuth} from '../auth/AuthContext';
import {getCachedSpecies} from '../db/speciesCache';
import {listLocalAvistamientos} from '../db/mutationQueue';
import {colors, spacing} from '../styles/theme';
import {runInitialSpeciesSync} from '../sync/initialSync';
import type {LocalAvistamiento} from '../types/avistamiento';

interface PerfilScreenProps {
  onOpenCamera: () => void;
}

interface EncuentroConNombre extends LocalAvistamiento {
  speciesName: string;
}

const syncStatusLabel: Record<LocalAvistamiento['sync_status'], string> = {
  pending: 'Pendiente de sincronizar',
  syncing: 'Sincronizando...',
  synced: 'Sincronizado',
  failed: 'Falló la sincronización',
};

export const PerfilScreen = ({onOpenCamera}: PerfilScreenProps): React.JSX.Element => {
  const {logout, refreshProfile, user} = useAuth();
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [encuentros, setEncuentros] = useState<EncuentroConNombre[]>([]);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const loadEncuentros = useCallback(async () => {
    const local = await listLocalAvistamientos();
    const withNames = await Promise.all(
      local.map(async encuentro => {
        const species = encuentro.especie_id
          ? await getCachedSpecies(encuentro.especie_id)
          : null;
        return {
          ...encuentro,
          speciesName: species?.nombre_comun || species?.nombre_cientifico || 'Especie',
        };
      }),
    );
    setEncuentros(withNames);
  }, []);

  useEffect(() => {
    void loadEncuentros();
  }, [loadEncuentros]);

  const compartir = async (encuentro: EncuentroConNombre): Promise<void> => {
    if (!encuentro.remote_id) {
      return;
    }
    setSharingId(encuentro.local_id);
    try {
      await avistamientosApi.compartir(encuentro.remote_id);
      await loadEncuentros();
    } catch {
      // El estado local no cambia; el usuario puede reintentar.
    } finally {
      setSharingId(null);
    }
  };

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

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Mis encuentros</Text>
        <Text style={styles.sectionSubtitle}>
          Privados por defecto — solo tú los ves, salvo que decidas compartirlos.
        </Text>
      </View>

      {encuentros.length === 0 ? (
        <Text style={styles.emptyText}>Aún no registras encuentros.</Text>
      ) : (
        encuentros.map(encuentro => (
          <View key={encuentro.local_id} style={styles.encuentroCard}>
            {encuentro.local_photo_path ? (
              <Image
                resizeMode="cover"
                source={{uri: `file://${encuentro.local_photo_path}`}}
                style={styles.encuentroThumb}
              />
            ) : null}
            <View style={styles.encuentroInfo}>
              <Text style={styles.encuentroName}>{encuentro.speciesName}</Text>
              {encuentro.descripcion ? (
                <Text style={styles.encuentroNota} numberOfLines={2}>
                  {encuentro.descripcion}
                </Text>
              ) : null}
              <Text style={styles.encuentroMeta}>
                {new Date(encuentro.observado_en).toLocaleDateString('es-CL')} ·{' '}
                {syncStatusLabel[encuentro.sync_status]}
              </Text>
              {encuentro.remote_id ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={sharingId === encuentro.local_id}
                  onPress={() => compartir(encuentro)}
                  style={styles.shareButton}>
                  <Text style={styles.shareButtonText}>
                    {sharingId === encuentro.local_id
                      ? 'Compartiendo...'
                      : 'Compartir con la comunidad'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))
      )}

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
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  sectionHeader: {
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: colors.muted,
    marginTop: spacing.xs,
  },
  emptyText: {
    color: colors.muted,
    marginBottom: spacing.md,
  },
  encuentroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.md,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  encuentroThumb: {
    borderRadius: 10,
    height: 72,
    marginRight: spacing.md,
    width: 72,
  },
  encuentroInfo: {
    flex: 1,
  },
  encuentroName: {
    color: colors.text,
    fontWeight: '800',
  },
  encuentroNota: {
    color: colors.muted,
    marginTop: spacing.xs,
  },
  encuentroMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  shareButton: {
    marginTop: spacing.xs,
  },
  shareButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
