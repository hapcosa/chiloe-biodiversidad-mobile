import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {avistamientosApi} from '../api';
import {useAuth} from '../auth/AuthContext';
import {initializeDatabase} from '../db/connection';
import {getCachedSpecies, getLibraryStats} from '../db/speciesCache';
import {listLocalAvistamientos} from '../db/mutationQueue';
import {listSavedSpeciesIds} from '../db/savedSpecies';
import {listViewedSpeciesIds} from '../db/speciesViewed';
import type {CameraCapture} from '../native/ChiloeCamera';
import {uploadLocalPhotoPublicUrl} from '../native/photoUpload';
import {shareEncuentroToStory} from '../native/socialShare';
import {colors, spacing} from '../styles/theme';
import {runInitialSpeciesSync} from '../sync/initialSync';
import {CameraScreen} from './CameraScreen';
import type {LocalAvistamiento} from '../types/avistamiento';

interface PerfilScreenProps {
  onOpenCamera: () => void;
  onOpenAvistamiento: (avistamientoId: number) => void;
}

interface EncuentroConNombre extends LocalAvistamiento {
  speciesName: string;
}

interface ExploradorStats {
  descubiertas: number;
  guardadas: number;
  reinos: number;
  totalEspecies: number;
}

const syncStatusLabel: Record<LocalAvistamiento['sync_status'], string> = {
  pending: 'Pendiente de sincronizar',
  syncing: 'Sincronizando...',
  synced: 'Sincronizado',
  failed: 'Falló la sincronización, se reintentará',
  rejected: 'El servidor lo rechazó',
};

