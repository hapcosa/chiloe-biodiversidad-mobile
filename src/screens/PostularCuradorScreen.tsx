import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {categoriasApi, postulacionesApi} from '../api';
import {colors, reinoLabels, spacing} from '../styles/theme';
import type {Categoria, Reino} from '../types/domain';
import type {PostulacionCurador, PostulacionEstado} from '../types/postulacion';
import {TEXTO_MAX} from '../types/postulacion';
import {formatFechaCorta} from '../utils/fechas';
import {puedePostular, ultimaPorCategoria} from '../utils/postulaciones';

interface PostularCuradorScreenProps {
  onBack: () => void;
}

const REINOS: Reino[] = ['animalia', 'plantae', 'fungi', 'protista', 'monera'];

const estadoLabels: Record<PostulacionEstado, string> = {
  pendiente: 'En revisión',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};

const estadoColors: Record<PostulacionEstado, string> = {
  pendiente: colors.secondary,
  aprobada: colors.success,
  rechazada: colors.danger,
};

export const PostularCuradorScreen = ({
  onBack,
}: PostularCuradorScreenProps): React.JSX.Element => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [postulaciones, setPostulaciones] = useState<PostulacionCurador[]>([]);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [texto, setTexto] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const [lista, mias] = await Promise.all([
        categoriasApi.list(),
        postulacionesApi.mias(),
      ]);
      setCategorias(lista);
      setPostulaciones(mias);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudieron cargar los subgrupos',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const estadoPorCategoria = useMemo(
    () => ultimaPorCategoria(postulaciones),
    [postulaciones],
  );

  const categoriasPorReino = useMemo(() => {
    const agrupadas = new Map<Reino, Categoria[]>();
    for (const categoria of categorias) {
      const delReino = agrupadas.get(categoria.reino) ?? [];
      delReino.push(categoria);
      agrupadas.set(categoria.reino, delReino);
    }
    return agrupadas;
  }, [categorias]);

  const categoriaElegida = categorias.find(c => c.id === categoriaId) ?? null;

  const postular = async (): Promise<void> => {
    if (categoriaId === null) {
      setError('Elige el subgrupo que quieres curar');
      return;
    }

    const motivacion = texto.trim();
    if (motivacion.length < 20) {
      // El servidor solo exige que no esté en blanco, pero dos palabras no le
      // dan al admin nada que evaluar y la postulación vuelve rechazada.
      setError('Cuéntanos un poco más: al menos un par de frases.');
      return;
    }

    setIsSending(true);
    setError(null);
    setAviso(null);
    try {
      const creada = await postulacionesApi.create({
        categoria_id: categoriaId,
        texto: motivacion,
      });
      setPostulaciones(previas => [creada, ...previas]);
      setTexto('');
      setCategoriaId(null);
      setAviso('Postulación enviada. Te avisaremos cuando la revisen.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo enviar la postulación',
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Mi perfil</Text>
      </Pressable>

      <Text style={styles.title}>Postularme a curador</Text>
      <Text style={styles.intro}>
        Un curador revisa las identificaciones de un subgrupo —las aves, los hongos— y
        su palabra cierra la discusión. Cuéntanos qué te respalda: estudios, años de
        terreno, publicaciones, la organización con la que trabajas.
      </Text>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.label}>Subgrupo</Text>
            {categorias.length === 0 ? (
              <Text style={styles.ayuda}>
                Todavía no hay subgrupos definidos a los que postularse.
              </Text>
            ) : (
              REINOS.filter(reino => categoriasPorReino.has(reino)).map(reino => (
                <View key={reino} style={styles.grupoReino}>
                  <Text style={styles.reinoTitulo}>{reinoLabels[reino]}</Text>
                  <View style={styles.chips}>
                    {(categoriasPorReino.get(reino) ?? []).map(categoria => {
                      const previa = estadoPorCategoria.get(categoria.id);
                      const bloqueada = !puedePostular(previa);
                      const activa = categoria.id === categoriaId;
                      return (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{disabled: bloqueada, selected: activa}}
                          disabled={bloqueada}
                          key={categoria.id}
                          onPress={() => setCategoriaId(categoria.id)}
                          style={[
                            styles.chip,
                            activa && styles.chipActivo,
                            bloqueada && styles.chipBloqueado,
                          ]}>
                          <Text
                            style={[styles.chipTexto, activa && styles.chipTextoActivo]}>
                            {categoria.nombre}
                            {previa?.estado === 'aprobada' ? ' · ya la curas' : ''}
                            {previa?.estado === 'pendiente' ? ' · en revisión' : ''}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Tu experiencia</Text>
            <TextInput
              maxLength={TEXTO_MAX}
              multiline
              numberOfLines={6}
              onChangeText={setTexto}
              placeholder={
                categoriaElegida
                  ? `Por qué deberías curar ${categoriaElegida.nombre}`
                  : 'Qué te respalda para curar este subgrupo'
              }
              style={[styles.input, styles.multiline]}
              value={texto}
            />
            <Text style={styles.contador}>
              {texto.length}/{TEXTO_MAX}
            </Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {aviso ? <Text style={styles.avisoText}>{aviso}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={isSending}
            onPress={postular}
            style={[styles.primaryButton, isSending && styles.disabled]}>
            {isSending ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.primaryButtonText}>Enviar postulación</Text>
            )}
          </Pressable>

          {postulaciones.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Mis postulaciones</Text>
              {postulaciones.map(postulacion => {
                const categoria = categorias.find(c => c.id === postulacion.categoria_id);
                return (
                  <View key={postulacion.id} style={styles.card}>
                    <View style={styles.filaEstado}>
                      <Text style={styles.categoriaNombre}>
                        {categoria?.nombre ?? `Subgrupo #${postulacion.categoria_id}`}
                      </Text>
                      <Text
                        style={[
                          styles.badge,
                          {backgroundColor: estadoColors[postulacion.estado]},
                        ]}>
                        {estadoLabels[postulacion.estado]}
                      </Text>
                    </View>
                    <Text style={styles.ayuda}>
                      Enviada el {formatFechaCorta(postulacion.created_at)}
                    </Text>
                    {postulacion.estado === 'rechazada' && postulacion.motivo ? (
                      <Text style={styles.motivo}>Motivo: {postulacion.motivo}</Text>
                    ) : null}
                  </View>
                );
              })}
            </>
          ) : null}
        </>
      )}
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
    marginBottom: spacing.sm,
  },
  intro: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  loader: {
    marginTop: spacing.xl,
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
  grupoReino: {
    marginTop: spacing.md,
  },
  reinoTitulo: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: spacing.xs,
    marginRight: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipActivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipBloqueado: {
    opacity: 0.45,
  },
  chipTexto: {
    color: colors.text,
    fontSize: 13,
  },
  chipTextoActivo: {
    color: colors.surface,
  },
  input: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingVertical: spacing.sm,
  },
  multiline: {
    minHeight: 140,
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
  errorText: {
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  avisoText: {
    color: colors.success,
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
  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  filaEstado: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoriaNombre: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    borderRadius: 10,
    color: colors.surface,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  motivo: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
});
