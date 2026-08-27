import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {authApi, insigniasApi} from '../api';
import {InsigniasRow} from '../components/Insignias';
import {colors, spacing} from '../styles/theme';
import type {UserPerfilPublico} from '../types/domain';
import type {InsigniaOtorgada} from '../types/insignia';

interface PerfilPublicoScreenProps {
  usuarioId: number;
  onBack: () => void;
}

const rolLabel: Record<UserPerfilPublico['role'], string> = {
  admin: 'Administración',
  moderator: 'Curaduría',
  researcher: 'Investigación',
  user: 'Comunidad',
};

export const PerfilPublicoScreen = ({
  usuarioId,
  onBack,
}: PerfilPublicoScreenProps): React.JSX.Element => {
  const [perfil, setPerfil] = useState<UserPerfilPublico | null>(null);
  const [insignias, setInsignias] = useState<InsigniaOtorgada[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [noDisponible, setNoDisponible] = useState(false);

  const cargar = useCallback(async () => {
    setIsLoading(true);
    setNoDisponible(false);
    try {
      setPerfil(await authApi.perfilPublico(usuarioId));
      // En paralelo no: si el perfil no está publicado no hay nada que
      // acompañar, y las insignias de alguien invisible tampoco se muestran.
      try {
        setInsignias(await insigniasApi.deUsuario(usuarioId));
      } catch {
        setInsignias([]);
      }
    } catch {
      // La API responde 404 tanto si la persona no existe como si no publicó
      // su perfil, a propósito: no hay nada que distinguir para quien mira.
      setNoDisponible(true);
    } finally {
      setIsLoading(false);
    }
  }, [usuarioId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Volver</Text>
      </Pressable>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : noDisponible || !perfil ? (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>Perfil no disponible</Text>
          <Text style={styles.emptyText}>
            Esta persona no publicó su perfil. Sus encuentros compartidos siguen visibles en la
            comunidad.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              {perfil.avatar ? (
                <Image source={{uri: perfil.avatar}} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInicial}>
                  {perfil.name.trim().charAt(0).toUpperCase() || '?'}
                </Text>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{perfil.name}</Text>
              <Text style={styles.profileMeta}>{rolLabel[perfil.role]}</Text>
              {perfil.profesion ? (
                <Text style={styles.profesion}>{perfil.profesion}</Text>
              ) : null}
              <InsigniasRow insignias={insignias} />
            </View>
          </View>

          {perfil.bio ? (
            <View style={styles.card}>
              <Text style={styles.label}>Bio</Text>
              <Text style={styles.bio}>{perfil.bio}</Text>
            </View>
          ) : null}

          <Text style={styles.desde}>
            En la comunidad desde {new Date(perfil.created_at).toLocaleDateString('es-CL')}.
          </Text>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    padding: spacing.lg,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  loader: {
    marginTop: spacing.xl,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    borderRadius: 18,
    flexDirection: 'row',
    marginBottom: spacing.md,
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
  avatarInicial: {
    color: colors.surface,
    fontSize: 24,
    fontWeight: '800',
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
  profesion: {
    color: colors.secondary,
    fontWeight: '700',
    marginTop: spacing.xs,
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
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  bio: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  emptyTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 20,
  },
  desde: {
    color: colors.muted,
    fontSize: 13,
  },
});