export const PerfilScreen = ({
  onOpenAvistamiento,
  onOpenCamera,
}: PerfilScreenProps): React.JSX.Element => {
  const {logout, refreshProfile, updateAvatar, user} = useAuth();
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [showAvatarCamera, setShowAvatarCamera] = useState(false);
  const [encuentros, setEncuentros] = useState<EncuentroConNombre[]>([]);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [socialSharingId, setSocialSharingId] = useState<string | null>(null);
  const [socialShareError, setSocialShareError] = useState<string | null>(null);
  const [stats, setStats] = useState<ExploradorStats>({
    descubiertas: 0,
    guardadas: 0,
    reinos: 0,
    totalEspecies: 0,
  });

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

  const loadStats = useCallback(async () => {
    await initializeDatabase();
    const [viewedIds, savedIds, libraryStats] = await Promise.all([
      listViewedSpeciesIds(),
      listSavedSpeciesIds(),
      getLibraryStats(),
    ]);
    const viewedSpecies = await Promise.all(
      Array.from(viewedIds).map(id => getCachedSpecies(id)),
    );
    const reinosVistos = new Set(
      viewedSpecies.filter((item): item is NonNullable<typeof item> => item !== null).map(item => item.reino),
    );

    setStats({
      descubiertas: viewedIds.size,
      guardadas: savedIds.size,
      reinos: reinosVistos.size,
      totalEspecies: libraryStats.total,
    });
  }, []);

  useEffect(() => {
    void loadEncuentros();
    void loadStats();
  }, [loadEncuentros, loadStats]);

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

  const shareToSocial = async (encuentro: EncuentroConNombre): Promise<void> => {
    if (!encuentro.local_photo_path) {
      return;
    }
    setSocialShareError(null);
    setSocialSharingId(encuentro.local_id);
    try {
      await shareEncuentroToStory(encuentro.local_photo_path);
    } catch (error) {
      setSocialShareError(
        error instanceof Error ? error.message : 'No se pudo compartir la foto',
      );
    } finally {
      setSocialSharingId(null);
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
      await loadStats();
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'No se pudo sincronizar');
    } finally {
      setIsSyncing(false);
    }
  };

  // Antes esto abría la frontal y disparaba a ciegas. Ahora pasa por el visor:
  // el usuario ve qué está retratando y puede elegir una foto de la galería.
  const subirAvatar = async (captured: CameraCapture): Promise<void> => {
    setShowAvatarCamera(false);
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      const publicUrl = await uploadLocalPhotoPublicUrl(captured.filePath, 'perfiles-fotos');
      await updateAvatar(publicUrl);
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'No se pudo actualizar el avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  if (showAvatarCamera) {
    return (
      <CameraScreen
        hint="Encuadra tu retrato"
        lens="front"
        onBack={() => setShowAvatarCamera(false)}
        onCapture={captured => {
          void subirAvatar(captured);
        }}
      />
    );
  }

  const progresoPct =
    stats.totalEspecies > 0 ? Math.round((stats.descubiertas / stats.totalEspecies) * 100) : 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>MI BITÁCORA</Text>
      <Text style={styles.title}>Perfil del explorador</Text>
      <Text style={styles.subtitle}>Un registro personal de tu viaje por la biodiversidad chilota.</Text>

      <View style={styles.profileCard}>
        <Pressable
          accessibilityRole="button"
          disabled={isUploadingAvatar}
          onPress={() => setShowAvatarCamera(true)}
          style={styles.avatar}>
          {isUploadingAvatar ? (
            <ActivityIndicator color={colors.surface} />
          ) : user?.avatar ? (
            <Image source={{uri: user.avatar}} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarEmoji}>🧭</Text>
          )}
          <View style={styles.avatarEditBadge}>
            <Text style={styles.avatarEditBadgeText}>✎</Text>
          </View>
        </Pressable>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name || user?.email}</Text>
          <Text style={styles.profileMeta}>{user?.email}</Text>
        </View>
      </View>
      {avatarError ? <Text style={styles.avatarErrorText}>{avatarError}</Text> : null}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.descubiertas}</Text>
          <Text style={styles.statLabel}>descubiertas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.guardadas}</Text>
          <Text style={styles.statLabel}>guardadas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.reinos}</Text>
          <Text style={styles.statLabel}>reinos</Text>
        </View>
      </View>

      <View style={styles.progressHeader}>
        <Text style={styles.progressTitle}>Progreso de campo</Text>
        <Text style={styles.progressPct}>{progresoPct}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, {width: `${progresoPct}%`}]} />
      </View>
      <Text style={styles.progressCaption}>
        Has recorrido {stats.descubiertas} de {stats.totalEspecies} especies de esta guía.
      </Text>

      <View style={styles.tipCard}>
        <Text style={styles.tipText}>
          ℹ️ La biodiversidad se cuida cuando aprendemos a verla.
        </Text>
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
              <View style={styles.encuentroActions}>
                {/* Las identificaciones viven en el servidor: hasta que el
                    encuentro no se sincroniza no hay nada que discutir. */}
                {encuentro.remote_id ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      encuentro.remote_id && onOpenAvistamiento(encuentro.remote_id)
                    }
                    style={styles.shareButton}>
                    <Text style={styles.shareButtonText}>Ver identificaciones</Text>
                  </Pressable>
                ) : null}
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
                {encuentro.local_photo_path ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={socialSharingId === encuentro.local_id}
                    onPress={() => shareToSocial(encuentro)}
                    style={styles.shareButton}>
                    <Text style={styles.shareButtonText}>
                      {socialSharingId === encuentro.local_id
                        ? 'Abriendo...'
                        : '📤 Instagram/Facebook Stories'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ))
      )}
      {socialShareError ? <Text style={styles.avatarErrorText}>{socialShareError}</Text> : null}

      <Pressable accessibilityRole="button" onPress={logout} style={styles.logoutButton}>
        <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
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
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    color: colors.primaryDark,
    fontSize: 28,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.muted,
    marginTop: spacing.xs,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    borderRadius: 18,
    flexDirection: 'row',
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 56,
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarEmoji: {
    fontSize: 26,
  },
  avatarEditBadge: {
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 999,
    bottom: -2,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 20,
  },
  avatarEditBadgeText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },
  avatarErrorText: {
    color: colors.danger,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileName: {
    color: colors.surface,
    fontSize: 17,
    fontWeight: '800',
  },
  profileMeta: {
    color: '#9CC2AE',
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingVertical: spacing.md,
  },
  statValue: {
    color: colors.primaryDark,
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  progressTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  progressPct: {
    color: colors.secondary,
    fontWeight: '800',
  },
  progressTrack: {
    backgroundColor: colors.border,
    borderRadius: 999,
    height: 8,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.secondary,
    borderRadius: 999,
    height: '100%',
  },
  progressCaption: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  tipCard: {
    backgroundColor: `${colors.secondary}1A`,
    borderRadius: 14,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  tipText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    marginTop: spacing.lg,
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
    marginTop: spacing.md,
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
    marginTop: spacing.lg,
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
  encuentroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
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
